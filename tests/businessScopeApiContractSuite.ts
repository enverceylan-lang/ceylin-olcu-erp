import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readSource = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const customerSync = readSource(
  "src/app/api/sync/customers/route.ts"
);
const deltaPush = readSource(
  "src/app/api/delta-sync/push/route.ts"
);
const deltaPull = readSource(
  "src/app/api/delta-sync/pull/route.ts"
);
const fieldTasks = readSource(
  "src/app/api/field-tasks/route.ts"
);

for (const source of [
  customerSync,
  deltaPush,
  deltaPull,
  fieldTasks,
]) {
  assert.match(source, /loadShadowErpContext/);
  assert.match(source, /user\.id/);
  assert.match(source, /tenant_id/);
  assert.match(source, /company_id/);
  assert.match(source, /branch_id/);
  assert.match(source, /accounting_period_id/);
  assert.match(source, /ERP scope is not ready/);
}

assert.match(customerSync, /\.match\(scopeColumns\)/);
for (const table of [
  "customers",
  "rooms",
  "openings",
  "measurements",
]) {
  assert.match(
    customerSync,
    new RegExp(`from\\("${table}"\\)\\.upsert\\(\\{\\s*\\.\\.\\.scopeColumns`)
  );
}

assert.match(deltaPush, /Object\.assign\(change, scopeColumns\)/);
assert.match(deltaPush, /from\("measurement_changes"\)/);
assert.match(deltaPush, /from\("draft_changes"\)/);

assert.equal(
  (deltaPull.match(/\.match\(scopeColumns\)/g) || []).length,
  2
);
assert.match(fieldTasks, /\.match\(\{/);
assert.match(fieldTasks, /tenant_id:\s*erpContext\.scope\.tenantId/);

for (const source of [
  customerSync,
  deltaPush,
  deltaPull,
  fieldTasks,
]) {
  assert.doesNotMatch(
    source,
    /body\.(tenantId|companyId|branchId|accountingPeriodId)/
  );
}

console.log("[PASS] business scope API write and read contract");
