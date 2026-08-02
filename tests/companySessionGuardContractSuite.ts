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
      "src/lib/companySessionGuard.ts",
    ),
    "utf8",
  );

assert.match(
  source,
  /verifyAuth/,
);

assert.match(
  source,
  /readCompanySessionToken/,
);

assert.match(
  source,
  /session\.sessionType !== "COMPANY"/,
);

assert.match(
  source,
  /session\.sub !== actor\.id/,
);

assert.match(
  source,
  /session\.channel !== expectedChannel/,
);

console.log(
  "COMPANY_SESSION_GUARD_CONTRACT_TEST: PAK",
);