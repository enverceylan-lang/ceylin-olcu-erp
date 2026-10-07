import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import {
  getPendingSyncEvents,
  localSyncQueueDb,
  type SyncEvent,
} from "../src/lib/localSyncQueueDb";
import type { ErpScope } from "../src/lib/erpScope";

const scope = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  companyId: "22222222-2222-4222-8222-222222222222",
  branchId: "33333333-3333-4333-8333-333333333333",
  accountingPeriodId: "44444444-4444-4444-8444-444444444444",
} as ErpScope;

function measurementEvent(
  changeId: string,
  operation: SyncEvent["operation"],
  expectedVersion?: number,
): SyncEvent {
  const now = new Date().toISOString();
  const entityId = `measurement-${changeId}`;

  const event = {
    scope,
    changeId,
    entityType: "MEASUREMENT",
    entityId,
    operation,
    patch: {
      id: entityId,
      customerId: `customer-${changeId}`,
      roomId: `room-${changeId}`,
      openingId: `opening-${changeId}`,
    },
    deviceId: "legacy-device",
    userId: "legacy-user",
    createdAt: now,
    updatedAt: now,
    syncStatus: "PENDING",
    retryCount: 0,
  } as SyncEvent;

  if (expectedVersion !== undefined) {
    event.expectedVersion = expectedVersion;
  }

  return event;
}

async function main(): Promise<void> {
  await localSyncQueueDb.open();
  await localSyncQueueDb.pendingSyncEvents.clear();

  try {
    await localSyncQueueDb.pendingSyncEvents.bulkPut([
      measurementEvent("legacy-insert-missing", "INSERT"),
      measurementEvent("legacy-update-missing", "UPDATE"),
      measurementEvent("legacy-delete-missing", "SOFT_DELETE"),
      measurementEvent("legacy-insert-invalid", "INSERT", 1),
      measurementEvent("legacy-update-zero", "UPDATE", 0),
      measurementEvent("canonical-insert", "INSERT", 0),
      measurementEvent("canonical-update", "UPDATE", 3),
    ]);

    const sendable = await getPendingSyncEvents(scope, 50);
    const sendableById = new Map(
      sendable.map((event) => [event.changeId, event]),
    );

    assert.equal(
      sendableById.get("legacy-insert-missing")?.expectedVersion,
      0,
      "Legacy INSERT without expectedVersion must normalize to 0",
    );

    assert.equal(
      sendableById.has("canonical-insert"),
      true,
      "Canonical INSERT expectedVersion=0 must remain sendable",
    );

    assert.equal(
      sendableById.has("canonical-update"),
      true,
      "Canonical UPDATE expectedVersion>=1 must remain sendable",
    );

    for (const blockedId of [
      "legacy-update-missing",
      "legacy-delete-missing",
      "legacy-insert-invalid",
      "legacy-update-zero",
    ]) {
      assert.equal(
        sendableById.has(blockedId),
        false,
        `${blockedId} must not become sendable`,
      );

      const persisted =
        await localSyncQueueDb.pendingSyncEvents.get(blockedId);

      assert.equal(
        persisted?.syncStatus,
        "BLOCKED",
        `${blockedId} must fail closed as BLOCKED`,
      );
    }

    const normalized =
      await localSyncQueueDb.pendingSyncEvents.get(
        "legacy-insert-missing",
      );

    assert.equal(
      normalized?.expectedVersion,
      0,
      "Legacy INSERT normalization must persist expectedVersion=0",
    );

    assert.equal(
      normalized?.syncStatus,
      "PENDING",
      "Legacy INSERT normalization must remain sendable",
    );

    console.log(
      "PAK_MEASUREMENT_LEGACY_INSERT_BACKLOG_COMPATIBILITY",
    );
  } finally {
    await localSyncQueueDb.pendingSyncEvents.clear();
    localSyncQueueDb.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});