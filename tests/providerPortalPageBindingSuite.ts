import assert from "node:assert/strict";
import {
  readFileSync
} from "node:fs";
import {
  resolve
} from "node:path";

const pageSource =
  readFileSync(
    resolve(
      process.cwd(),
      "src/app/operasyonlar/page.tsx"
    ),
    "utf8"
  );

assert.match(
  pageSource,
  /resolveProviderPortalMode/
);

assert.match(
  pageSource,
  /listProviderMyWork/
);

assert.match(
  pageSource,
  /const portalMode/
);

assert.match(
  pageSource,
  /const providerActor/
);

assert.match(
  pageSource,
  /const providerLink/
);

assert.match(
  pageSource,
  /const providerWorkResult/
);

assert.match(
  pageSource,
  /providerWorkResult\?\.operations/
);

assert.match(
  pageSource,
  /portalMode\.mode ===\s*"PROVIDER_BLOCKED"/
);

assert.match(
  pageSource,
  /portalMode\.mode ===\s*"PROVIDER_READY"/
);

assert.match(
  pageSource,
  /portalMode\.mode === "MANAGEMENT"\s*&&\s*canCreateOperation/
);

assert.match(
  pageSource,
  /portalMode\.mode === "MANAGEMENT"\s*&&\s*routingOperation/
);

assert.match(
  pageSource,
  /\{portalMode\.title\}/
);

console.log(
  "PROVIDER_PORTAL_PAGE_BINDING_TEST: PAK"
);