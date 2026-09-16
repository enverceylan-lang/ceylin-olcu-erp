import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  classifyCustomerRootScope,
  migrateLegacyCustomerRootScope,
} from "../src/lib/customerTreeScope";

const readSource = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const customerSync = readSource(
  "src/app/api/sync/customers/route.ts"
);
const customerSyncClient = readSource(
  "src/lib/syncService.ts"
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
]) {
  assert.match(
    customerSync,
    new RegExp(`from\\("${table}"\\)\\.upsert\\(\\{\\s*\\.\\.\\.scopeColumns`)
  );
}

const customerUpsertStart = customerSync.indexOf(
  'from("customers").upsert({',
);
const customerUpsertEnd = customerSync.indexOf(
  "\n        });",
  customerUpsertStart,
);
assert.ok(customerUpsertStart >= 0);
assert.ok(customerUpsertEnd > customerUpsertStart);

const customerUpsertSource = customerSync.slice(
  customerUpsertStart,
  customerUpsertEnd,
);

for (const canonicalWriterPattern of [
  /location:\s*c\.mapLocation\s*\|\|\s*dbCustomerCanonical\?\.location\s*\|\|\s*null/,
  /createdBy:\s*c\.createdById\s*\|\|\s*dbCustomerCanonical\?\.createdBy\s*\|\|\s*null/,
  /status:\s*c\.workflowStatus\s*\|\|\s*dbCustomerCanonical\?\.status\s*\|\|\s*"YENI"/,
  /assignedTo:\s*dbCustomerCanonical\?\.assignedTo\s*\|\|\s*null/,
]) {
  assert.match(customerUpsertSource, canonicalWriterPattern);
}

for (const legacyWriterKey of [
  "mapLocation",
  "createdById",
  "createdByName",
  "assignedSalesId",
  "assignedSalesName",
  "assignedMeasureId",
  "assignedMeasureName",
  "assignedTailorId",
  "assignedTailorName",
  "assignedInstallerId",
  "assignedInstallerName",
  "workflowStatus",
  "customerCode",
  "taxNumber",
  "phone2",
  "extraDescription",
  "generalNote",
  "cariType",
  "approvalStatus",
  "addressPhotos",
  "deletedAt",
]) {
  assert.doesNotMatch(
    customerUpsertSource,
    new RegExp(`\\b${legacyWriterKey}\\s*:`),
  );
}

assert.doesNotMatch(
  customerUpsertSource,
  /assignedTo:\s*[^,\n]*(assignedSales|assignedMeasure|assignedTailor|assignedInstaller)/,
);

assert.match(customerSync, /const remoteCanonical = remote as SyncRecord/);
assert.match(
  customerSync,
  /mapLocation:\s*remoteCanonical\.location\s*\|\|\s*remote\.mapLocation/,
);
assert.match(
  customerSync,
  /createdById:\s*remoteCanonical\.createdBy\s*\|\|\s*remote\.createdById/,
);
assert.match(
  customerSync,
  /workflowStatus:\s*remoteCanonical\.status\s*\|\|\s*remote\.workflowStatus/,
);

for (const localRoleFallback of [
  "assignedSalesId",
  "assignedSalesName",
  "assignedMeasureId",
  "assignedMeasureName",
  "assignedTailorId",
  "assignedTailorName",
  "assignedInstallerId",
  "assignedInstallerName",
]) {
  assert.match(
    customerSync,
    new RegExp(
      `${localRoleFallback}:\\s*remote\\.${localRoleFallback}\\s*\\|\\|\\s*local\\.${localRoleFallback}`,
    ),
  );
}

assert.doesNotMatch(
  customerSync,
  /assigned(Sales|Measure|Tailor|Installer)(Id|Name):\s*remoteCanonical\.assignedTo/,
);

assert.doesNotMatch(
  customerSync,
  /from\("measurements"\)\.upsert/,
);

