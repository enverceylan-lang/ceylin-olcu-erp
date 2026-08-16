import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const route = fs.readFileSync(
  path.join(process.cwd(), "src/app/api/finance/operations/route.ts"),
  "utf8"
);

assert.match(route, /decidePosServerAuthorityContract/);
assert.match(route, /persistFinancePosAuthorityV1/);
assert.match(route, /stableFinanceOperationHash\(serverOperation\)/);
assert.match(route, /hasPosCommand\(body\)/);
assert.match(route, /user\.role !== "ADMIN"/);
assert.match(route, /guardServerFinanceChannelAccess/);
assert.match(route, /FINANCE_POS_ADMIN_REQUIRED/);
assert.match(route, /FINANCE_POS_PERSISTENCE_FAILED/);

// Existing generic Finance Operations path must remain present.
assert.match(route, /decideFinanceServerOperationContract/);
assert.match(route, /persistFinanceOperationV1/);
assert.match(route, /FINANCE_OPERATION_PERSISTENCE_FAILED/);

console.log("[PASS] pos server authority api route contract");
