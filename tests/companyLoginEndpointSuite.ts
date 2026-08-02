import assert from "node:assert/strict";
import {
  readFileSync,
} from "node:fs";
import {
  resolve,
} from "node:path";

const route =
  readFileSync(
    resolve(
      process.cwd(),
      "src/app/api/auth/company-login/route.ts",
    ),
    "utf8",
  );

const session =
  readFileSync(
    resolve(
      process.cwd(),
      "src/lib/companySession.ts",
    ),
    "utf8",
  );

assert.match(
  route,
  /\.from\("erp_companies"\)/,
);

assert.match(
  route,
  /\.eq\(\s*"slug",\s*companySlug/,
);

assert.match(
  route,
  /\.from\("erp_user_scopes"\)/,
);

assert.match(
  route,
  /\.eq\(\s*"tenant_id",\s*company\.tenant_id/,
);

assert.match(
  route,
  /\.eq\(\s*"company_id",\s*company\.company_id/,
);

assert.match(
  route,
  /loadShadowErpContext/,
);

assert.match(
  route,
  /user\.role ===\s*"PLATFORM_SUPER_ADMIN"/,
);

assert.match(
  route,
  /createCompanySessionToken/,
);

assert.match(
  session,
  /sessionType:\s*"COMPANY"/,
);

assert.match(
  session,
  /tenantId:\s*string/,
);

assert.match(
  session,
  /companyId:\s*string/,
);

assert.match(
  session,
  /userScopeId:\s*string/,
);

assert.match(
  session,
  /companySlug:\s*string/,
);

assert.doesNotMatch(
  route,
  /rememberMe\s*\?/,
);

assert.doesNotMatch(
  route,
  /console\.(log|error)\([^)]*password/i,
);

console.log(
  "COMPANY_LOGIN_ENDPOINT_TEST: PAK",
);