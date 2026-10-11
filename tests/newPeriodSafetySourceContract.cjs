const fs = require('fs');
const assert = require('assert');
const path = require('path');
const root = path.resolve(__dirname,'..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const sync = read('src/lib/syncService.ts');
const db = read('src/lib/localSyncQueueDb.ts');
const pwa = read('src/components/PWAController.tsx');
const api = read('src/app/api/sync/customers/route.ts');
const tests = [
 ['only coordinator writes sync status',()=> { const direct=[...sync.matchAll(/\.setSyncStatus\(/g)].length; assert.strictEqual(direct,5); }],
 ['disabled cloud never reports synced',()=>assert(!/CLOUD_SYNC_DISABLED[\s\S]{0,170}setSyncStatus\('synced'\)/.test(sync))],
 ['customer ack validated before merge',()=>assert(sync.indexOf('Customer acceptance is incomplete')<sync.indexOf('const getCounts ='))],
 ['server sends acceptance counts',()=>assert(/accepted: localCustomers.length/.test(api))],
 ['legacy measurement events tracked in durable Dexie table',()=>assert(/legacyMeasurementIds: 'changeId'/.test(db))],
 ['cutover before measurement queue enqueue',()=>assert(/entityType === 'MEASUREMENT'\) await ensureMeasurementCutover\(\)/.test(db))],
 ['update activation gated on unsent work',()=>assert(pwa.indexOf('const events = await localSyncQueueDb.pendingSyncEvents.toArray()')<pwa.indexOf('waitingWorker.postMessage'))],
 ['unsolicited worker takeover does not force refresh',()=>assert(/enverp-safe-update-approved/.test(pwa))],
];
let failures=0;
for(const [name,fn] of tests){try{fn();console.log('PAK '+name)}catch(e){failures++;console.error('DUR '+name+' '+e.message)}}
console.log(`SOURCE_CONTRACT=${tests.length-failures}/${tests.length}`);
process.exitCode=failures?1:0;
