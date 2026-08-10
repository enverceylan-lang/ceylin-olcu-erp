import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(
    path.join(root, rel),
    "utf8",
  );
}

const local = read("src/lib/localFieldTaskDb.ts");
const sync = read("src/lib/fieldTaskSyncClient.ts");
const api = read("src/app/api/field-tasks/route.ts");
const lifecycle = read(
  "src/app/api/field-tasks/lifecycle/route.ts",
);
const sql = read(
  "docs/sql/20260810_field_task_lifecycle_archive_hard_delete_v1.sql",
);

assert.match(
  local,
  /archivedAt\?: string;/,
);
assert.match(
  local,
  /cancelledAt\?: string;/,
);
assert.match(
  local,
  /listArchivedFieldTasks/,
);
assert.match(
  local,
  /deleteLocalFieldTasks/,
);

assert.match(
  sync,
  /deletedTaskIds\?: string\[\]/,
);
assert.match(
  sync,
  /await deleteLocalFieldTasks/,
);

assert.match(
  api,
  /\.from\("field_task_tombstones"\)/,
);
assert.match(
  api,
  /Deleted task cannot be recreated\./,
);
assert.match(
  api,
  /Archived task cannot change workflow status\./,
);
assert.match(
  api,
  /Cancellation must use the audited admin lifecycle endpoint\./,
);

assert.match(
  lifecycle,
  /if \(role !== "ADMIN"\)/,
);
assert.match(
  lifecycle,
  /"CANCEL"/,
);
assert.match(
  lifecycle,
  /"ARCHIVE"/,
);
assert.match(
  lifecycle,
  /"RESTORE"/,
);
assert.match(
  lifecycle,
  /export async function DELETE/,
);
assert.match(
  lifecycle,
  /\.match\(\{\s*tenant_id:/,
);
assert.match(
  lifecycle,
  /admin_hard_delete_field_task_v1/,
);

assert.match(
  sql,
  /CREATE TABLE IF NOT EXISTS public\.field_task_tombstones/,
);
assert.match(
  sql,
  /PRIMARY KEY \(\s*tenant_id,\s*company_id,\s*branch_id,\s*accounting_period_id,\s*task_id/,
);
assert.match(
  sql,
  /SECURITY DEFINER/,
);
assert.match(
  sql,
  /FOR UPDATE/,
);
assert.match(
  sql,
  /TASK_NOT_ARCHIVED/,
);
assert.match(
  sql,
  /INSERT INTO public\.field_task_tombstones/,
);
assert.match(
  sql,
  /DELETE FROM public\.field_tasks/,
);
assert.match(
  sql,
  /GRANT EXECUTE[\s\S]*TO service_role;/,
);

console.log(
  "[PASS] field task lifecycle admin contract",
);
