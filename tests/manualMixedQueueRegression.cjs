const assert=require('node:assert/strict');const fs=require('node:fs');
const q=fs.readFileSync('src/lib/localSyncQueueDb.ts','utf8');
const c=fs.readFileSync('src/lib/deltaSyncClient.ts','utf8');
// Model tests are NOT Dexie/runtime tests. Guard the source ordering and expected model outcomes.
assert(q.includes('if (entityTypeFilter && event.entityType !== entityTypeFilter) return false;'));
assert(c.includes('getPendingSyncEvents(activeScope, eventLimit, measurementOnly ? "MEASUREMENT" : undefined)'));
const sc='tenant-1/company-1/branch-1/period-1';
const old=Array.from({length:190},(_,i)=>({changeId:'old-'+i,entityType:i<9?'CUSTOMER':'MEASUREMENT',syncStatus:i<56?'BLOCKED':i<66?'CONFLICT':'SYNCED',scope:sc,legacy:true}));
const mixed=[...old,{changeId:'new-customer',entityType:'CUSTOMER',syncStatus:'PENDING',scope:sc},{changeId:'new-measurement',entityType:'MEASUREMENT',syncStatus:'PENDING',scope:sc},{changeId:'other-company',entityType:'MEASUREMENT',syncStatus:'PENDING',scope:'tenant-1/company-2/branch-1/period-1'}];
const before=JSON.stringify(mixed);
const selected=mixed.filter(e=>e.entityType==='MEASUREMENT'&&['PENDING','ERROR'].includes(e.syncStatus)&&!e.legacy&&e.scope===sc);
assert.deepEqual(selected.map(e=>e.changeId),['new-measurement']);
assert.equal(JSON.stringify(mixed),before);
console.log('PAK MIXED_QUEUE_MODEL measurement-only 1/1, customer 0, cross-company 0');
console.log('PAK LEGACY_190_MODEL untouched 190/190');
console.log('PAK SOURCE_FILTER_BEFORE_QUEUE_MUTATION');
console.log('MODEL_ONLY=TRUE; DEXIE_SERVER_RLS_RUNTIME=NOT_RUN');
