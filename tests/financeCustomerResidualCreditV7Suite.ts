import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const sql = fs.readFileSync(
  path.join(
    process.cwd(),
    "docs/sql/20260822_finance_customer_receivable_snapshot_v1.sql"
  ),
  "utf8"
);

assert.match(sql, /ft\.customer_id\s*=\s*v_customer/);
assert.match(sql, /transaction_type\s*=\s*'COLLECTION'/);
assert.match(sql, /active_collection_total/);
assert.match(sql, /unallocatedCreditTotal/);
assert.match(
  sql,
  /om\.current_balance\s*-\s*[\s\S]{0,100}greatest\(tm\.active_collection_total\s*-\s*am\.active_allocation_total/
);
assert.match(
  sql,
  /tm\.active_collection_total\s*>=\s*am\.active_allocation_total/
);
assert.match(
  sql,
  /status\s*=\s*'POSTED'[\s\S]{0,80}reversed_at\s+is\s+null/
);

const contract = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/lib/finance/customerReceivableReadContracts.ts"
  ),
  "utf8"
);

assert.match(contract, /unallocatedCreditTotal:\s*number/);
assert.match(contract, /currentBalance:\s*signedMoney\(/);

console.log("[PASS] V7 residual customer credit canonical snapshot");
console.log("[PASS] due/open-item metrics remain separate from net cari balance");
console.log("[PASS] reversed collections are excluded from residual credit");
const collectionSql = fs.readFileSync(
  path.join(
    process.cwd(),
    "docs/sql/20260816_finance_collection_authority_v1.sql"
  ),
  "utf8"
);

assert.doesNotMatch(
  collectionSql,
  /FINANCE_COLLECTION_REVERSAL_ALLOCATION_NOT_FOUND/
);

assert.match(
  collectionSql,
  /FINANCE_COLLECTION_REVERSAL_TRANSACTION_NOT_FOUND/
);

assert.match(
  collectionSql,
  /for v_transaction in[\s\S]*transaction_type='COLLECTION'[\s\S]*for update/
);

assert.match(
  collectionSql,
  /FINANCE_COLLECTION_REVERSAL_CHANNEL_MISMATCH/
);

assert.match(
  collectionSql,
  /FINANCE_POS_COLLECTION_REVERSAL_STATE_INVALID/
);

assert.match(
  collectionSql,
  /for v_allocation in[\s\S]*finance_collection_allocations_v1[\s\S]*reversed_at is null/
);

console.log("[PASS] pure advance collection can be reversed without allocation rows");
console.log("[PASS] reversal still requires a real collection transaction and channel/state guards");
