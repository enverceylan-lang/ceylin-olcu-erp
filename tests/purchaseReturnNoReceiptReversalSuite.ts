import assert from "node:assert/strict";
import fs from "node:fs";

const sql =
  fs.readFileSync(
    "docs/sql/20260828_purchase_return_authority_v1.sql",
    "utf8",
  );

assert.doesNotMatch(
  sql,
  /update\s+public\.supplier_receipts_v1/i,
);

assert.match(
  sql,
  /'PURCHASE_RETURN'/,
);
assert.match(
  sql,
  /'OUT'/,
);
assert.match(
  sql,
  /purchase_return_line_id/,
);

console.log(
  "purchaseReturnNoReceiptReversalSuite: PASS",
);
