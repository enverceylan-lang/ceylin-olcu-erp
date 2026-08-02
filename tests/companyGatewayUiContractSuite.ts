import assert from "node:assert/strict";
import {
  readFileSync,
} from "node:fs";
import {
  resolve,
} from "node:path";

const shell =
  readFileSync(
    resolve(
      process.cwd(),
      "src/components/AppRouteShell.tsx",
    ),
    "utf8",
  );

const gateway =
  readFileSync(
    resolve(
      process.cwd(),
      "src/app/[companySlug]/page.tsx",
    ),
    "utf8",
  );

const activate =
  readFileSync(
    resolve(
      process.cwd(),
      "src/app/api/auth/company-scope-activate/route.ts",
    ),
    "utf8",
  );

const layout =
  readFileSync(
    resolve(
      process.cwd(),
      "src/app/layout.tsx",
    ),
    "utf8",
  );

assert.match(
  shell,
  /isCompanyLoginGateway/,
);

assert.match(
  shell,
  /RESERVED_ROOT_SEGMENTS/,
);

assert.match(
  shell,
  /<AuthGate>/,
);

assert.match(
  gateway,
  /\/api\/auth\/company-login/,
);

assert.match(
  gateway,
  /\/api\/auth\/company-scope-activate/,
);

assert.match(
  gateway,
  /useAuthStore\.setState/,
);

assert.match(
  activate,
  /requireCompanySession/,
);

assert.match(
  activate,
  /await\s+requireCompanySession\([\s\S]*?"WEB"/,
);

assert.match(
  activate,
  /companySession\.session\.companySlug/,
);

assert.match(
  activate,
  /companySession\.session\.userScopeId/,
);

assert.match(
  activate,
  /erp_user_scopes/,
);

assert.match(
  activate,
  /erp_companies/,
);

assert.match(
  activate,
  /ERP_ACTIVE_SCOPE_COOKIE/,
);

assert.match(
  activate,
  /enverp_company_slug/,
);

assert.doesNotMatch(
  activate,
  /\bverifyAuth\b/,
);

assert.match(
  layout,
  /title:\s*"ENVERP"/,
);

assert.doesNotMatch(
  layout,
  /CEYLİN ERP/,
);

console.log(
  "COMPANY_GATEWAY_UI_CONTRACT_TEST: PAK",
);