import "fake-indexeddb/auto";

import assert from "node:assert/strict";

import type { ErpScope } from "../src/lib/erpScope";
import {
  activateDeferredMeasurementMutationAfterPredecessor,
  finalizeMeasurementMutationQueueAtomically,
  localSyncQueueDb,
  type DeferredMeasurementMutationResult,
  type SyncEvent,
} from "../src/lib/localSyncQueueDb";

const scope: ErpScope = {
  tenantId: "tenant-successor",
  companyId: "company-successor",
  branchId: "branch-successor",
  accountingPeriodId: "period-successor",
};

const now = "2026-10-06T00:00:00.000Z";

function predecessor(
  changeId: string,
  syncStatus: SyncEvent["syncStatus"] = "PENDING",
): SyncEvent {
  return {
    scope,
    changeId,
    entityType: "MEASUREMENT",
    entityId: "measurement-successor",
    operation: "UPDATE",
    expectedVersion: 1,
    patch: {
      id: "measurement-successor",
      entity: "measurement",
    },
    deviceId: "device-successor",
    userId: "user-successor",
    createdAt: now,
    updatedAt: now,
    syncStatus,
    retryCount: 0,
  };
}

function successor(
  changeId: string,
  blockedByChangeId: string,
): SyncEvent {
  return {
    scope,
    changeId,
    entityType: "MEASUREMENT",
    entityId: "measurement-successor",
    operation: "UPDATE",
    expectedVersion: 0,
    patch: {
      id: "measurement-successor",
      entity: "measurement",
    },
    deviceId: "device-successor",
    userId: "user-successor",
    createdAt: now,
    updatedAt: now,
    syncStatus: "BLOCKED",
    retryCount: 0,
    blockedByChangeId,
    successorReady: false,
  };
}

async function main(): Promise<void> {
  await localSyncQueueDb.pendingSyncEvents.clear();

  const pred = predecessor("pred-1");
  const succ = successor("succ-1", pred.changeId);

  await localSyncQueueDb.pendingSyncEvents.bulkPut([
    pred,
    succ,
  ]);

  const versionJumpRejected =
    await activateDeferredMeasurementMutationAfterPredecessor(
      pred.changeId,
      pred.entityId,
      pred.deviceId,
      3,
      pred.scope,
    );

  assert.equal(
    versionJumpRejected,
    false,
    "successor ACK version must advance exactly one canonical version",
  );

  const ackCaptured =
    await activateDeferredMeasurementMutationAfterPredecessor(
      pred.changeId,
      pred.entityId,
      pred.deviceId,
      2,
      pred.scope,
    );

  assert.equal(
    ackCaptured,
    true,
    "ACK must be captured even when the successor local write is not ready",
  );

  const afterEarlyAck =
    await localSyncQueueDb.pendingSyncEvents.get(
      succ.changeId,
    );

  assert.equal(afterEarlyAck?.syncStatus, "BLOCKED");
  assert.equal(afterEarlyAck?.successorReady, false);
  assert.equal(afterEarlyAck?.successorAckVersion, 2);

  const result: DeferredMeasurementMutationResult = {
    success: true,
    deferred: true,
    changeId: succ.changeId,
    blockedByChangeId: pred.changeId,
    appliedUpdatedAt: now,
  };

  const finalized =
    await finalizeMeasurementMutationQueueAtomically(
      [],
      [
        {
          result,
          canonicalVersion: 1,
        },
      ],
    );

  assert.equal(
    finalized,
    true,
    "ready successor must consume the exact ACK version",
  );

  const activated =
    await localSyncQueueDb.pendingSyncEvents.get(
      succ.changeId,
    );

  assert.equal(activated?.syncStatus, "PENDING");
  assert.equal(activated?.expectedVersion, 2);
  assert.equal(activated?.successorReady, true);

  await localSyncQueueDb.pendingSyncEvents.clear();

  const ackFirstPred =
    predecessor("pred-ack-first");

  await localSyncQueueDb.pendingSyncEvents.put(
    ackFirstPred,
  );

  const ackBeforeSuccessor =
    await activateDeferredMeasurementMutationAfterPredecessor(
      ackFirstPred.changeId,
      ackFirstPred.entityId,
      ackFirstPred.deviceId,
      2,
      ackFirstPred.scope,
    );

  assert.equal(
    ackBeforeSuccessor,
    true,
    "ACK with no successor must still be recorded on the predecessor",
  );

  const predAfterAck =
    await localSyncQueueDb.pendingSyncEvents.get(
      ackFirstPred.changeId,
    );

  assert.equal(
    predAfterAck?.canonicalAckVersion,
    2,
  );

  const lateSuccessor =
    successor(
      "succ-after-ack",
      ackFirstPred.changeId,
    );

  await localSyncQueueDb.pendingSyncEvents.put(
    lateSuccessor,
  );

  const lateFinalized =
    await finalizeMeasurementMutationQueueAtomically(
      [],
      [
        {
          result: {
            success: true,
            deferred: true,
            changeId:
              lateSuccessor.changeId,
            blockedByChangeId:
              ackFirstPred.changeId,
            appliedUpdatedAt: now,
          },
          canonicalVersion: 2,
        },
      ],
    );

  assert.equal(
    lateFinalized,
    true,
    "successor created after ACK must consume predecessor ACK metadata",
  );

  const lateActivated =
    await localSyncQueueDb.pendingSyncEvents.get(
      lateSuccessor.changeId,
    );

  assert.equal(
    lateActivated?.syncStatus,
    "PENDING",
  );
  assert.equal(
    lateActivated?.expectedVersion,
    2,
  );

  await localSyncQueueDb.pendingSyncEvents.clear();

  const conflictPred =
    predecessor("pred-conflict", "CONFLICT");
  const conflictSucc =
    successor("succ-conflict", conflictPred.changeId);

  await localSyncQueueDb.pendingSyncEvents.bulkPut([
    conflictPred,
    conflictSucc,
  ]);

  const conflictReady =
    await finalizeMeasurementMutationQueueAtomically(
      [],
      [
        {
          result: {
            success: true,
            deferred: true,
            changeId: conflictSucc.changeId,
            blockedByChangeId: conflictPred.changeId,
            appliedUpdatedAt: now,
          },
          canonicalVersion: 2,
        },
      ],
    );

  assert.equal(conflictReady, true);

  const blockedAfterConflict =
    await localSyncQueueDb.pendingSyncEvents.get(
      conflictSucc.changeId,
    );

  assert.equal(
    blockedAfterConflict?.syncStatus,
    "BLOCKED",
    "CONFLICT predecessor must never auto-rebase its successor",
  );

  const wrongAck =
    await activateDeferredMeasurementMutationAfterPredecessor(
      "wrong-change-id",
      conflictPred.entityId,
      conflictPred.deviceId,
      2,
      conflictPred.scope,
    );

  assert.equal(
    wrongAck,
    false,
    "wrong predecessor ACK must fail closed",
  );

  await localSyncQueueDb.pendingSyncEvents.clear();

  console.log(
    "PAK_MEASUREMENT_SUCCESSOR_MUTATION_CHAIN",
  );
}

main().catch(async (error) => {
  try {
    await localSyncQueueDb.pendingSyncEvents.clear();
  } catch {}

  console.error(error);
  process.exitCode = 1;
});
