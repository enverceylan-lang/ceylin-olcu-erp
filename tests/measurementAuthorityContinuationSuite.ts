import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative: string) =>
  fs.readFileSync(path.join(root, relative), "utf8");

const delta = read("src/app/api/delta-sync/push/route.ts");
const legacy = read("src/app/api/sync/customers/route.ts");
const queue = read("src/lib/localSyncQueueDb.ts");
const localDb = read("src/lib/localMeasurementDb.ts");
const client = read("src/lib/deltaSyncClient.ts");
const sql = read("docs/sql/20260822_measurement_authority_v1.sql");
const gateway = read("src/lib/serverMeasurementAuthority.ts");
const media = read("src/app/api/sync/media/route.ts");

assert.match(delta, /const measurementResults: Array/);
assert.match(delta, /canonicalMeasurementChanges/);
assert.match(delta, /measurementResults\.push\(result\)/);
assert.match(delta, /Physical measurement delete is unsupported/);
assert.match(delta, /expected_version: expectedVersion/);

assert.doesNotMatch(legacy, /from\("measurements"\)\.upsert/);
assert.match(legacy, /MEASUREMENT_PHYSICAL_DELETE_UNSUPPORTED/);
assert.match(legacy, /Canonical measurement writes are owned exclusively/);
assert.match(legacy, /const normalizedEntityVersion = Number\(dm\.entity_version\)/);
assert.match(legacy, /canonicalVersion/);
assert.equal(
  (legacy.match(/\.\.\.\(canonicalVersion \? \{ version: canonicalVersion \} : \{\}\),/g) || []).length,
  2,
);

assert.match(queue, /openingId\?: string/);
assert.match(queue, /expectedVersion\?: number/);
assert.match(queue, /event\.expectedVersion === expectedVersion/);
assert.match(queue, /String\(event\.expectedVersion \?\? ""\)/);
assert.match(queue, /enqueueSyncEventDetailed\([\s\S]*expectedVersion[\s\S]*\)/);

assert.match(localDb, /operation = existingMeasurement \? 'UPDATE' : 'INSERT'/);
assert.match(localDb, /MEASUREMENT_EXPECTED_VERSION_MISSING/);
assert.match(localDb, /MEASUREMENT_OPENING_WINDOW_MISMATCH/);
assert.match(localDb, /'SOFT_DELETE'/);
assert.doesNotMatch(localDb, /version \|\| 1/);

assert.match(client, /measurementResults\?: Array/);
assert.match(client, /const safeSyncedIds: string\[\] = \[\]/);
assert.match(client, /version: entityVersion/);
assert.match(client, /Measurement canonical ACK validation failed/);

assert.match(sql, /security definer/i);
assert.match(sql, /set search_path = pg_catalog, public/i);
assert.match(sql, /measurement_command_receipts/);
assert.match(sql, /MEASUREMENT_STALE_VERSION/);
assert.match(sql, /MEASUREMENT_IDEMPOTENCY_CONFLICT/);
assert.match(sql, /insert into public\.measurement_changes/);
assert.doesNotMatch(sql, /delete\s+from\s+public\.measurements/i);
assert.doesNotMatch(sql, /"photos"/);
assert.doesNotMatch(sql, /"videos"/);

assert.match(gateway, /persist_measurement_authority_v1/);
assert.match(gateway, /sanitizeCanonicalPayload/);
assert.match(gateway, /MEASUREMENT_OPENING_WINDOW_MISMATCH/);

assert.match(media, /\.from\("measurements"\)/);
assert.match(media, /\.eq\("tenant_id"/);
assert.match(media, /\.eq\("company_id"/);
assert.match(media, /\.eq\("branch_id"/);
assert.match(media, /\.eq\(\s*"accounting_period_id"/);
assert.match(media, /if \(error \|\| !data\) return false;/);

console.log("PAK_MEASUREMENT_AUTHORITY_CONTINUATION_SOURCE_SUITE");