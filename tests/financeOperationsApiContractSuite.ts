import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const route = readFileSync(
  resolve("src/app/api/finance/operations/route.ts"),
  "utf8"
);

assert.match(route, /verifyAuth/);
assert.match(route, /loadShadowErpContext/);
assert.match(route, /decideFinanceServerOperationContract/);
assert.match(route, /guardServerFinanceChannelAccess/);
assert.match(route, /persistFinanceOperationV1/);
assert.match(route, /context\.scope/);
assert.match(route, /UNAUTHORIZED/);
assert.match(route, /FINANCE_ACCESS_DENIED/);
assert.match(route, /FINANCE_OPERATION_PERSISTENCE_FAILED/);

console.log("[PASS] Finance Operations API contract");