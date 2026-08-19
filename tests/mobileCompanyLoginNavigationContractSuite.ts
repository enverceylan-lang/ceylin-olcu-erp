import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  "src/app/[companySlug]/page.tsx",
  "utf8",
);

assert.match(
  source,
  /window\.location\.replace\(\s*`\/\$\{companySlug\}\/\$\{COMPANY_HOME_SEGMENT\}`/,
);

assert.doesNotMatch(
  source,
  /router\.replace\(\s*`\/\$\{companySlug\}\/\$\{COMPANY_HOME_SEGMENT\}`/,
);

console.log(
  "PAK_MOBILE_COMPANY_LOGIN_HARD_NAVIGATION_V1"
);
