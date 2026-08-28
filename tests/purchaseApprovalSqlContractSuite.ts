import assert from "node:assert/strict";
import fs from "node:fs";

const sql =
  fs.readFileSync(
    "docs/sql/20260827_purchase_approval_authority_v1.sql",
    "utf8",
  );

assert.match(
  sql,
  /purchase_documents_authority_v1/i,
);
assert.match(
  sql,
  /persist_purchase_document_draft_v1/i,
);
assert.match(
  sql,
  /approve_purchase_document_authority_v1/i,
);
assert.match(
  sql,
  /PURCHASE_APPROVAL_SERVER_DRAFT_REQUIRED/i,
);
assert.match(
  sql,
  /PURCHASE_APPROVAL_STALE_DRAFT/i,
);
assert.match(
  sql,
  /for update/i,
);
assert.match(
  sql,
  /persist_counterparty_payable_movement_v1/i,
);
assert.match(
  sql,
  /'counterpartyType',\s*'SUPPLIER'/i,
);
assert.match(
  sql,
  /'kind',\s*'ACCRUAL'/i,
);
assert.match(
  sql,
  /'sourceDocumentId',\s*v_purchase_document_id/i,
);
assert.match(
  sql,
  /stock_purchase_price1_v1/i,
);
assert.match(
  sql,
  /force row level security/i,
);
assert.match(
  sql,
  /security definer/i,
);
assert.match(
  sql,
  /set search_path = pg_catalog, public/i,
);
assert.match(
  sql,
  /grant execute[\s\S]*to service_role/i,
);
assert.doesNotMatch(
  sql,
  /\bsupplier_receipts_v1\b/i,
);
assert.doesNotMatch(
  sql,
  /\bstock_movements_v1\b/i,
);
assert.doesNotMatch(
  sql,
  /\bdelete\s+from\b/i,
);

console.log(
  "purchaseApprovalSqlContractSuite: PASS",
);
