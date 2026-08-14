import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  "src/app/api/finance/accounts/route.ts",
  "utf8",
);

assert.match(source, /verifyAuth/);
assert.match(source, /readRequestedErpScopeId/);
assert.match(source, /loadShadowErpContext/);
assert.match(source, /guardServerFinanceAccess/);
assert.match(source, /requestedPermission:\s*"finance\.account\.manage"/);
assert.match(source, /requestedCapability:\s*"ACCOUNT_MANAGE"/);
assert.match(source, /packageType:\s*context\.package/);
assert.match(source, /actorScope:\s*context\.scope/);
assert.match(source, /resourceScope:\s*context\.scope/);

for (const table of [
  "finance_accounts",
  "cash_accounts",
  "bank_accounts",
  "pos_accounts",
]) {
  assert.match(source, new RegExp(`\\.from\\("${table}"\\)`));
}

assert.match(source, /\.rpc\(\s*"manage_finance_account_master_v1"/);
assert.match(source, /p_scope:[\s\S]*tenant_id:[\s\S]*company_id:[\s\S]*branch_id:[\s\S]*accounting_period_id:/);
assert.match(source, /p_idempotency_key/);
assert.match(source, /p_payload_hash/);
assert.match(source, /createHash\("sha256"\)/);
assert.doesNotMatch(source, /localFinanceJournalDb|Dexie/);

console.log("[PASS] Finance V1-A account master API contract");