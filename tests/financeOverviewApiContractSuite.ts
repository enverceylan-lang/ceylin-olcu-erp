import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const route = readFileSync(
  resolve(process.cwd(), "src/app/api/finance/overview/route.ts"),
  "utf8",
);

const client = readFileSync(
  resolve(process.cwd(), "src/lib/finance/financeOverviewReadClient.ts"),
  "utf8",
);

assert.match(route, /verifyAuth\(req\)/);
assert.match(route, /readRequestedErpScopeId\(req\)/);
assert.match(route, /loadShadowErpContext\(/);
assert.match(route, /guardServerFinanceAccess\(\{/);
assert.match(route, /requestedPermission:\s*"finance\.view"/);
assert.match(route, /requestedCapability:\s*"BASIC_FINANCE"/);
assert.match(route, /actorScope:\s*context\.scope/);
assert.match(route, /resourceScope:\s*context\.scope/);
assert.match(route, /read_finance_overview_snapshot_v1/);
assert.match(route, /p_scope:\s*context\.scope/);
assert.match(route, /Cache-Control":\s*"no-store"/);

assert.match(client, /useAuthStore\.getState\(\)\.sessionToken\?\.trim\(\)/);
assert.match(client, /Authorization:\s*`Bearer \$\{sessionToken\}`/);
assert.match(client, /cache:\s*"no-store"/);
assert.match(client, /erpScopeMatches\(expectedScope,\s*snapshot\.scope\)/);
assert.doesNotMatch(client, /useSalesStore|localFinanceDb|selectFinanceReadModel/);

console.log("[PASS] F3 overview API uses server-owned ERP scope");
console.log("[PASS] F3 overview API requires finance.view + BASIC_FINANCE");
console.log("[PASS] F3 overview client has no projection/local fallback");
