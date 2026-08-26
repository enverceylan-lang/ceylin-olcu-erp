import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const mediaRoute = fs.readFileSync(
  path.join(root, "src/app/api/sync/media/route.ts"),
  "utf8",
);
const companyRoute = fs.readFileSync(
  path.join(root, "src/app/api/media-entitlement/route.ts"),
  "utf8",
);
const platformRoute = fs.readFileSync(
  path.join(root, "src/app/api/platform/media-entitlement/route.ts"),
  "utf8",
);
const helper = fs.readFileSync(
  path.join(root, "src/lib/serverMediaEntitlement.ts"),
  "utf8",
);
const panel = fs.readFileSync(
  path.join(root, "src/components/media/CanonicalMediaPanel.tsx"),
  "utf8",
);
const superAdmin = fs.readFileSync(
  path.join(root, "src/app/super-admin/page.tsx"),
  "utf8",
);

assert.match(
  companyRoute,
  /requireCompanySession\(req,\s*"WEB"\)/,
);
assert.match(
  companyRoute,
  /from\s+"@\/lib\/companySessionGuard"/,
);
assert.match(companyRoute, /loadShadowErpContext/);
assert.match(companyRoute, /readRequestedErpScopeId/);
assert.match(companyRoute, /MEDIA_ENTITLEMENT_READ_FAILED/);
assert.match(companyRoute, /mediaEnabled:\s*entitlement\.enabled/);

assert.match(
  helper,
  /from\("erp_platform_feature_switches"\)/,
);
assert.match(
  helper,
  /from\("erp_company_feature_entitlements"\)/,
);
assert.match(helper, /\.eq\("feature_code",\s*"MEDIA"\)/);
assert.match(helper, /\.eq\("tenant_id",\s*tenantId\)/);
assert.match(helper, /\.eq\("company_id",\s*companyId\)/);
assert.match(
  helper,
  /enabled:\s*globalEnabled\s*&&\s*companyEnabled/,
);
assert.match(helper, /reason:\s*"READ_FAILED"/);

assert.match(mediaRoute, /loadMediaEntitlement/);
assert.match(mediaRoute, /MEDIA_ENTITLEMENT_READ_FAILED/);
assert.match(mediaRoute, /MEDIA_FEATURE_DISABLED/);

const entitlementPosition =
  mediaRoute.indexOf("loadMediaEntitlement");
const targetAuthorityPosition =
  mediaRoute.indexOf("assertTargetAuthority");

assert.ok(entitlementPosition >= 0);
assert.ok(targetAuthorityPosition >= 0);
assert.ok(entitlementPosition < targetAuthorityPosition);

assert.match(platformRoute, /requirePlatformSuperAdmin/);
assert.match(platformRoute, /set_platform_feature_switch_v1/);
assert.match(platformRoute, /set_company_feature_entitlement_v1/);
assert.match(platformRoute, /access\.actor\.id/);
assert.match(
  platformRoute,
  /erp_company_feature_entitlements/,
);

assert.match(panel, /fetch\(\s*"\/api\/media-entitlement"/);
assert.match(
  panel,
  /mediaEntitlementReady\s*&&\s*mediaEntitlement\.enabled/,
);
assert.match(
  panel,
  /if\s*\(!mediaEntitlementReady\s*\|\|\s*!mediaEnabled\)/,
);
assert.match(
  panel,
  /mediaEnabled\s*&&[\s\S]*targetType\s*===\s*"MEASUREMENT"/,
);

assert.match(
  superAdmin,
  /fetch\(\s*"\/api\/platform\/media-entitlement"/,
);
assert.match(superAdmin, /saveGlobalMediaEntitlement/);
assert.match(superAdmin, /saveCompanyMediaEntitlement/);
assert.match(superAdmin, />Medya Yetkisi</);

console.log("PASS mediaEntitlementApiContractSuite");