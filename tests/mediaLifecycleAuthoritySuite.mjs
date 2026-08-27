import fs from "node:fs";
import assert from "node:assert/strict";

const route = fs.readFileSync(
  "src/app/api/sync/media/route.ts",
  "utf8",
);

const panel = fs.readFileSync(
  "src/components/media/CanonicalMediaPanel.tsx",
  "utf8",
);

const policy = fs.readFileSync(
  "src/lib/mediaLifecycleAuthority.ts",
  "utf8",
);

assert.doesNotMatch(
  route,
  /data\.measuredById/,
);

assert.doesNotMatch(
  route,
  /\.from\("measurement_changes"\)/,
);

assert.match(
  route,
  /\.from\("users"\)/,
);

assert.match(
  route,
  /\.select\("role,permissions"\)/,
);

assert.match(
  route,
  /if \(operation === "READ"\) \{\s*return true;\s*\}/s,
);

assert.match(
  route,
  /context\.tenantId/,
);

assert.match(
  route,
  /context\.companyId/,
);

assert.match(
  route,
  /context\.branchId/,
);

assert.match(
  route,
  /context\.accountingPeriodId/,
);

assert.match(
  route,
  /const finalized = Boolean\(canonicalMeasurement\)/,
);

assert.match(
  policy,
  /media\.finalized\.edit/,
);

assert.match(
  policy,
  /canEditFinalizedMedia/,
);

assert.match(
  policy,
  /canCreateMeasurementMedia/,
);

assert.match(
  policy,
  /canCreateInstallationMedia/,
);

assert.doesNotMatch(
  panel,
  /isAdmin \|\| targetType === "MEASUREMENT"/,
);

assert.match(
  panel,
  /canCreateMeasurementMedia/,
);

assert.match(
  panel,
  /canEditFinalizedMedia/,
);

assert.equal(
  (route.match(/MEDIA_TARGET_FORBIDDEN/g) || []).length,
  2,
);

console.log(
  "PAK_MEDIA_LIFECYCLE_AUTHORITY_FINAL_V1_2",
);