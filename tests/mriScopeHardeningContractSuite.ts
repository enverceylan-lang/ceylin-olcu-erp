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
  /MEDIA_SYNC_NOT_IMPLEMENTED/,
  "Media skeleton does not fail closed",
);

assert.match(
  media,
  /status: 501/,
  "Media skeleton does not return 501",
);

assert.doesNotMatch(
  media,
  /entityId|entityType|media-skeleton-id|via\.placeholder\.com/,
  "Media skeleton still echoes client ownership or fake persistence data",
);

console.log(
  "MRI_SCOPE_HARDENING_CONTRACT_SUITE: PAK",
);