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
      "src/app/api/finance/system-workflow/route.ts"
    ),
    "utf8"
  );

assert.match(
  source,
  /export async function POST/
);

assert.match(
  source,
  /verifyAuth\(req\)/
);

assert.match(
  source,
  /loadShadowErpContext/
);

assert.match(
  source,
  /readRequestedErpScopeId\(req\)/
);

assert.match(
  source,
  /SUPABASE_SERVICE_ROLE_KEY/
);

assert.match(
  source,
  /persistSession:\s*false/
);

assert.match(
  source,
  /autoRefreshToken:\s*false/
);

assert.match(
  source,
  /FinanceSupabaseWorkflowCoordinatorClient/
);

assert.match(
  source,
  /as unknown as\s*FinanceSupabaseWorkflowCoordinatorClient/
);

assert.match(
  source,
  /handleFinanceSystemWorkflowApi/
);

assert.match(
  source,
  /Cache-Control/
);

assert.match(
  source,
  /no-store/
);

assert.doesNotMatch(
  source,
  /NEXT_PUBLIC_SUPABASE_ANON_KEY/
);

assert.doesNotMatch(
  source,
  /\.from\(["']finance_transactions["']\)\s*\.insert/
);

assert.doesNotMatch(
  source,
  /\.delete\(/
);

console.log(
  "financeSystemWorkflowApiRouteContractSuite: PASS"
);