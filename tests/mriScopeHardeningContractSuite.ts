import assert from "node:assert/strict";
import fs from "node:fs";

const syncCustomers =
  fs.readFileSync(
    "src/app/api/sync/customers/route.ts",
    "utf8",
  );

const fieldTasks =
  fs.readFileSync(
    "src/app/api/field-tasks/route.ts",
    "utf8",
  );

const media =
  fs.readFileSync(
    "src/app/api/sync/media/route.ts",
    "utf8",
  );

assert.match(
  syncCustomers,
  /\.delete\(\)[\s\S]*?\.eq\("id", del\.id\)[\s\S]*?\.match\(scopeColumns\)/,
  "Child hard delete is not exact-scope bound",
);

assert.match(
  syncCustomers,
  /\.from\("erp_user_scopes"\)[\s\S]*?\.select\("user_id"\)[\s\S]*?\.match\(scopeColumns\)[\s\S]*?\.eq\("is_active", true\)/,
  "Sync user list is not derived from active exact ERP scope",
);

assert.match(
  syncCustomers,
  /\.from\("users"\)[\s\S]*?\.in\("id", scopedUserIds\)/,
  "Users query is not restricted to scoped user IDs",
);

assert.doesNotMatch(
  syncCustomers,
  /from\("users"\)\.select\("\*"\);/,
  "Unscoped full users read still exists",
);

assert.match(
  fieldTasks,
  /\.from\("erp_user_scopes"\)[\s\S]*?\.eq\("user_id", assignedUserId\)[\s\S]*?\.eq\(\s*"tenant_id"[\s\S]*?\.eq\(\s*"company_id"[\s\S]*?\.eq\(\s*"branch_id"[\s\S]*?\.eq\(\s*"accounting_period_id"[\s\S]*?\.eq\("is_active", true\)/,
  "Assigned field user is not bound to active exact ERP scope",
);

assert.match(
  media,
  /requireCompanySession\(req,\s*"WEB"\)/,
  "Media authority does not require a company session",
);

assert.match(
  media,
  /loadShadowErpContext[\s\S]*?readRequestedErpScopeId/,
  "Media authority does not resolve the requested ERP scope",
);

assert.match(
  media,
  /loadMediaEntitlement[\s\S]*?assertTargetAuthority/,
  "Media entitlement is not checked before target authority",
);

assert.match(
  media,
  /\.from\("measurements"\)[\s\S]*?\.eq\("id", targetId\)[\s\S]*?\.eq\("tenant_id", context\.tenantId\)[\s\S]*?\.eq\("company_id", context\.companyId\)[\s\S]*?\.eq\("branch_id", context\.branchId\)[\s\S]*?\.eq\(\s*"accounting_period_id",\s*context\.accountingPeriodId/,
  "Measurement media target is not bound to the exact ERP scope",
);

assert.match(
  media,
  /MEDIA_TARGET_FORBIDDEN/,
  "Media authority does not fail closed for a forbidden target",
);

assert.doesNotMatch(
  media,
  /media-skeleton-id|via\.placeholder\.com/,
  "Media authority still contains skeleton persistence data",
);

console.log(
  "MRI_SCOPE_HARDENING_CONTRACT_SUITE: PAK",
);
