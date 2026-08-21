import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source =
  fs.readFileSync(
    path.join(
      process.cwd(),
      "src/lib/syncService.ts"
    ),
    "utf8"
  );

const triggerCalls =
  source.match(
    /void\s+retryPendingFinanceOutboxForActiveScope\s*\(\s*\)\s*;/g
  ) ?? [];

assert.equal(
  triggerCalls.length,
  3,
  "finance retry must be wired only to hydration, online, and login/switch"
);

assert.match(
  source,
  /Stores hydrated[\s\S]{0,300}void\s+retryPendingFinanceOutboxForActiveScope\s*\(\s*\)/,
  "hydration trigger missing"
);

assert.match(
  source,
  /const\s+handleOnline[\s\S]{0,300}void\s+retryPendingFinanceOutboxForActiveScope\s*\(\s*\)/,
  "online trigger missing"
);

assert.match(
  source,
  /User login or switch detected[\s\S]{0,300}void\s+retryPendingFinanceOutboxForActiveScope\s*\(\s*\)/,
  "login/switch trigger missing"
);

assert.doesNotMatch(
  source,
  /addEventListener\s*\(\s*["']focus["'][\s\S]{0,500}retryPendingFinanceOutboxForActiveScope/,
  "focus must not trigger finance retry"
);

assert.doesNotMatch(
  source,
  /visibilitychange[\s\S]{0,500}retryPendingFinanceOutboxForActiveScope/,
  "visibilitychange must not trigger finance retry"
);

assert.doesNotMatch(
  source,
  /setInterval\s*\([\s\S]{0,500}retryPendingFinanceOutboxForActiveScope/,
  "periodic interval must not trigger finance retry"
);

assert.match(
  source,
  /if\s*\(\s*CLOUD_SYNC_DISABLED\s*\)[\s\S]{0,300}return\s*;/,
  "cloud sync disabled guard must remain"
);

console.log(
  "salesFinanceOutboxRetryLifecycleWiringSuite: PASS"
);