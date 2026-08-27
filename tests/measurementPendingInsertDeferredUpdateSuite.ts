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
  "expectedVersion: canonicalVersion",
  "CANONICAL_VERSION_ACTIVATION",
);

requireText(
  local,
  "existingMeasurement && !hasCanonicalVersion",
  "LOCAL_PENDING_INSERT_BRANCH",
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
  'pendingEvent.operation === "INSERT"',
  "ACK_INSERT_ONLY",
);

requireText(
  delta,
  "activateDeferredMeasurementUpdateAfterInsert",
  "ACK_ACTIVATES_DEFERRED",
);

console.log(
  "PAK_MEASUREMENT_PENDING_INSERT_DEFERRED_UPDATE_CONTRACT",
);