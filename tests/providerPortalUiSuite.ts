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

const sidebarSource =
  readFileSync(
    resolve(
      process.cwd(),
      "src/components/Sidebar.tsx"
    ),
    "utf8"
  );

assert.match(
  pageSource,
  /data-provider-portal-blocked/
);

assert.match(
  pageSource,
  /portalMode\.mode\s*===\s*"PROVIDER_BLOCKED"/
);

assert.match(
  pageSource,
  /data-provider-portal-filter/
);

assert.match(
  pageSource,
  /portalMode\.emptyMessage/
);

assert.match(
  pageSource,
  /data-provider-operation-card/
);

assert.match(
  pageSource,
  /\[&_button\]:w-full/
);

assert.match(
  sidebarSource,
  /Benim İşlerim/
);

assert.match(
  sidebarSource,
  /normalizeRole\(currentUser\.role\) === "TAILOR"/
);

assert.match(
  sidebarSource,
  /normalizeRole\(currentUser\.role\) === "INSTALLER"/
);

console.log(
  "PROVIDER_PORTAL_UI_TEST: PAK"
);