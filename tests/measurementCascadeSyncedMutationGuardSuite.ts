import "fake-indexeddb/auto";

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { ErpScope } from "../src/lib/erpScope";
import { localCustomerDb } from "../src/lib/localCustomerDb";
import {
  deleteLocalMeasurementsWithSync,
  localMeasurementDb,
} from "../src/lib/localMeasurementDb";
import {
  activateBlockedSyncEventsAtomically,
  localSyncQueueDb,
  type SyncEvent,
} from "../src/lib/localSyncQueueDb";
import {
  applyInboundMeasurementSoftDelete,
  shouldOverwriteMeasurement,
} from "../src/lib/deltaSyncClient";
import {
  canMutateSyncedMeasurement,
} from "../src/lib/measurement/measurementPermissionCatalog";
import {
  useMeasurementStore,
  type MeasurementRecord,
} from "../src/store/measurementStore";
import type { Customer } from "../src/store/useStore";

const root = process.cwd();

const SCOPE: ErpScope = {
  tenantId: "tenant-cascade",
  companyId: "company-cascade",
  branchId: "branch-cascade",
  accountingPeriodId: "period-cascade",
};

function makeCustomer(): Customer {
  return {
    ...SCOPE,
    id: "customer-cascade",
    name: "CASCADE TEST",
    phone: "",
    address: "",
    mapLocation: "",
    notes: "",
    rooms: [
      {
        id: "room-cascade",
        name: "Salon",
        photos: [],
        videos: [],
        windows: [
          {
            id: "opening-cascade",
            name: "Pencere",
            photos: [],
            videos: [],
            products: [],
          },
        ],
      },
    ],
  } as Customer;
}

function makeMeasurement(
  id: string,
  version: number | undefined,
  openingId: string | undefined = "opening-cascade",
): MeasurementRecord {
  return {
    id,
    customerId: "customer-cascade",
    roomId: "room-cascade",
    ...(openingId
      ? {
          openingId,
          windowId: openingId,
        }
      : {}),
    templateType: "SIMPLE_WIDTH_HEIGHT",
    rawValues: {
      width: 120,
      height: 220,
    },
    notes: "",
    status: "MEASURED",
    measuredBy: "TEST",
    measuredDate: "2026-10-03T00:00:00.000Z",
    notesHistory: [],
    photos: [],
    videos: [],
    version,
    createdAt: "2026-10-03T00:00:00.000Z",
    updatedAt: "2026-10-03T00:00:00.000Z",
  } as MeasurementRecord;
}

function blockedEvent(
  changeId: string,
  entityId: string,
): SyncEvent {
  return {
    scope: SCOPE,
    changeId,
    entityType: "MEASUREMENT",
    entityId,
    operation: "SOFT_DELETE",
    expectedVersion: 1,
    patch: {
      ...SCOPE,
      id: entityId,
      customerId: "customer-cascade",
      roomId: "room-cascade",
      openingId: "opening-cascade",
      windowId: "opening-cascade",
      isDeleted: true,
    },
    deviceId: "server",
    userId: "user-1",
    createdAt: "2026-10-03T00:00:00.000Z",
    updatedAt: "2026-10-03T00:00:00.000Z",
    syncStatus: "BLOCKED",
    retryCount: 0,
  };
}

async function resetLocalState(): Promise<void> {
  await localSyncQueueDb.pendingSyncEvents.clear();
  await localMeasurementDb.measurements.clear();
  await localCustomerDb.customers.clear();
  useMeasurementStore.setState({
    measurements: [],
    isLoading: false,
  });
  await localCustomerDb.customers.put(makeCustomer());
}

