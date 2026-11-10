/* Offline P0 source-level execution tests. No network, SQL or browser. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = process.env.ENVERP_P0_TYPESCRIPT_MODULE
  ? require(process.env.ENVERP_P0_TYPESCRIPT_MODULE)
  : require('typescript');
const root = path.resolve(__dirname, '..');
function loadTs(relative, dependencies) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  });
  const diagnostics = transpiled.diagnostics || [];
  assert.equal(diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0, `${relative} syntax diagnostics`);
  const fakeModule = new Module(relative, module);
  fakeModule.filename = path.join(root, relative);
  fakeModule.paths = module.paths;
  fakeModule.require = (name) => dependencies[name] || new Proxy({}, { get: () => undefined });
  fakeModule._compile(transpiled.outputText, fakeModule.filename);
  return fakeModule.exports;
}
function response(data, ok=true, status=200) { return { ok, status, json: async () => data }; }
function scope() { return { tenantId: 't', companyId: 'c', branchId: 'b', accountingPeriodId: 'p' }; }
function row(id, customer='cust', room='room', opening=null) {
  return { id, customerId: customer, roomId: room, openingId: opening,
    tenant_id:'t', company_id:'c', branch_id:'b', accounting_period_id:'p',
    isDeleted:false, templateType:'BASIC', rawValues:{ width:75,height:38 }, entity_version:2 };
}
async function clientTest(name, cases) {
  const measurements = new Map(cases.initialMeasurements || []);
  const customer = { id: 'cust', isDeleted:false, rooms:[], tenantId:'t', companyId:'c', branchId:'b', accountingPeriodId:'p' };
  const customers = cases.noCustomer ? [] : [customer];
  const calls = { inserts:0, parent:0, recoverRequests:0, reloads:0, parentWrites:0 };
  const state = { customers };
  const oldFetch = global.fetch;
  const pages = cases.pages || [{ success:true, sourceCount:1, excludedCount:0, hasMore:false, nextOffset:1, measurements:[row('m1')] }];
  global.fetch = async (url, options) => {
    if (url === '/api/measurements/recovery') {
      calls.recoverRequests++;
      assert.equal(options.headers.Authorization, 'Bearer session');
      return response(pages[calls.recoverRequests-1] || {success:false});
    }
    if (url === '/api/measurement-parent-authority/check') {
      calls.parent++;
      return response({ success:true });
    }
    throw Error(`unexpected network access ${url}`);
  };
  try {
    const exports = loadTs('src/lib/deltaSyncClient.ts', {
      './clientErpScope': { loadVerifiedClientErpScope: async () => scope() },
      './erpScope': { erpScopeMatches: (a,b)=>JSON.stringify(a)===JSON.stringify(b) },
      '@/store/measurementStore': { useMeasurementStore: { getState: () => ({
        measurements:[...measurements.values()],
        loadMeasurements: async()=>{calls.reloads++;},
        batchUpsertMeasurements: async () => { throw Error('UPSERT_FORBIDDEN_IN_RECOVERY'); },
      }) } },
      './customerTreeScope': { readErpScope:()=>scope() },
      './localMeasurementDb': {
        localMeasurementDb: { measurements: {
          toArray: async()=>{ if(cases.readFailure) throw Error('INDEXEDDB_READ_FAILED'); return [...measurements.values()]; },
          get: async id => measurements.get(id),
        } },
        addRecoveredLocalMeasurementIfAbsent: async item => {
          calls.inserts++;
          if (cases.insertFailure) throw Error('INDEXEDDB_INSERT_FAILED');
          if (cases.raceExisting) {
            measurements.set(item.id, { id:item.id, notes:'CONCURRENT_LOCAL_EDIT', version:999 });
            return 'EXISTS';
          }
          if (measurements.has(item.id)) return 'EXISTS';
          measurements.set(item.id,item);
          return 'INSERTED';
        },
      },
      '@/store/useStore': { useStore: {
        getState:()=>state,
        setState: (updater)=> Object.assign(state,updater(state)),
      } },
      './localCustomerDb': { loadLocalCustomers:async()=> customers,
        saveLocalCustomerWithoutSync:async updated => {
          calls.parentWrites++;
          if (cases.parentFailure && calls.parentWrites === 1) throw Error('PARENT_WRITE_FAILED');
          state.customers=[updated];
        } },
      './measurementCanonicalParentSnapshot': { getCanonicalParentPackageFromSnapshot: ()=> ({room:{id:'room',name:'Kitchen'},opening:null}) },
      './localDraftDb': {},
      '@/store/useAuthStore': { useAuthStore:{getState:()=>({currentUser:{id:'u',role: cases.role||'ADMIN'},sessionToken:'session'})} },
    });
    const result = await exports.recoverMissingMeasurementsFromCanonical();
    await cases.verify(result, measurements, calls);
    console.log('PAK', name);
  } finally { global.fetch = oldFetch; }
}
async function serverTests() {
  let lastMatches=[];
  const source = [row('a'),row('b'), {...row('d'),isDeleted:true},row('orphan','missing','room')];
  const chain = (table)=>({
    select:()=>chain(table), match:(scopeCols)=> {lastMatches.push(scopeCols);return chain(table);},
    order:()=>chain(table), range:async(start,end)=>({data:source.slice(start,end+1),error:null}),
    in:async()=>({data:table==='customers'?[{id:'cust',isDeleted:false}]:[{id:'room',customerId:'cust',isDeleted:false}],error:null})
  });
  const mod = loadTs('src/app/api/measurements/recovery/route.ts',{
    'next/server': { NextResponse:{json:(body,config)=>({body,status:config?.status||200})} },
    '@supabase/supabase-js': { createClient:()=>({from:chain}) },
    '@/lib/authHelper': { verifyAuth:async()=>({id:'u',role:'ADMIN'}) },
    '@/lib/serverErpContext': { loadShadowErpContext:async()=>({ready:true,scope:scope()}) },
    '@/lib/erpActiveScopeCookie': { readRequestedErpScopeId:()=>undefined },
  });
  const prevUrl=process.env.SUPABASE_URL, prevKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL='https://placeholder.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='dummy';
  try {
    const valid=await mod.POST({json:async()=>({offset:0})});
    assert.equal(valid.status,200);
    assert.equal(valid.body.measurements.length,2);
    assert.equal(valid.body.excludedCount,1);
    assert.equal(valid.body.sourceCount,4);
    assert.ok(lastMatches.length>=3);
    for (const s of lastMatches) assert.deepEqual(s,{tenant_id:'t', company_id:'c',branch_id:'b',accounting_period_id:'p'});
    const invalid=await mod.POST({json:async()=>({offset:-100})});
    assert.equal(invalid.status,400);
    console.log('PAK server scoped parent validation and invalid offset');
  } finally {
    if(prevUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=prevUrl;
    if(prevKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=prevKey;
  }
}
(async()=>{
 await serverTests();
 await clientTest('missing ID saved once', {verify:async(result,rows,calls)=>{
   assert.equal(result.success,true);assert.equal(result.recovered,1);assert.equal(calls.inserts,1);assert.ok(rows.has('m1'));
 }});
 await clientTest('same ID never overwritten', {initialMeasurements:[['m1',{id:'m1',version:999,notes:'LOCAL'}]],verify:async(result,rows,calls)=>{
   assert.equal(result.success,true);assert.equal(result.existing,1);assert.equal(calls.inserts,0);assert.equal(rows.get('m1').notes,'LOCAL');
 }});
 await clientTest('concurrent insert race preserves local value', {raceExisting:true,verify:async(result,rows,calls)=>{
   assert.equal(result.success,true);assert.equal(result.recovered,0);assert.equal(result.existing,1);
   assert.equal(rows.get('m1').notes,'CONCURRENT_LOCAL_EDIT');assert.equal(calls.inserts,1);
 }});
 await clientTest('customer missing skips safely', {noCustomer:true,verify:async(result,rows,calls)=>{
   assert.equal(result.success,false);assert.equal(result.unresolved,1);assert.equal(calls.inserts,0);
 }});
 await clientTest('cross-scope response rejected', {pages:[{success:true,sourceCount:1,nextOffset:1,hasMore:false,excludedCount:0,measurements:[{...row('m1'),company_id:'OTHER'}]}],verify:async(result,rows,calls)=>{
   assert.equal(result.success,false);assert.equal(calls.inserts,0);assert.ok(!rows.has('m1'));
 }});
 await clientTest('direct room measurement accepted', {verify:async(result,rows,calls)=>{
   assert.equal(result.success,true);assert.equal(rows.get('m1').openingId,undefined);assert.equal(calls.inserts,1);
 }});
 await clientTest('read failure blocks recovery before network or writes', {readFailure:true,verify:async(result,rows,calls)=>{
   assert.equal(result.success,false);assert.match(result.errors.join(','),/INDEXEDDB_READ_FAILED/);
   assert.equal(calls.recoverRequests,0);assert.equal(calls.inserts,0);assert.equal(calls.parentWrites,0);
 }});
 await clientTest('insert failure never writes parent', {insertFailure:true,verify:async(result,rows,calls)=>{
   assert.equal(result.success,false);assert.equal(calls.parentWrites,0);assert.equal(rows.size,0);
 }});
 await clientTest('parent failure retains measurement for repair', {parentFailure:true,verify:async(result,rows,calls)=>{
   assert.equal(result.success,false);assert.equal(calls.parentWrites,1);
   assert.equal(rows.size,1);assert.equal(rows.get('m1').version,2);
 }});
 await clientTest('previously inserted ID repairs parent without overwrite', {initialMeasurements:[['m1',{...row('m1'),version:999,notes:'LOCAL_EDIT'}]],verify:async(result,rows,calls)=>{
   assert.equal(result.success,true);assert.equal(calls.inserts,0);assert.equal(calls.parentWrites,1);
   assert.equal(rows.get('m1').notes,'LOCAL_EDIT');
 }});
})().catch(e=>{console.error('DUR',e.stack||e);process.exitCode=1});
