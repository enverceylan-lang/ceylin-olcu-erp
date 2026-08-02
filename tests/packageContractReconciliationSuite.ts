import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  getPackageDisplayLabel,
  normalizeErpPackage,
  PACKAGE_FEATURES,
} from "../src/lib/packageFeatures";

const migration = readFileSync(
  resolve(process.cwd(), "docs/sql/20260802_package_contract_reconciliation_v1.sql"),
  "utf8",
);

const provisionSql = readFileSync(
  resolve(process.cwd(), "docs/sql/20260801_platform_company_provision_v1.sql"),
  "utf8",
);

assert.equal(normalizeErpPackage("ECO"), "ECO");
assert.equal(normalizeErpPackage("PRO"), "PRO");
assert.equal(normalizeErpPackage("PLUS"), "PLUS");
assert.equal(normalizeErpPackage("ELITE"), "ELITE");
assert.equal(normalizeErpPackage("NORMAL"), "PRO");
assert.equal(normalizeErpPackage("STANDARD"), "PRO");

assert.equal(getPackageDisplayLabel("NORMAL"), "PRO");
assert.equal(getPackageDisplayLabel("STANDARD"), "PRO");
assert.equal(getPackageDisplayLabel("ELITE"), "ELITE");

for (const feature of Object.keys(PACKAGE_FEATURES.PLUS)) {
  const key = feature as keyof typeof PACKAGE_FEATURES.PLUS;
  if (PACKAGE_FEATURES.PLUS[key]) {
    assert.equal(PACKAGE_FEATURES.ELITE[key], true);
  }
}

assert.match(
  migration,
  /package_code = 'PRO'[\s\S]*WHERE package_code = 'NORMAL'/,
);

assert.match(
  migration,
  /'ECO'[\s\S]*'PRO'[\s\S]*'PLUS'[\s\S]*'ELITE'/,
);

assert.doesNotMatch(
  provisionSql,
  /v_package_code NOT IN \([\s\S]*'NORMAL'[\s\S]*\) THEN/,
);

assert.match(
  provisionSql,
  /v_package_code NOT IN \([\s\S]*'PRO'[\s\S]*'ELITE'[\s\S]*\) THEN/,
);

console.log("PACKAGE_CONTRACT_RECONCILIATION_TEST: PAK");