/* Atomic recovery insert: execute actual TS function with unique-key Dexie fixture. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = process.env.ENVERP_P0_TYPESCRIPT_MODULE ? require(process.env.ENVERP_P0_TYPESCRIPT_MODULE) : require('typescript');
const root = path.resolve(__dirname,'..');
const file = path.join(root,'src/lib/localMeasurementDb.ts');
const transpiled = ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const rows = new Map();
const table = {
   add: async row=>{ await Promise.resolve(); if(rows.has(row.id)){const e=new Error('key exists');e.name='ConstraintError';throw e;} rows.set(row.id,{...row});return row.id; },
   get: async id=>rows.get(id),
};
class FakeDexie {
  version(){return {stores:()=>{}};}
}
Object.defineProperty(FakeDexie.prototype,'measurements',{get:()=>table,set:()=>{}});
const mod=new Module(file,module);mod.filename=file;
mod.require=(name)=>{
 if(name==='dexie')return {__esModule:true,default:FakeDexie};
 if(name==='./customerTreeScope')return {stripErpScope: x=>x};
 return {};
};
mod._compile(transpiled,file);
mod.exports.localMeasurementDb.measurements = table;
(async()=>{
 const add=mod.exports.addRecoveredLocalMeasurementIfAbsent;
 const first={id:'same',customerId:'c',roomId:'r',openingId:'',windowId:'',notes:'SERVER'};
 const [a,b]=await Promise.all([add(first),add({...first,notes:'OTHER'})]);
 assert.deepEqual([a,b].sort(),['EXISTS','INSERTED']);
 assert.equal(rows.size,1);
 assert.ok(['SERVER','OTHER'].includes(rows.get('same').notes));
 const local=rows.get('same');
 assert.equal(await add({...first,notes:'LATE_SERVER'}),'EXISTS');
 assert.equal(rows.get('same').notes,local.notes);
 await assert.rejects(()=>add({...first,id:''}),/RECOVERY_LOCAL_ID_MISSING/);
 console.log('PAK atomic unique-ID race and no-overwrite');
})().catch(e=>{console.error('DUR',e.stack||e);process.exitCode=1});
