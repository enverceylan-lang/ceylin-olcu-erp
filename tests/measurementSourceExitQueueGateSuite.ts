import "fake-indexeddb/auto";
import fs from "node:fs";
import path from "node:path";
import {
  getPendingSyncEvents,
  localSyncQueueDb,
  markSyncEventsBlocked,
  markSyncEventsSynced,
  type SyncEvent,
} from "../src/lib/localSyncQueueDb";
import type { ErpScope } from "../src/lib/erpScope";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const root = process.cwd();

const SCOPE_A: ErpScope = {
  tenantId: "tenant-a",
  companyId: "company-a",
  branchId: "branch-a",
  accountingPeriodId: "period-a",
};

const SCOPE_B: ErpScope = {
  tenantId: "tenant-b",
  companyId: "company-b",
  branchId: "branch-b",
  accountingPeriodId: "period-b",
};

function queueEvent(
  changeId: string,
  scope: ErpScope,
  createdAt: string,
  entityType: SyncEvent["entityType"] = "MEASUREMENT",
): SyncEvent {
  return {
    scope,
    changeId,
    entityType,
    entityId: "shared-entity",
    operation: "UPDATE",
    ...(entityType === "MEASUREMENT" ? { expectedVersion: 1 } : {}),
    patch: {
      customerId: "shared-customer",
      roomId: "shared-room",
      openingId: "shared-opening",
    },
    deviceId: "device-1",
    userId: "user-1",
    createdAt,
    updatedAt: createdAt,
    syncStatus: "PENDING",
    retryCount: 0,
  };
}

const page = fs.readFileSync(
  path.join(root, "src", "app", "cariler", "[id]", "page.tsx"),
  "utf8",
);

const db = fs.readFileSync(
  path.join(root, "src", "lib", "localDraftDb.ts"),
  "utf8",
);
const syncService = fs.readFileSync(
  path.join(root, "src", "lib", "syncService.ts"),
  "utf8",
);

assert(
  !page.includes("V1A Queue - Add to sync queue for push"),
  "Cari detayında SOURCE_EXIT öncesi DRAFT enqueue hâlâ var",
);

const createStart = db.indexOf("export async function createMeasurementDraft");
const updateStart = db.indexOf("export async function updateMeasurementDraft");
const installStart = db.indexOf("export async function createInstallationDraft");
const markReadyStart = db.indexOf("export async function markDraftReadyToTransfer");

assert(createStart >= 0 && updateStart > createStart, "createMeasurementDraft bulunamadı");
assert(installStart > updateStart, "updateMeasurementDraft sınırı bulunamadı");
assert(markReadyStart > installStart, "markDraftReadyToTransfer bulunamadı");

const createBlock = db.slice(createStart, updateStart);
const updateBlock = db.slice(updateStart, installStart);
const markReadyBlock = db.slice(markReadyStart);

assert(
  !createBlock.includes("enqueueSyncEvent('DRAFT'"),
  "createMeasurementDraft SOURCE_EXIT öncesi enqueue ediyor",
);

assert(
  !updateBlock.includes("enqueueSyncEvent('DRAFT'"),
  "updateMeasurementDraft SOURCE_EXIT öncesi enqueue ediyor",
);

assert(
  markReadyBlock.includes('"SOURCE_EXIT"'),
  "markDraftReadyToTransfer SOURCE_EXIT doğrulaması içermiyor",
);

const validationIndex = markReadyBlock.indexOf("validateMeasurementTransferTree(");
const enqueueIndex = markReadyBlock.indexOf("enqueueSyncEvent('DRAFT'");

assert(validationIndex >= 0, "SOURCE_EXIT validation bulunamadı");
assert(enqueueIndex > validationIndex, "DRAFT enqueue validation sonrasında olmalı");


assert(
  syncService.includes("const autoSyncCustomers: Customer[]"),
  "Auto-sync customer boundary bulunamadı",
);

assert(
  syncService.includes("rooms: []"),
  "Auto-sync measurement tree kesilmiyor",
);

assert(
  syncService.includes(
    "const sanitizedCustomers = stripMediaAndDataUrls(autoSyncCustomers);"
  ),
  "Auto-sync sanitized payload measurement-tree-free customer kaynağını kullanmıyor",
);

