import assert from "node:assert/strict";
import fs from "node:fs";

const local = fs.readFileSync(
  "src/lib/localMeasurementDb.ts",
  "utf8",
);
const queue = fs.readFileSync(
  "src/lib/localSyncQueueDb.ts",
  "utf8",
);

assert.match(
  local,
  /const hasCanonicalVersion[\s\S]*?enqueueDeferredMeasurementMutationAfterInsert\([\s\S]*?'SOFT_DELETE'/,
  "missing-version delete must defer behind unresolved INSERT",
);

assert.match(
  local,
  /throw new Error\("MEASUREMENT_EXPECTED_VERSION_MISSING"\)/,
  "missing version must still fail closed when no unresolved INSERT exists",
);

assert.match(
  queue,
  /existingDeferred\.operation === 'SOFT_DELETE'[\s\S]*?operation === 'UPDATE'[\s\S]*?return \{ success: false \}/,
  "delete is terminal intent and cannot be overwritten by a later deferred update",
);

assert.match(
  queue,
  /operation:\s*result\.previousOperation/,
  "compensation must restore the previous deferred operation",
);

assert.match(
  queue,
  /expectedVersion:\s*canonicalVersion[\s\S]*?syncStatus:\s*'PENDING'/,
  "deferred delete/update must activate only after INSERT ACK supplies canonical version",
);

console.log(
  "PAK_MEASUREMENT_PENDING_INSERT_DEFERRED_DELETE_CONTRACT",
);
