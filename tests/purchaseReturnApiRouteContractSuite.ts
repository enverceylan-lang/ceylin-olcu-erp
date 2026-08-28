import assert from "node:assert/strict";
import fs from "node:fs";

const route =
  fs.readFileSync(
    "src/app/api/purchases/returns/route.ts",
    "utf8",
  );
const list =
  fs.readFileSync(
    "src/app/api/purchases/route.ts",
    "utf8",
  );

assert.match(
  route,
  /loadPurchaseServerAuthority/,
);
assert.match(
  route,
  /assertPurchaseReturnRequest/,
);
assert.match(
  route,
  /persist_purchase_return_authority_v1/,
);
assert.match(
  route,
  /authority\.context\.scope/,
);
assert.match(
  route,
  /authority\.user\.id/,
);

assert.match(
  list,
  /purchase_documents_authority_v1/,
);
assert.match(
  list,
  /purchase_return_lines_v1/,
);
assert.match(
  list,
  /\.eq\(\s*"tenant_id"/,
);
assert.match(
  list,
  /\.eq\(\s*"accounting_period_id"/,
);

console.log(
  "purchaseReturnApiRouteContractSuite: PASS",
);