async function queueAtomicActivationContract(): Promise<void> {
  await resetLocalState();

  const first = blockedEvent("change-a", "measurement-a");
  const second = blockedEvent("change-b", "measurement-b");
  await localSyncQueueDb.pendingSyncEvents.bulkPut([
    first,
    second,
  ]);

  const activated =
    await activateBlockedSyncEventsAtomically([
      first.changeId,
      second.changeId,
    ]);

  assert.equal(activated, true);
  assert.equal(
    (await localSyncQueueDb.pendingSyncEvents.get(first.changeId))
      ?.syncStatus,
    "PENDING",
  );
  assert.equal(
    (await localSyncQueueDb.pendingSyncEvents.get(second.changeId))
      ?.syncStatus,
    "PENDING",
  );

  await localSyncQueueDb.pendingSyncEvents.clear();
  await localSyncQueueDb.pendingSyncEvents.put(first);
  const invalid = {
    ...second,
    syncStatus: "ERROR" as const,
  };
  await localSyncQueueDb.pendingSyncEvents.put(invalid);

  const rejected =
    await activateBlockedSyncEventsAtomically([
      first.changeId,
      invalid.changeId,
    ]);

  assert.equal(rejected, false);
  assert.equal(
    (await localSyncQueueDb.pendingSyncEvents.get(first.changeId))
      ?.syncStatus,
    "BLOCKED",
    "Mixed-status batch partially activated",
  );
  assert.equal(
    (await localSyncQueueDb.pendingSyncEvents.get(invalid.changeId))
      ?.syncStatus,
    "ERROR",
  );

  console.log("[PASS] queueAtomicActivationContract");
}

async function syncedCascadeBatchContract(): Promise<void> {
  await resetLocalState();

  const first = makeMeasurement("measurement-a", 3);
  const second = makeMeasurement("measurement-b", 7);
  await localMeasurementDb.measurements.bulkPut([
    first,
    second,
  ]);

  const deleted =
    await deleteLocalMeasurementsWithSync(
      [first.id, second.id],
      "ADMIN",
      "ROOM_CASCADE",
    );

  assert.equal(deleted.length, 2);
  assert.equal(
    (await localMeasurementDb.measurements.get(first.id))
      ?.isDeleted,
    true,
  );
  assert.equal(
    (await localMeasurementDb.measurements.get(second.id))
      ?.isDeleted,
    true,
  );

  const queued =
    await localSyncQueueDb.pendingSyncEvents.toArray();

  assert.equal(queued.length, 2);
  assert.deepEqual(
    queued.map((event) => event.expectedVersion).sort(),
    [3, 7],
  );
  assert.ok(
    queued.every(
      (event) =>
        event.entityType === "MEASUREMENT" &&
        event.operation === "SOFT_DELETE" &&
        event.syncStatus === "PENDING",
    ),
  );

  console.log("[PASS] syncedCascadeBatchContract");
}

async function invalidVersionFailsClosed(): Promise<void> {
  await resetLocalState();

  const invalid = makeMeasurement(
    "measurement-invalid-version",
    undefined,
  );
  await localMeasurementDb.measurements.put(invalid);

  await assert.rejects(
    () =>
      deleteLocalMeasurementsWithSync(
        [invalid.id],
        "ADMIN",
        "OPENING_CASCADE",
      ),
    /MEASUREMENT_EXPECTED_VERSION_MISSING/,
  );

  assert.equal(
    (await localMeasurementDb.measurements.get(invalid.id))
      ?.isDeleted,
    undefined,
  );
  assert.equal(
    await localSyncQueueDb.pendingSyncEvents.count(),
    0,
  );

  console.log("[PASS] invalidVersionFailsClosed");
}


async function enqueueFailureLeavesLocalUntouched(): Promise<void> {
  await resetLocalState();

  const measurement = makeMeasurement(
    "measurement-enqueue-failure",
    2,
  );
  await localMeasurementDb.measurements.put(measurement);

  const queueTable = localSyncQueueDb.pendingSyncEvents as unknown as {
    put: (...args: unknown[]) => Promise<unknown>;
  };
  const originalPut = queueTable.put.bind(
    localSyncQueueDb.pendingSyncEvents,
  );

  queueTable.put = async () => {
    throw new Error("TEST_QUEUE_PUT_FAILURE");
  };

  try {
    await assert.rejects(
      () =>
        deleteLocalMeasurementsWithSync(
          [measurement.id],
          "ADMIN",
          "ROOM_CASCADE",
        ),
      /MEASUREMENT_CASCADE_SYNC_QUEUE_CREATE_FAILED/,
    );
  } finally {
    queueTable.put = originalPut;
  }

  assert.equal(
    (await localMeasurementDb.measurements.get(measurement.id))
      ?.isDeleted,
    undefined,
  );
  assert.equal(
    await localSyncQueueDb.pendingSyncEvents.count(),
    0,
  );

  console.log("[PASS] enqueueFailureLeavesLocalUntouched");
}

