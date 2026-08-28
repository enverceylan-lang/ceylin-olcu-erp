import assert from "node:assert/strict";
import fs from "node:fs";

const sql =
  fs.readFileSync(
    "docs/sql/20260827_purchase_approval_authority_v1.sql",
    "utf8",
  );

assert.doesNotMatch(
  sql,
  /\bstock_movements_v1\b/i,
);
assert.doesNotMatch(
  sql,
  /\bsupplier_receipts_v1\b/i,
);
assert.doesNotMatch(
  sql,
  /\breceived_quantity\b/i,
);
assert.doesNotMatch(
  sql,
  /\bsupplier_order_lines_v1\b/i,
);

console.log(
  "purchaseApprovalNoStockMutationSuite: PASS",
);
