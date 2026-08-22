import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

const sql = read("docs/sql/20260822_finance_customer_receivable_snapshot_v1.sql");
const route = read("src/app/api/finance/customer-receivable/route.ts");
const contracts = read("src/lib/finance/customerReceivableReadContracts.ts");
const client = read("src/lib/finance/customerReceivableReadClient.ts");
const panel = read("src/components/finance/CustomerFinancePanel.tsx");

assert.match(
  sql,
  /create or replace function public\.read_finance_customer_receivable_snapshot_v1\(\s*p_scope jsonb,\s*p_customer_id text,\s*p_currency text\s*\)/i,
);
assert.match(sql, /security definer/i);
assert.match(sql, /set search_path\s*=\s*pg_catalog,\s*public/i);
assert.match(sql, /auth\.role\(\) is distinct from 'service_role'/i);
assert.match(sql, /finance_receivable_open_items_v1/i);
assert.match(sql, /finance_collection_allocations_v1/i);
assert.match(sql, /finance_transactions/i);
assert.match(sql, /tenant_id\s*=\s*v_tenant/i);
assert.match(sql, /company_id\s*=\s*v_company/i);
assert.match(sql, /branch_id\s*=\s*v_branch/i);
assert.match(sql, /accounting_period_id\s*=\s*v_period/i);
assert.match(sql, /customer_id\s*=\s*v_customer/i);
assert.match(sql, /currency\s*=\s*v_currency/i);
assert.match(sql, /reconciliation/i);
assert.match(sql, /FINANCE_CUSTOMER_RECEIVABLE_READ_RECONCILIATION_FAILED/i);
assert.match(
  sql,
  /revoke all on function public\.read_finance_customer_receivable_snapshot_v1\(jsonb,text,text\)[\s\S]*from public,\s*anon,\s*authenticated/i,
);
assert.match(
  sql,
  /grant execute on function public\.read_finance_customer_receivable_snapshot_v1\(jsonb,text,text\)[\s\S]*to service_role/i,
);

const functionBody =
  sql.split("as $function$")[1]?.split("$function$;")[0] || "";
assert.doesNotMatch(functionBody, /\binsert\s+into\b/i);
assert.doesNotMatch(functionBody, /\bupdate\s+public\./i);
assert.doesNotMatch(functionBody, /\bdelete\s+from\b/i);
assert.doesNotMatch(functionBody, /\bfor\s+update\b/i);
assert.doesNotMatch(functionBody, /double precision|::float|::real/i);

assert.match(route, /verifyAuth/);
assert.match(route, /loadShadowErpContext/);
assert.match(route, /guardServerFinanceAccess/);
assert.match(route, /requestedPermission:\s*"customerFinance\.view"/);
assert.match(route, /requestedCapability:\s*"CUSTOMER_FINANCE"/);
assert.match(route, /read_finance_customer_receivable_snapshot_v1/);
assert.match(route, /Cache-Control/);
assert.match(route, /no-store/);
assert.doesNotMatch(route, /tenantId\s*=\s*req\.nextUrl/);
assert.doesNotMatch(route, /companyId\s*=\s*req\.nextUrl/);
assert.doesNotMatch(route, /branchId\s*=\s*req\.nextUrl/);
assert.doesNotMatch(route, /accountingPeriodId\s*=\s*req\.nextUrl/);

assert.match(contracts, /parseCustomerReceivableSnapshot/);
assert.match(contracts, /reconciliation\.ok !== true/);
assert.match(client, /cache:\s*"no-store"/);
assert.match(client, /parseCustomerReceivableSnapshot/);
assert.doesNotMatch(client, /localFinanceDb|listLocalFinanceTransactions/);

assert.match(panel, /readCustomerReceivableSnapshot/);
assert.match(panel, /Finans merkezindeki merkezi kayıtlardan okunur/);
assert.doesNotMatch(panel, /listLocalFinanceTransactions/);
assert.doesNotMatch(panel, /localFinanceDb/);
assert.doesNotMatch(panel, /calculateCustomerFinanceDashboard/);
assert.doesNotMatch(panel, /transaction\.direction/);

console.log("[PASS] finance customer receivable canonical read path");