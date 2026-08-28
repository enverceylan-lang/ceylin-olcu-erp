import assert from "node:assert/strict";
import fs from "node:fs";

const contract =
  fs.readFileSync(
    "src/lib/purchaseApprovalServerContract.ts",
    "utf8",
  );
const sql =
  fs.readFileSync(
    "docs/sql/20260827_purchase_approval_authority_v1.sql",
    "utf8",
  );

assert.match(
  contract,
  /purchasePrice1:\s*line\.unitPrice/,
);
assert.match(
  contract,
  /PURCHASE_DRAFT_DUPLICATE_STOCK_PRICE_CONFLICT/,
);
assert.doesNotMatch(
  contract,
  /purchasePrice2/,
);
assert.doesNotMatch(
  contract,
  /purchasePrice3/,
);
assert.doesNotMatch(
  contract,
  /purchasePrice4/,
);

assert.match(
  sql,
  /purchase_price1/i,
);
assert.doesNotMatch(
  sql,
  /purchase_price2/i,
);
assert.doesNotMatch(
  sql,
  /purchase_price3/i,
);
assert.doesNotMatch(
  sql,
  /purchase_price4/i,
);

console.log(
  "purchaseApprovalPrice1BoundarySuite: PASS",
);
