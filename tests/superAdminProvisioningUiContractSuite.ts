import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/app/super-admin/page.tsx",
  ),
  "utf8",
);

assert.match(
  source,
  /fetch\(\s*"\/api\/platform\/companies"/,
);

assert.match(
  source,
  /method:\s*"GET"/,
);

assert.match(
  source,
  /method:\s*"POST"/,
);

for (const requiredField of [
  "tenantCode",
  "tenantName",
  "companyCode",
  "companySlug",
  "companyName",
  "branchCode",
  "branchName",
  "periodCode",
  "periodName",
  "periodStartsOn",
  "periodEndsOn",
  "package",
  "licenseStartsAt",
  "branchLimit",
  "userLimit",
  "companyAdmin",
  "adminUsername",
  "adminPassword",
]) {
  assert.match(
    source,
    new RegExp(requiredField),
  );
}

assert.match(
  source,
  /password:\s*companyDraft\.adminPassword/,
);

assert.doesNotMatch(
  source,
  /changed_by_user_id/,
);

assert.match(
  source,
  /await loadCompanies\(\)/,
);

assert.match(
  source,
  /Şirketi Oluştur/,
);

assert.match(
  source,
  /API Durumu/,
);

assert.match(
  source,
  />Bağlı</,
);

console.log(
  "SUPER_ADMIN_PROVISIONING_UI_CONTRACT: PAK",
);