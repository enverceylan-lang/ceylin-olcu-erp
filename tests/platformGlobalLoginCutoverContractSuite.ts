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
      "src/app/api/auth/login/route.ts",
    ),
    "utf8",
  );

assert.match(
  source,
  /user\.role\s*!==\s*"PLATFORM_SUPER_ADMIN"/,
  "Global login must reject every non-platform role.",
);

assert.match(
  source,
  /const sessionLifetimeSeconds\s*=\s*12\s*\*\s*60\s*\*\s*60/,
  "Platform global session must stay at 12 hours.",
);

assert.match(
  source,
  /rememberMe:\s*false/,
  "Platform global login must not persist remember-me.",
);

assert.doesNotMatch(
  source,
  /const rememberMe\s*=/,
  "Global platform login must not honor request rememberMe.",
);

assert.doesNotMatch(
  source,
  /30\s*\*\s*24\s*\*\s*60\s*\*\s*60/,
  "30-day session must not remain in platform global login.",
);

assert.match(
  source,
  /genericUnauthorized\(\)/,
  "Non-platform rejection must use generic unauthorized response.",
);

console.log(
  "PLATFORM_GLOBAL_LOGIN_CUTOVER_CONTRACT_TEST: PAK",
);