assert(
  !syncService.includes(
    "const sanitizedCustomers = stripMediaAndDataUrls(localCustomers);"
  ),
  "Legacy full customer tree auto-sync payloadı yeniden aktif",
);
async function verifyScopeAwareQueueContract(): Promise<void> {
  await localSyncQueueDb.pendingSyncEvents.clear();

  const scopeBFirst = queueEvent(
    "scope-b-first",
    SCOPE_B,
    "2026-09-19T00:00:00.000Z",
  );
  const scopeASecond = queueEvent(
    "scope-a-second",
    SCOPE_A,
    "2026-09-19T00:00:01.000Z",
  );
  await localSyncQueueDb.pendingSyncEvents.bulkPut([
    scopeBFirst,
    scopeASecond,
  ]);

  const scopeASelected = await getPendingSyncEvents(SCOPE_A, 1);
  assert(
    scopeASelected.length === 1 &&
      scopeASelected[0]?.changeId === scopeASecond.changeId,
    "Active scope partition limitten önce uygulanmıyor",
  );
  assert(
    (await localSyncQueueDb.pendingSyncEvents.get(scopeBFirst.changeId))
      ?.syncStatus === "PENDING",
    "Scope dışı event queue read sırasında değiştirildi",
  );

  await localSyncQueueDb.pendingSyncEvents.clear();
  const diagnosticA = queueEvent(
    "diagnostic-a",
    SCOPE_A,
    "2026-09-19T00:01:00.000Z",
  );
  const diagnosticB = queueEvent(
    "diagnostic-b",
    SCOPE_B,
    "2026-09-19T00:01:01.000Z",
  );
  await localSyncQueueDb.pendingSyncEvents.bulkPut([
    diagnosticA,
    diagnosticB,
  ]);
  const diagnosticRows = await getPendingSyncEvents(100);
  assert(
    diagnosticRows.length === 2,
    "Diagnostic getPendingSyncEvents(100) cross-scope kayıtları korumuyor",
  );

  await localSyncQueueDb.pendingSyncEvents.clear();
  const duplicateOlder = queueEvent(
    "duplicate-older",
    SCOPE_A,
    "2026-09-19T00:02:00.000Z",
  );
  const duplicateNewer = queueEvent(
    "duplicate-newer",
    SCOPE_A,
    "2026-09-19T00:02:01.000Z",
  );
  await localSyncQueueDb.pendingSyncEvents.bulkPut([
    duplicateOlder,
    duplicateNewer,
  ]);
  const compacted = await getPendingSyncEvents(SCOPE_A, 50);
  assert(
    compacted.length === 1 &&
      compacted[0]?.changeId === duplicateNewer.changeId,
    "Same-scope duplicate compaction en yeni eventi seçmiyor",
  );
  assert(
    (await localSyncQueueDb.pendingSyncEvents.get(duplicateOlder.changeId))
      ?.syncStatus === "BLOCKED",
    "Compacted duplicate yanlış biçimde canonical ACK alıyor",
  );

  await localSyncQueueDb.pendingSyncEvents.clear();
  const canonicalA = queueEvent(
    "canonical-a",
    SCOPE_A,
    "2026-09-19T00:03:00.000Z",
  );
  const foreignB = queueEvent(
    "foreign-b",
    SCOPE_B,
    "2026-09-19T00:03:01.000Z",
  );
  const legacyCustomerA = queueEvent(
    "legacy-customer-a",
    SCOPE_A,
    "2026-09-19T00:03:02.000Z",
    "CUSTOMER",
  );
  await localSyncQueueDb.pendingSyncEvents.bulkPut([
    canonicalA,
    foreignB,
    legacyCustomerA,
  ]);
  let invalidAckRejected = false;
  try {
    await markSyncEventsSynced(
      [canonicalA.changeId, foreignB.changeId, legacyCustomerA.changeId],
      SCOPE_A,
    );
  } catch (error) {
    invalidAckRejected =
      error instanceof Error &&
      error.message === "SYNC_ACK_SCOPE_OR_AUTHORITY_MISMATCH";
  }
  assert(invalidAckRejected, "Scope/authority mismatch fail-closed değil");
  assert(
    (await localSyncQueueDb.pendingSyncEvents.get(canonicalA.changeId))
      ?.syncStatus === "PENDING",
    "Mixed-scope ACK atomik olmadan kısmen uygulandı",
  );
  assert(
    (await localSyncQueueDb.pendingSyncEvents.get(foreignB.changeId))
      ?.syncStatus === "PENDING",
    "Scope dışı event SYNCED yapıldı",
  );
  assert(
    (await localSyncQueueDb.pendingSyncEvents.get(legacyCustomerA.changeId))
      ?.syncStatus === "PENDING",
    "Legacy CUSTOMER event canonical ACK aldı",
  );

  await markSyncEventsSynced([canonicalA.changeId], SCOPE_A);
  assert(
    (await localSyncQueueDb.pendingSyncEvents.get(canonicalA.changeId))
      ?.syncStatus === "SYNCED",
    "Canonical same-scope MEASUREMENT ACK uygulanmadı",
  );

  await localSyncQueueDb.pendingSyncEvents.clear();
  const blockableA = queueEvent(
    "blockable-a",
    SCOPE_A,
    "2026-09-19T00:04:00.000Z",
  );
  const blockablePatchBefore = JSON.stringify(blockableA.patch);
  await localSyncQueueDb.pendingSyncEvents.put(blockableA);

  await markSyncEventsBlocked(
    [{ changeId: blockableA.changeId, reason: "PARENT_ROOM_MISSING" }],
    SCOPE_A,
  );

  const blockedA = await localSyncQueueDb.pendingSyncEvents.get(
    blockableA.changeId,
  );
  assert(blockedA, "BLOCKED event silindi");
  assert(blockedA.syncStatus === "BLOCKED", "Event BLOCKED olmadı");
  assert(
    blockedA.blockedReason === "PARENT_ROOM_MISSING",
    "BLOCKED nedeni korunmadı",
  );
  assert(Boolean(blockedA.blockedAt), "BLOCKED zamanı korunmadı");
  assert(
    JSON.stringify(blockedA.patch) === blockablePatchBefore,
    "BLOCKED sırasında event patch değiştirildi",
  );
  const afterBlockPending = await getPendingSyncEvents(SCOPE_A, 50);
  assert(
    !afterBlockPending.some((event) => event.changeId === blockableA.changeId),
    "BLOCKED event sonraki gönderimi yeniden zehirliyor",
  );

  let blockedAckRejected = false;
  try {
    await markSyncEventsSynced([blockableA.changeId], SCOPE_A);
  } catch (error) {
    blockedAckRejected =
      error instanceof Error &&
      error.message === "SYNC_ACK_SCOPE_OR_AUTHORITY_MISMATCH";
  }
  assert(blockedAckRejected, "BLOCKED event SYNCED yapılabildi");
  assert(
    (await localSyncQueueDb.pendingSyncEvents.get(blockableA.changeId))
      ?.syncStatus === "BLOCKED",
    "BLOCKED event ACK denemesinde değiştirildi",
  );

  await localSyncQueueDb.pendingSyncEvents.clear();
  const sameScopeA = queueEvent(
    "same-scope-a",
    SCOPE_A,
    "2026-09-19T00:05:00.000Z",
  );
  const foreignScopeB = queueEvent(
    "foreign-scope-b",
    SCOPE_B,
    "2026-09-19T00:05:01.000Z",
  );
  await localSyncQueueDb.pendingSyncEvents.bulkPut([
    sameScopeA,
    foreignScopeB,
  ]);

  let foreignBlockRejected = false;
  try {
    await markSyncEventsBlocked(
      [
        { changeId: sameScopeA.changeId, reason: "PARENT_OPENING_MISSING" },
        { changeId: foreignScopeB.changeId, reason: "PARENT_ROOM_MISSING" },
      ],
      SCOPE_A,
    );
  } catch (error) {
    foreignBlockRejected =
      error instanceof Error &&
      error.message === "SYNC_BLOCK_SCOPE_OR_AUTHORITY_MISMATCH";
  }
  assert(foreignBlockRejected, "Foreign scope event BLOCKED edilebildi");
  assert(
    (await localSyncQueueDb.pendingSyncEvents.get(sameScopeA.changeId))
      ?.syncStatus === "PENDING",
    "Mixed-scope BLOCK atomik olmadan kısmen uygulandı",
  );
  assert(
    (await localSyncQueueDb.pendingSyncEvents.get(foreignScopeB.changeId))
      ?.syncStatus === "PENDING",
    "Foreign scope event değiştirildi",
  );
}

verifyScopeAwareQueueContract()
  .then(() => {
    console.log("[PASS] measurementSourceExitQueueGateSuite completed");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
