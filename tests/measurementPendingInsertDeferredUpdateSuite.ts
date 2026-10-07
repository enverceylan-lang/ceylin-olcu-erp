import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relative: string): string {
  return fs.readFileSync(
    path.join(root, relative),
    "utf8",
  );
}

function requireText(
  text: string,
  needle: string,
  label: string,
): void {
  if (!text.includes(needle)) {
    throw new Error(`FAIL:${label}`);
  }
}

const queue = read("src/lib/localSyncQueueDb.ts");
const local = read("src/lib/localMeasurementDb.ts");
const delta = read("src/lib/deltaSyncClient.ts");

requireText(
  queue,
  "enqueueDeferredMeasurementUpdateAfterInsert",
  "QUEUE_DEFERRED_ENQUEUE",
);

requireText(
  queue,
  "syncStatus: 'BLOCKED'",
  "DEFERRED_BLOCKED",
);

requireText(
  queue,
  "expectedVersion: 0",
  "DEFERRED_VERSION_ZERO",
);

requireText(
  queue,
  "activateDeferredMeasurementUpdateAfterInsert",
  "DEFERRED_ACTIVATION",
);

requireText(
  queue,
  "validCanonicalSuccessorVersion",
  "CANONICAL_VERSION_ACTIVATION",
);

requireText(
  local,
  "enqueueDeferredMeasurementMutationAfterPredecessor",
  "LOCAL_GENERIC_PREDECESSOR_BRANCH",
);

requireText(
  local,
  "rollbackDeferredMeasurementUpdate",
  "LOCAL_COMPENSATION",
);

requireText(
  local,
  '"MEASUREMENT_EXPECTED_VERSION_MISSING"',
  "FAIL_CLOSED_PRESERVED",
);

requireText(
  delta,
  'pendingEvent.operation === "INSERT" ||',
  "ACK_INSERT_CHAIN",
);

requireText(
  delta,
  'pendingEvent.operation === "UPDATE"',
  "ACK_UPDATE_CHAIN",
);

requireText(
  delta,
  "activateDeferredMeasurementMutationAfterPredecessor",
  "ACK_ACTIVATES_EXACT_SUCCESSOR",
);

requireText(
  queue,
  "blockedByChangeId",
  "SUCCESSOR_LINEAGE",
);

requireText(
  queue,
  "successorReady",
  "SUCCESSOR_LOCAL_WRITE_GATE",
);

requireText(
  queue,
  "successorAckVersion",
  "ACK_BEFORE_LOCAL_WRITE_CAPTURE",
);

requireText(
  queue,
  "canonicalAckVersion",
  "ACK_BEFORE_SUCCESSOR_CAPTURE",
);

requireText(
  queue,
  "terminalConflictPredecessors",
  "TERMINAL_CONFLICT_BLOCKS_NEW_SUCCESSOR",
);

requireText(
  queue,
  "value === predecessorVersion + 1",
  "EXACT_PLUS_ONE_SUCCESSOR_VERSION",
);

requireText(
  queue,
  "enqueueDeferredMeasurementMutationAfterInsert",
  "GENERIC_DEFERRED_MUTATION",
);

requireText(
  queue,
  "activateDeferredMeasurementMutationAfterInsert",
  "GENERIC_DEFERRED_ACTIVATION",
);

requireText(
  queue,
  "['UPDATE', 'SOFT_DELETE']",
  "UPDATE_DELETE_CHAIN",
);

requireText(
  queue,
  "previousOperation",
  "ROLLBACK_RESTORES_OPERATION",
);
console.log(
  "PAK_MEASUREMENT_PENDING_INSERT_DEFERRED_UPDATE_CONTRACT",
);