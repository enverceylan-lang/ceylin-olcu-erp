const fs = require('node:fs');
const assert = require('node:assert/strict');
const read = p=>fs.readFileSync(p,'utf8');
const s=read('src/lib/syncService.ts');const c=read('src/lib/deltaSyncClient.ts');const q=read('src/lib/localSyncQueueDb.ts');const top=read('src/components/Topbar.tsx');const page=read('src/app/olculer/page.tsx');
const checks=[
 ['manual push button',()=>assert.match(top,/Ölçüleri Gönder/)],
 ['manual pull button',()=>assert.match(page,/Gelen Ölçüleri Al/)],
 ['no measurement timer',()=>assert.doesNotMatch(s,/measurementInterval|background-interval/)],
 ['no automatic measurement dispatch',()=>assert.doesNotMatch(s,/requestMeasurementAutoSync\(/)],
 ['directional manual functions',()=>{assert.match(s,/direction === 'push'/);assert.match(page,/requestMeasurementManualSync\('pull'\)/);}],
 ['customer sync preserved',()=>assert.match(s,/syncNow\(\)/)],
 ['legacy cutover retained',()=>assert.match(q,/ensureMeasurementCutover/)],
 ['version ACK retained',()=>assert.match(c,/markSyncEventsSynced\(safeSyncedIds, activeScope\)/)],
 ['cursor fail-closed retained',()=>assert.match(c,/!measurementCursorAdvanceBlocked && maxMeasurementRevision/)],
 ['authorization path retained',()=>assert.match(read('src/app/api/delta-sync/push/route.ts'),/persistMeasurementAuthorityCommand/)],
 ['scope error retained',()=>assert.match(read('src/app/api/delta-sync/push/route.ts'),/ERP_SCOPE_MISMATCH/)],
 ['manual sends measurement only',()=>{assert.match(s,/pushMeasurementSyncEvents\(\)/);assert.match(c,/export async function pushMeasurementSyncEvents/);assert.match(c,/measurementOnly \? \"MEASUREMENT\" : undefined/);}],
 ['filter before any queue mutations',()=>{const start=q.indexOf('const scopePartitionedEvents = retryableEvents.filter');const end=q.indexOf('const legacyInsertNormalizationIds',start);assert(start>0&&end>start);assert(q.slice(start,end).includes('entityTypeFilter && event.entityType !== entityTypeFilter'));assert(q.indexOf('const invalidScopeChangeIds')<start);assert(q.indexOf('const legacyInsertNormalizationIds')>q.indexOf('entityTypeFilter && event.entityType !== entityTypeFilter'));}],
 ['scope check before send',()=>assert.match(c,/erpScopeMatches\(event\.scope, activeScope\)/)],
 ['parent customer and room fail closed',()=>{assert.match(c,/MEASUREMENT_PARENT_CUSTOMER_LOCAL_MISSING/);assert.match(c,/MEASUREMENT_PARENT_ID_MISSING/);assert.match(c,/PARENT_ROOM_MISSING/);}],
 ['cross-company server rejects',()=>assert.match(read('src/app/api/delta-sync/push/route.ts'),/ERP_SCOPE_MISMATCH/)],
 ['mode conflicting in-flight rejects',()=>assert.match(c,/DELTA_PUSH_MODE_CONFLICT/)],
 ['measurement retry excludes nonmeasurement',()=>assert.match(q,/entityTypeFilter && event.entityType !== entityTypeFilter/)],
 ['legacy 190 records never forcibly marked synced',()=>{assert.match(q,/legacyMeasurementIds/);assert.match(q,/if \(event\.entityType === 'MEASUREMENT' && legacyIds\.has\(event\.changeId\)\) return false/);}],
];
let pass=0,fail=[];
for(const [name,fn] of checks){try{fn();++pass;console.log('PAK '+name)}catch(e){fail.push(name);console.log('DUR '+name)}}
console.log(`RESULT=${fail.length?'DUR':'PAK'} PASS=${pass} FAIL=${fail.length} FAILURES=${fail.join(';')}`);
process.exitCode=fail.length?1:0;
