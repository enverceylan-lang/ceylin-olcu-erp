import assert from "node:assert/strict";
import fs from "node:fs";

const sql = fs.readFileSync(
  "docs/sql/20260822_measurement_authority_v1.sql",
  "utf8",
);
const gateway = fs.readFileSync(
  "src/lib/serverMeasurementAuthority.ts",
  "utf8",
);
const delta = fs.readFileSync(
  "src/app/api/delta-sync/push/route.ts",
  "utf8",
);
const queue = fs.readFileSync(
  "src/lib/localSyncQueueDb.ts",
  "utf8",
);
const localMeasurement = fs.readFileSync(
  "src/lib/localMeasurementDb.ts",
  "utf8",
);
const deltaClient = fs.readFileSync(
  "src/lib/deltaSyncClient.ts",
  "utf8",
);

assert.ok(sql.includes("v_current_is_deleted boolean;"));
assert.ok(sql.includes('m."isDeleted",'));
assert.ok(sql.includes("MEASUREMENT_ALREADY_SOFT_DELETED"));

assert.ok(gateway.includes("/^MEASUREMENT_[A-Z0-9_]+$/"));
assert.ok(gateway.includes("MEASUREMENT_AUTHORITY_RPC_FAILED"));
assert.ok(delta.includes("const publicError ="));
assert.ok(delta.includes("/^MEASUREMENT_[A-Z0-9_]+$/"));

assert.ok(queue.includes("createdNew?: boolean;"));
assert.ok(queue.includes("initialSyncStatus"));
assert.ok(queue.includes("syncStatus: initialSyncStatus"));
assert.ok(queue.includes("activateBlockedSyncEvent"));
assert.ok(queue.includes("discardBlockedSyncEvent"));

assert.ok(localMeasurement.includes("'BLOCKED'"));
assert.ok(localMeasurement.includes("MEASUREMENT_SYNC_QUEUE_CREATE_FAILED"));
assert.ok(localMeasurement.includes("MEASUREMENT_SYNC_QUEUE_ACTIVATION_FAILED"));
assert.ok(localMeasurement.includes("MEASUREMENT_SYNC_COMPENSATION_FAILED"));
assert.ok(localMeasurement.includes("getLocalMeasurementById"));

assert.ok(deltaClient.includes("getLocalMeasurementById"));
assert.ok(
  deltaClient.includes("await getLocalMeasurementById(entityId)"),
);

console.log("PAK_MEASUREMENT_AUTHORITY_FOUR_RISK_HARDENING_SOURCE_SUITE");