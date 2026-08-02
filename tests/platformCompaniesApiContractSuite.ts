import assert from "node:assert/strict";
import {
  readFileSync,
} from "node:fs";
import {
  resolve,
} from "node:path";

const source =
  readFileSync(
    resolve(
      process.cwd(),
      "src/app/api/platform/companies/route.ts",
    ),
    "utf8",
  );

assert.match(
  source,
  /requirePlatformSuperAdmin\(request\)/,
);

assert.match(
  source,
  /SUPABASE_SERVICE_ROLE_KEY/,
);

assert.match(
  source,
  /provision_platform_company_v1/,
);

assert.match(
  source,
  /hashPassword\(adminPassword\)/,
);

assert.match(
  source,
  /normalizeUsername/,
);

assert.match(
  source,
  /companySlug/,
);

assert.match(
  source,
  /company_slug/,
);

assert.match(
  source,
  /p_actor_user_id:\s*[\r\n\s]*access\.actor\.id/,
);

assert.doesNotMatch(
  source,
  /changed_by_user_id\s*:/,
);
assert.match(
  source,
  /assertPlatformMetadataOnly/,
);

assert.match(
  source,
  /Cache-Control/,
);

assert.doesNotMatch(
  source,
  /NEXT_PUBLIC_SUPABASE_ANON_KEY/,
);

assert.doesNotMatch(
  source,
  /password:\s*adminPassword/,
);

console.log(
  "PLATFORM_COMPANIES_API_CONTRACT_TEST: PAK",
);