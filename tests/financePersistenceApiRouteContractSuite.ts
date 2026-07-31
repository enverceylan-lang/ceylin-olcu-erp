import assert from "node:assert/strict";

import {
  readFileSync
} from "node:fs";

import {
  resolve
} from "node:path";

const source =
  readFileSync(
    resolve(
      process.cwd(),
      "src/app/api/finance/persist/route.ts"
    ),
    "utf8"
  );

assert.match(
  source,
  /export const runtime\s*=\s*"nodejs"/
);

assert.match(
  source,
  /export const dynamic\s*=\s*"force-dynamic"/
);

assert.match(
  source,
  /await verifyAuth\(request\)/
);

assert.match(
  source,
  /SUPABASE_SERVICE_ROLE_KEY/
);

assert.doesNotMatch(
  source,
  /NEXT_PUBLIC_SUPABASE_ANON_KEY/
);

assert.match(
  source,
  /loadShadowErpContext\([\s\S]*?readRequestedErpScopeId\([\s\S]*?request[\s\S]*?\)/
);

assert.match(
  source,
  /decideFinancePersistenceApiContract/
);

assert.match(
  source,
  /guardServerFinanceChannelAccess/
);

assert.match(
  source,
  /storedPermissions:\s*user\.permissions/
);

assert.match(
  source,
  /permissionVersion:\s*user\.permissionVersion/
);

assert.match(
  source,
  /sessionPermissionVersion:\s*user\.sessionPermissionVersion/
);

assert.match(
  source,
  /new FinanceSupabaseGatewayAdapter/
);

assert.match(
  source,
  /await persistFinanceTransaction/
);

assert.match(
  source,
  /result\.outcome ===\s*"CONFLICT"/
);

assert.match(
  source,
  /status,\s*headers:\s*NO_STORE_HEADERS/
);

assert.match(
  source,
  /FINANCE_PERSISTENCE_FAILED/
);

assert.doesNotMatch(
  source,
  /\.from\(\s*["']finance_transactions["']\s*\)/
);

assert.doesNotMatch(
  source,
  /\.delete\(/
);

assert.doesNotMatch(
  source,
  /console\.(log|error)\([\s\S]*?(serviceRoleKey|SUPABASE_SERVICE_ROLE_KEY)/
);

console.log(
  "financePersistenceApiRouteContractSuite: PASS"
);