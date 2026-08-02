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
      "src/lib/serverChannelAccess.ts",
    ),
    "utf8",
  );

assert.match(
  source,
  /\.from\("erp_package_licenses"\)/,
);

assert.match(
  source,
  /\.from\("erp_license_channel_access"\)/,
);

assert.match(
  source,
  /\.from\("erp_user_scope_channel_access"\)/,
);

assert.match(
  source,
  /channel_code/,
);

assert.match(
  source,
  /decideChannelAccess/,
);

console.log(
  "SERVER_CHANNEL_ACCESS_TEST: PAK",
);