async function localBulkFailureCleansBlockedEvents(): Promise<void> {
  await resetLocalState();

  const measurement = makeMeasurement(
    "measurement-local-bulk-failure",
    2,
  );
  await localMeasurementDb.measurements.put(measurement);

  const measurementTable =
    localMeasurementDb.measurements as unknown as {
      bulkPut: (...args: unknown[]) => Promise<unknown>;
    };
  const originalBulkPut = measurementTable.bulkPut.bind(
    localMeasurementDb.measurements,
  );

  measurementTable.bulkPut = async () => {
    throw new Error("TEST_LOCAL_BULK_FAILURE");
  };

  try {
    await assert.rejects(
      () =>
        deleteLocalMeasurementsWithSync(
          [measurement.id],
          "ADMIN",
          "ROOM_CASCADE",
        ),
      /TEST_LOCAL_BULK_FAILURE/,
    );
  } finally {
    measurementTable.bulkPut = originalBulkPut;
  }

  assert.equal(
    (await localMeasurementDb.measurements.get(measurement.id))
      ?.isDeleted,
    undefined,
  );
  assert.equal(
    await localSyncQueueDb.pendingSyncEvents.count(),
    0,
  );

  console.log("[PASS] localBulkFailureCleansBlockedEvents");
}

async function activationFailureRestoresOriginals(): Promise<void> {
  await resetLocalState();

  const measurement = makeMeasurement(
    "measurement-activation-failure",
    2,
  );
  await localMeasurementDb.measurements.put(measurement);

  const queueTable = localSyncQueueDb.pendingSyncEvents as unknown as {
    bulkUpdate: (...args: unknown[]) => Promise<number>;
  };
  const originalBulkUpdate = queueTable.bulkUpdate.bind(
    localSyncQueueDb.pendingSyncEvents,
  );

  queueTable.bulkUpdate = async () => 0;

  try {
    await assert.rejects(
      () =>
        deleteLocalMeasurementsWithSync(
          [measurement.id],
          "ADMIN",
          "ROOM_CASCADE",
        ),
      /MEASUREMENT_SYNC_QUEUE_ACTIVATION_FAILED/,
    );
  } finally {
    queueTable.bulkUpdate = originalBulkUpdate;
  }

  assert.equal(
    (await localMeasurementDb.measurements.get(measurement.id))
      ?.isDeleted,
    undefined,
  );
  assert.equal(
    await localSyncQueueDb.pendingSyncEvents.count(),
    0,
  );

  console.log("[PASS] activationFailureRestoresOriginals");
}

async function unsyncedCascadePreservesLocalOnlyBehavior(): Promise<void> {
  await resetLocalState();

  const unsynced = makeMeasurement(
    "measurement-unsynced",
    undefined,
  );
  await localMeasurementDb.measurements.put(unsynced);
  useMeasurementStore.setState({
    measurements: [unsynced],
    isLoading: false,
  });

  const count = await useMeasurementStore
    .getState()
    .cascadeDeleteRoom(
      unsynced.customerId,
      unsynced.roomId,
      "ADMIN",
    );

  assert.equal(count, 1);
  assert.equal(
    (await localMeasurementDb.measurements.get(unsynced.id))
      ?.isDeleted,
    true,
  );
  assert.equal(
    await localSyncQueueDb.pendingSyncEvents.count(),
    0,
  );

  console.log("[PASS] unsyncedCascadePreservesLocalOnlyBehavior");
}

