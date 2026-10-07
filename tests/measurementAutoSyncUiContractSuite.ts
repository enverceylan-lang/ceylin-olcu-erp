import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(
    path.join(process.cwd(), relativePath),
    "utf8",
  );

const syncService = read("src/lib/syncService.ts");
const topbar = read("src/components/Topbar.tsx");
const olculer = read("src/app/olculer/page.tsx");
const measurementStore = read("src/store/measurementStore.ts");
const cari = read("src/app/cariler/[id]/page.tsx");
const workspace = read(
  "src/components/measurements/CustomerMeasurementsWorkspace.tsx",
);
const tabs = read("src/components/CariCustomerTabsNav.tsx");
const draftDb = read("src/lib/localDraftDb.ts");

assert.match(
  syncService,
  /pushDeltaSyncEvents[\s\S]*pullInboundMeasurements/,
  "central syncService must own measurement push + pull",
);
assert.match(
  syncService,
  /MEASUREMENT_SYNC_REQUEST_EVENT[\s\S]*enverp:measurement-sync-request/,
);
assert.match(
  syncService,
  /getPendingSyncEvents[\s\S]*BLOCKED[\s\S]*CONFLICT/,
  "Güncel must not ignore pending or terminal measurement queue state",
);
assert.match(
  syncService,
  /visibilitychange[\s\S]*background-interval/,
  "measurement sync must resume automatically while app is active",
);

assert.match(
  measurementStore,
  /enverp:measurement-sync-request/,
  "successful local measurement commits must request transport",
);
assert.match(
  measurementStore,
  /batchUpsertMeasurements:/,
  "inbound batch upsert remains a separate path",
);

assert.doesNotMatch(topbar, /Ölçüleri Gönder/);
assert.doesNotMatch(topbar, /handleManualPush/);
assert.doesNotMatch(topbar, /pushDeltaSyncEvents/);
assert.match(topbar, /✓ Güncel/);
assert.match(topbar, /↻ Senkronlanıyor…/);
assert.match(topbar, /☁ Çevrimdışı/);
assert.match(topbar, /⚠ Senkron bekliyor/);

assert.doesNotMatch(olculer, /Gelen Ölçüleri Al/);
assert.doesNotMatch(olculer, /handlePullInbound/);
assert.doesNotMatch(olculer, /pullInboundMeasurements/);
assert.match(
  olculer,
  /enverp:measurement-sync-complete/,
  "Ölçüler page must refresh as a consumer of central automatic sync",
);

assert.match(cari, />\s*Ölçüleri Kaydet\s*</);
assert.match(workspace, />\s*Ölçüler\s*</);
assert.match(workspace, />\s*Yeni Ölçü\s*</);
assert.match(workspace, />\s*Odalar ve Ölçüler\s*</);
assert.doesNotMatch(workspace, /ROOM → MEASUREMENT/);
assert.match(tabs, />\s*Odalar ve Ölçüler\s*</);
assert.match(tabs, />\s*Cari İş Akışı\s*</);

assert.doesNotMatch(
  draftDb,
  /Şimdi Ölçüleri Gönder butonuna basabilirsiniz/,
);

console.log(
  "PASS measurementAutoSyncUiContractSuite: save is the user action; measurement transport is automatic and centrally coordinated",
);