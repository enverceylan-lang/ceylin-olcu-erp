import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const client = readFileSync(
  resolve(process.cwd(), "src/lib/deltaSyncClient.ts"),
  "utf8",
);
const route = readFileSync(
  resolve(process.cwd(), "src/app/api/delta-sync/push/route.ts"),
  "utf8",
);
const queue = readFileSync(
  resolve(process.cwd(), "src/lib/localSyncQueueDb.ts"),
  "utf8",
);

assert.match(
  client,
  /const DELTA_SYNC_SERVER_REQUEST_EVENT_LIMIT = 1;/,
  "Each server invocation must carry at most one queued delta event",
);

assert.match(
  client,
  /const DELTA_SYNC_MAX_EVENTS_PER_MANUAL_RUN = 50;/,
  "Manual push must preserve the former 50-event work window while splitting requests",
);

assert.match(
  client,
  /async function pushDeltaSyncEventsBatch\(eventLimit: number\)/,
  "Internal push batch must accept an explicit bounded event limit",
);

assert.match(
  client,
  /getPendingSyncEvents\(activeScope,\s*eventLimit\)/,
  "Pending events must remain scope-filtered before the event limit is applied",
);

assert.match(
  client,
  /export async function pushDeltaSyncEvents\(\):[\s\S]{0,800}runDeltaPushWithCrossTabLock\(\)/,
  "Public push must enter the cross-tab single-flight gate",
);

assert.match(
  client,
  /async function runDeltaPushWithCrossTabLock\(\)[\s\S]{0,1200}pushDeltaSyncEventsUnlocked\(\)/,
  "Cross-tab gate must delegate to the unlocked drain",
);

assert.match(
  client,
  /async function pushDeltaSyncEventsUnlocked\(\): Promise<[\s\S]{0,5000}pushDeltaSyncEventsBatch\(/,
  "Unlocked drain must preserve bounded sequential batch delivery",
);

assert.match(
  client,
  /eventIndex < DELTA_SYNC_MAX_EVENTS_PER_MANUAL_RUN/,
  "Manual drain must have a hard upper bound",
);

assert.match(
  client,
  /TERMINAL_MEASUREMENT_CONFLICT = "MEASUREMENT_STALE_VERSION"/,
  "Terminal stale-version conflicts must remain explicitly classified",
);

assert.match(
  client,
  /isTerminalMeasurementConflictOnly\(result\.errors\)/,
  "Terminal conflicts must be quarantined without blocking later queue items in the same manual run",
);

assert.doesNotMatch(
  client,
  /Promise\.all\([\s\S]{0,400}pushDeltaSyncEventsBatch/,
  "Bounded requests must remain sequential; parallel authority writes are forbidden",
);

assert.match(
  route,
  /measurementErrors/,
  "Server route must expose per-measurement canonical error codes",
);

assert.match(
  queue,
  /markSyncEventsConflict/,
  "Local queue must support terminal conflict quarantine",
);

assert.match(
  queue,
  /syncStatus:\s*'CONFLICT'/,
  "Terminal conflicts must leave retryable PENDING/ERROR states",
);

console.log("measurementSyncBoundedBatchContractSuite: PASS");