assert.match(
  customerSync,
  /customers:\s*sanitizeMediaValue\(\s*finalCustomers\.map\(\(c:\s*SyncRecord\)\s*=>\s*\(\{\s*\.\.\.c,\s*rooms:\s*\[\],\s*\}\)\),\s*\),/,
);

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

const expectedCustomerScope = {
  tenantId: "tenant-a",
  companyId: "company-a",
  branchId: "branch-a",
  accountingPeriodId: "period-a",
};

assert.equal(
  classifyCustomerRootScope(
    { id: "exact", ...expectedCustomerScope },
    expectedCustomerScope,
  ),
  "EXACT",
);

assert.equal(
  classifyCustomerRootScope(
    { id: "legacy", companyId: "company-a" },
    expectedCustomerScope,
  ),
  "LEGACY_MISSING",
);

assert.equal(
  classifyCustomerRootScope(
    { id: "conflict", companyId: "company-other" },
    expectedCustomerScope,
  ),
  "CONFLICT",
);

const migratedLegacyCustomer = migrateLegacyCustomerRootScope<Record<string, unknown>>(
  { id: "legacy", companyId: "company-a" },
  expectedCustomerScope,
);
assert.equal(migratedLegacyCustomer["id"], "legacy");
assert.equal(migratedLegacyCustomer["tenantId"], "tenant-a");
assert.equal(migratedLegacyCustomer["companyId"], "company-a");
assert.equal(migratedLegacyCustomer["branchId"], "branch-a");
assert.equal(migratedLegacyCustomer["accountingPeriodId"], "period-a");

assert.throws(
  () =>
    migrateLegacyCustomerRootScope(
      { id: "conflict", companyId: "company-other" },
      expectedCustomerScope,
    ),
  /CUSTOMER_SCOPE_CONFLICT/,
);

assert.match(customerSync, /classifyCustomerRootScope/);
assert.match(customerSync, /classification === "CONFLICT"/);
assert.match(customerSync, /classification === "LEGACY_MISSING"/);
assert.match(customerSync, /rejectedScopeCustomers/);
assert.match(customerSync, /migratedLegacyCustomerScopeCount/);
assert.match(customerSync, /customerScopeMigration/);
assert.doesNotMatch(
  customerSync,
  /error:\s*"SYNC_ENTITY_SCOPE_FORBIDDEN"[\s\S]{0,180}\{ status: 403 \}/,
);

assert.match(
  customerSync,
  /ENVERP_PILOT_LEGACY_CUSTOMER_SCOPE_MIGRATION/,
);
assert.match(
  customerSync,
  /ENVERP_PILOT_LEGACY_CUSTOMER_SCOPE_COMPANY_ID/,
);
assert.match(
  customerSync,
  /pilotLegacyMigrationCompanyId === erpContext\.scope\.companyId/,
);
assert.match(
  customerSync,
  /CUSTOMER_SCOPE_LEGACY_UNPROVEN/,
);
assert.match(customerSyncClient, /customerScopeMigration/);
assert.match(customerSyncClient, /rejectedCustomers/);
assert.match(customerSyncClient, /rejectedScopeCustomerCount > 0/);
assert.match(customerSyncClient, /setSyncStatus\('pending'\)/);

const identityContract = readSource(
  "docs/contracts/ENVERP_CUSTOMER_MEASUREMENT_IDENTITY_CONTRACT_V1.md"
);
assert.match(
  identityContract,
  /Controlled pilot legacy Customer scope migration window/,
);
assert.match(
  identityContract,
  /ENVERP_PILOT_LEGACY_CUSTOMER_SCOPE_MIGRATION is disabled after verification/,
);
assert.match(
  identityContract,
  /CUSTOMER_SCOPE_LEGACY_UNPROVEN while the migration flag is disabled/,
);
assert.match(
  identityContract,
  /not production-closure PAK until the flag-close/,
);

console.log("[PASS] business scope API write and read contract");
