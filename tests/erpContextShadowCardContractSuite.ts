import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(
    process.cwd(),
    "src/components/admin/ErpContextShadowCard.tsx"
  ),
  "utf8"
);
const settingsSource = readFileSync(
  resolve(process.cwd(), "src/app/ayarlar/page.tsx"),
  "utf8"
);

assert.match(source, /useAuthStore\(\(state\) => state\.sessionToken\)/);
assert.match(source, /fetch\("\/api\/erp-context"/);
assert.match(source, /Authorization:\s*`Bearer \$\{sessionToken\}`/);
assert.match(source, /cache:\s*"no-store"/);
assert.match(source, /AbortController/);
assert.match(source, /Yalnız tanı amaçlıdır/);
assert.match(source, /Karşılaştırılan özellik/);
assert.match(source, /Mevcut erişimle fark/);
assert.match(source, /Ölçü pilot modu/);
assert.doesNotMatch(source, /console\.(log|error|warn)/);
assert.doesNotMatch(source, />\s*\{sessionToken\}\s*</);

assert.match(
  settingsSource,
  /import ErpContextShadowCard from "@\/components\/admin\/ErpContextShadowCard"/
);
assert.match(
  settingsSource,
  /<ErpContextShadowCard \/>[\s\S]*?currentUserRole === "ADMIN"[\s\S]*?<SalesSyncDiagnosticsCard \/>/
);

console.log("[PASS] ERP context shadow card contract");
