import assert from "node:assert/strict";
import {
  readFileSync,
} from "node:fs";
import {
  resolve,
} from "node:path";

const proxySource =
  readFileSync(
    resolve(
      process.cwd(),
      "src/proxy.ts",
    ),
    "utf8",
  );

const authGateSource =
  readFileSync(
    resolve(
      process.cwd(),
      "src/components/AuthGate.tsx",
    ),
    "utf8",
  );

const sidebarSource =
  readFileSync(
    resolve(
      process.cwd(),
      "src/components/Sidebar.tsx",
    ),
    "utf8",
  );

assert.match(
  proxySource,
  /export function proxy/,
);

assert.match(
  proxySource,
  /enverp_company_slug/,
);

assert.match(
  proxySource,
  /NextResponse\.rewrite/,
);

assert.match(
  proxySource,
  /NextResponse\.redirect/,
);

assert.match(
  proxySource,
  /COMPANY_HOME_SEGMENT/,
);

assert.match(
  authGateSource,
  /normalizeCompanyAppPath/,
);

assert.match(
  authGateSource,
  /withCompanyPrefix/,
);

assert.match(
  authGateSource,
  /canViewModule\(currentUser\.role, appPathname\)/,
);

assert.match(
  sidebarSource,
  /normalizeCompanyAppPath/,
);

assert.match(
  sidebarSource,
  /withCompanyPrefix/,
);

assert.match(
  sidebarSource,
  />\s*ENVerp\s*</,
);

assert.doesNotMatch(
  sidebarSource,
  /PlatformSuperAdminLink/,
);

console.log(
  "COMPANY_PREFIXED_ROUTING_CONTRACT: PAK",
);