async function crossDeviceSoftDeleteContract(): Promise<void> {
  await resetLocalState();

  const existing = makeMeasurement(
    "measurement-cross-device",
    4,
    undefined,
  );
  await localMeasurementDb.measurements.put(existing);
  useMeasurementStore.setState({
    measurements: [existing],
    isLoading: false,
  });

  const canonicalDelete: MeasurementRecord = {
    ...existing,
    version: 5,
    isDeleted: true,
    deletedAt: "2026-10-03T01:00:00.000Z",
    updatedAt: "2026-10-03T01:00:00.000Z",
  };

  const outcome =
    await applyInboundMeasurementSoftDelete(
      canonicalDelete,
    );

  assert.equal(outcome, "APPLIED");
  assert.equal(
    (await localMeasurementDb.measurements.get(existing.id))
      ?.isDeleted,
    true,
  );
  assert.equal(
    useMeasurementStore
      .getState()
      .measurements.find(
        (measurement) => measurement.id === existing.id,
      )
      ?.isDeleted,
    true,
  );

  const persistedDelete =
    await localMeasurementDb.measurements.get(existing.id);
  assert.ok(persistedDelete);

  const staleActiveUpdate: MeasurementRecord = {
    ...existing,
    version: 4,
    isDeleted: false,
    updatedAt: "2026-10-03T02:00:00.000Z",
  };

  const resurrectionCheck =
    shouldOverwriteMeasurement(
      persistedDelete,
      staleActiveUpdate,
    );

  assert.equal(
    resurrectionCheck.shouldOverwrite,
    false,
    "Older active update could resurrect a canonical tombstone",
  );

  console.log("[PASS] crossDeviceSoftDeleteContract");
}

function permissionAndSourceContracts(): void {
  assert.equal(
    canMutateSyncedMeasurement({
      role: "ADMIN",
      permissions: [],
    }),
    true,
  );
  assert.equal(
    canMutateSyncedMeasurement({
      role: "FIELD",
      permissions: [],
    }),
    false,
  );
  assert.equal(
    canMutateSyncedMeasurement({
      role: "FIELD",
      permissions: ["measurement.synced.mutate"],
    }),
    true,
  );

  const page = fs.readFileSync(
    path.join(
      root,
      "src",
      "app",
      "cariler",
      "[id]",
      "page.tsx",
    ),
    "utf8",
  );
  const store = fs.readFileSync(
    path.join(root, "src", "store", "measurementStore.ts"),
    "utf8",
  );
  const delta = fs.readFileSync(
    path.join(root, "src", "lib", "deltaSyncClient.ts"),
    "utf8",
  );
  const local = fs.readFileSync(
    path.join(root, "src", "lib", "localMeasurementDb.ts"),
    "utf8",
  );

  assert.match(
    page,
    /hasSyncedMeasurements[\s\S]*MEASUREMENT_SYNCED_MUTATION_FORBIDDEN[\s\S]*cascadeDeleteRoom/,
  );
  assert.match(
    page,
    /hasSyncedMeasurements[\s\S]*MEASUREMENT_SYNCED_MUTATION_FORBIDDEN[\s\S]*cascadeDeleteOpening/,
  );
  assert.match(
    store,
    /deleteLocalMeasurementsWithSync[\s\S]*OPENING_CASCADE/,
  );
  assert.match(
    store,
    /deleteLocalMeasurementsWithSync[\s\S]*ROOM_CASCADE/,
  );
  assert.match(
    local,
    /enqueueSyncEventDetailed\([\s\S]*'SOFT_DELETE'[\s\S]*'BLOCKED'/,
  );
  assert.match(
    local,
    /activateBlockedSyncEventsAtomically/,
  );
  assert.match(
    delta,
    /event\.operation === "SOFT_DELETE"[\s\S]*packagedEvents\.push\(event\)/,
  );
  assert.match(
    delta,
    /change\.operation === "SOFT_DELETE"[\s\S]*applyInboundMeasurementSoftDelete/,
  );
  assert.match(
    delta,
    /measurementCursorAdvanceBlocked = true/,
  );

  console.log("[PASS] permissionAndSourceContracts");
}

async function main(): Promise<void> {
  permissionAndSourceContracts();
  await queueAtomicActivationContract();
  await syncedCascadeBatchContract();
  await invalidVersionFailsClosed();
  await enqueueFailureLeavesLocalUntouched();
  await localBulkFailureCleansBlockedEvents();
  await activationFailureRestoresOriginals();
  await unsyncedCascadePreservesLocalOnlyBehavior();
  await crossDeviceSoftDeleteContract();
  console.log(
    "PAK_MEASUREMENT_CASCADE_SYNCED_MUTATION_GUARD",
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
