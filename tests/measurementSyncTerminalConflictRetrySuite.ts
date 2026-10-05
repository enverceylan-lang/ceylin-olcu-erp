import "fake-indexeddb/auto";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  getPendingSyncEvents,
  localSyncQueueDb,
  markSyncEventsConflict,
  markSyncEventsError,
} from "../src/lib/localSyncQueueDb";

const scope = {
  tenantId: "tenant-terminal-conflict-test",
  companyId: "company-terminal-conflict-test",
  branchId: "branch-terminal-conflict-test",
  accountingPeriodId: "period-terminal-conflict-test",
};

function event(
  changeId: string,
  syncStatus: "PENDING" | "ERROR" | "CONFLICT",
  entityId: string,
) {
  const now = "2026-10-04T12:00:00.000Z";

  return {
    scope,
    changeId,
    entityType: "MEASUREMENT" as const,
    entityId,
    operation: "UPDATE" as const,
    expectedVersion: 1,
    patch: {
      ...scope,
      id: entityId,
      customerId: "customer-terminal-conflict-test",
      roomId: "room-terminal-conflict-test",
      entity: "measurement",
      data: {
        id: entityId,
        customerId: "customer-terminal-conflict-test",
        roomId: "room-terminal-conflict-test",
      },
      marker: changeId,
    },
    deviceId: "device-terminal-conflict-test",
    userId: "user-terminal-conflict-test",
    createdAt: now,
    updatedAt: now,
    syncStatus,
    retryCount: 0,
  };
}

async function main() {
  await localSyncQueueDb.pendingSyncEvents.clear();

  await localSyncQueueDb.pendingSyncEvents.bulkPut([
    event("chg-stale", "PENDING", "measurement-stale"),
    event("chg-transient", "PENDING", "measurement-transient"),
    event("chg-pending", "PENDING", "measurement-pending"),
  ]);

  await markSyncEventsConflict(
    ["chg-stale"],
    "MEASUREMENT_STALE_VERSION",
  );
  await markSyncEventsError(
    ["chg-transient"],
    "MEASUREMENT_AUTHORITY_RPC_FAILED",
  );

  const storedConflict =
    await localSyncQueueDb.pendingSyncEvents.get("chg-stale");

  assert.equal(storedConflict?.syncStatus, "CONFLICT");
  assert.equal(
    storedConflict?.lastErrorCode,
    "MEASUREMENT_STALE_VERSION",
  );

  const sendable = await getPendingSyncEvents(50);
  const sendableIds = sendable.map((item) => item.changeId).sort();

  assert.deepEqual(
    sendableIds,
    ["chg-pending", "chg-transient"],
    "terminal conflict must be excluded while transient ERROR remains retryable",
  );

  const conflictAfterRead =
    await localSyncQueueDb.pendingSyncEvents.get("chg-stale");
  const transientAfterRead =
    await localSyncQueueDb.pendingSyncEvents.get("chg-transient");

  assert.equal(conflictAfterRead?.syncStatus, "CONFLICT");
  assert.equal(
    conflictAfterRead?.lastErrorCode,
    "MEASUREMENT_STALE_VERSION",
  );
  assert.equal(
    transientAfterRead?.syncStatus,
    "PENDING",
    "transient ERROR must remain retryable",
  );

  const repoRoot = process.cwd();
  const routeSource = readFileSync(
    resolve(repoRoot, "src/app/api/delta-sync/push/route.ts"),
    "utf8",
  );
  const clientSource = readFileSync(
    resolve(repoRoot, "src/lib/deltaSyncClient.ts"),
    "utf8",
  );
  const queueSource = readFileSync(
    resolve(repoRoot, "src/lib/localSyncQueueDb.ts"),
    "utf8",
  );

  assert.match(
    routeSource,
    /measurementErrors\.push\(\{\s*changeId,\s*errorCode:\s*publicError,?\s*\}\)/,
    "server response must bind each measurement error code to its changeId",
  );
  assert.match(
    routeSource,
    /measurementErrors,\s*\}\);/,
    "server response must expose measurementErrors",
  );

  assert.match(
    clientSource,
    /String\(item\?\.errorCode\s*\|\|\s*""\)\.trim\(\)\s*===\s*"MEASUREMENT_STALE_VERSION"/,
    "client must classify MEASUREMENT_STALE_VERSION as terminal",
  );
  assert.match(
    clientSource,
    /markSyncEventsConflict\(/,
    "client must quarantine terminal stale-version events",
  );

  assert.match(
    queueSource,
    /syncStatus:\s*'PENDING'\s*\|\s*'SYNCED'\s*\|\s*'ERROR'\s*\|\s*'BLOCKED'\s*\|\s*'CONFLICT'/,
    "queue contract must expose a distinct CONFLICT state",
  );
  assert.match(
    queueSource,
    /\.anyOf\(\['PENDING',\s*'ERROR'\]\)/,
    "only PENDING and ERROR may be automatically retried",
  );
  assert.doesNotMatch(
    queueSource,
    /\.anyOf\(\[[^\]]*'CONFLICT'/,
    "CONFLICT must never enter automatic retry selection",
  );

  await localSyncQueueDb.pendingSyncEvents.clear();

  console.log(
    "PASS measurementSyncTerminalConflictRetrySuite: stale version is terminal; transient errors remain retryable",
  );
}

main().catch(async (error) => {
  try {
    await localSyncQueueDb.pendingSyncEvents.clear();
  } catch {}

  console.error(error);
  process.exitCode = 1;
});
const __serverAuthoritySource = readFileSync(
  "src/lib/serverMeasurementAuthority.ts",
  "utf8",
);
assert.match(
  __serverAuthoritySource,
  /extractMeasurementDomainCode/,
  "server authority must normalize safe MEASUREMENT_* tokens",
);
assert.match(
  __serverAuthoritySource,
  /\['message', 'details', 'hint'\]/,
  "server authority must inspect only the safe PostgREST error text fields",
);
assert.match(
  __serverAuthoritySource,
  /ALLOWED_MEASUREMENT_DOMAIN_CODES[\s\S]*?MEASUREMENT_STALE_VERSION/,
  "only explicitly allowlisted measurement domain codes may escape normalization",
);
assert.match(
  __serverAuthoritySource,
  /MEASUREMENT_AUTHORITY_RPC_FAILED/,
  "generic public fallback must remain fail-closed",
);