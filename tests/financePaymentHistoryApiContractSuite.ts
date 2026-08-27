import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(
  "src/app/api/finance/payments/history/route.ts",
  "utf8",
);

assert.match(route, /verifyAuth\(request\)/);
assert.match(route, /readRequestedErpScopeId\(request\)/);
assert.match(route, /loadShadowErpContext\(/);
assert.match(route, /guardServerFinanceAccess\(\{/);
assert.match(route, /finance\.cash\.payment\.reverse/);
assert.match(route, /finance\.bank\.payment\.reverse/);
assert.match(route, /CASH_PAYMENT_REVERSE/);
assert.match(route, /BANK_PAYMENT_REVERSE/);
assert.match(route, /\.from\("finance_transactions"\)/);
assert.match(route, /\.eq\("tenant_id", tenantId\)/);
assert.match(route, /\.eq\("company_id", companyId\)/);
assert.match(route, /\.eq\("branch_id", branchId\)/);
assert.match(route, /\.eq\("accounting_period_id", accountingPeriodId\)/);
assert.match(route, /\.eq\("projection_source", "PAYMENT"\)/);
assert.match(route, /\.eq\("payment_method", channel\)/);
assert.match(route, /operation_group_id/);
assert.match(route, /transaction_id/);
assert.match(route, /reversalTargetId/);
assert.match(route, /status === "REVERSED"/);

console.log("FINANCE_PAYMENT_HISTORY_API_CONTRACT: PAK");
