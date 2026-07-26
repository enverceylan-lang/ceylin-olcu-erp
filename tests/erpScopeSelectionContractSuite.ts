import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const api = read("src/app/api/erp-scopes/route.ts");
const context = read("src/lib/serverErpContext.ts");
const cookie = read("src/lib/erpActiveScopeCookie.ts");
const selector = read("src/components/ErpScopeSelector.tsx");
const topbar = read("src/components/Topbar.tsx");

assert.match(api, /await verifyAuth\(req\)/);
assert.match(api, /\.eq\("user_id", user\.id\)/);
assert.match(api, /\.eq\("is_active", true\)/);
assert.match(api, /requestedScopeId: scopeId/);
assert.match(api, /SCOPE_SELECTION_FORBIDDEN/);
assert.match(api, /scopeAccess === "DEFAULT_ONLY"/);
assert.match(api, /hasPackageFeature\(context\.package, "multiBranch"\)/);
assert.match(api, /httpOnly: true/);
assert.match(api, /sameSite: "lax"/);
assert.match(api, /Cache-Control/);
assert.match(api, /no-store/);
assert.doesNotMatch(api, /tenant_name|company_name|branch_name|period_name/);

assert.match(context, /\.eq\("user_id", cleanUserId\)/);
assert.match(context, /\.eq\("user_scope_id", requestedScopeId\)/);
assert.match(context, /\.eq\("is_active", true\)/);

assert.match(cookie, /enverp_active_scope/);
assert.match(cookie, /req\.cookies\.get/);

assert.match(selector, /fetch\("\/api\/erp-scopes"/);
assert.match(selector, /Authorization: `Bearer \$\{sessionToken\}`/);
assert.match(selector, /window\.location\.reload\(\)/);
assert.match(selector, /Aktif şirket, şube ve dönem/);
assert.doesNotMatch(selector, /localStorage|sessionStorage/);
assert.match(topbar, /<ErpScopeSelector \/>/);

for (const path of [
  "src/app/api/erp-context/route.ts",
  "src/app/api/sync/customers/route.ts",
  "src/app/api/delta-sync/push/route.ts",
  "src/app/api/delta-sync/pull/route.ts",
  "src/app/api/field-tasks/route.ts",
]) {
  const source = read(path);
  assert.match(source, /readRequestedErpScopeId\(req\)/);
}

console.log("[PASS] ERP scope selection security contract");
