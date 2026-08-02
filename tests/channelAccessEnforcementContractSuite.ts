import assert from "node:assert/strict";
import {
  readFileSync,
} from "node:fs";
import {
  resolve,
} from "node:path";

const login =
  readFileSync(
    resolve(
      process.cwd(),
      "src/app/api/auth/company-login/route.ts",
    ),
    "utf8",
  );

const scope =
  readFileSync(
    resolve(
      process.cwd(),
      "src/app/api/auth/company-scope-activate/route.ts",
    ),
    "utf8",
  );

const logout =
  readFileSync(
    resolve(
      process.cwd(),
      "src/app/api/auth/logout/route.ts",
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
  login,
  /loadServerChannelAccess/,
);

assert.match(
  login,
  /channel:\s*"WEB"/,
);

assert.match(
  login,
  /!webAccess\.allowed/,
);

assert.match(
  session,
  /channel:\s*ErpChannel/,
);

assert.match(
  scope,
  /requireCompanySession\(\s*req,\s*"WEB",?\s*\)/,
);

assert.match(
  scope,
  /companySession\.session\.companySlug/,
);

assert.match(
  scope,
  /companySession\.session\.userScopeId/,
);

assert.match(
  logout,
  /ERP_ACTIVE_SCOPE_COOKIE/,
);

assert.match(
  logout,
  /enverp_company_slug/,
);

assert.match(
  logout,
  /maxAge:\s*0/,
);

console.log(
  "CHANNEL_ACCESS_ENFORCEMENT_CONTRACT_TEST: PAK",
);