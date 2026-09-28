import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath: string): string {
  const fullPath = path.join(root, relativePath);
  assert.equal(
    fs.existsSync(fullPath),
    true,
    `Required same-line dependency missing: ${relativePath}`,
  );
  return fs.readFileSync(fullPath, "utf8");
}

const contractPath =
  "docs/contracts/ENVERP_INVOICE_SAME_LINE_REGRESSION_CONTRACT_V1.md";
const contract = read(contractPath);

for (let id = 1; id <= 20; id += 1) {
  const label = `F${String(id).padStart(2, "0")}`;
  assert.match(
    contract,
    new RegExp(`\\b${label}\\b`),
    `Living contract must define ${label}`,
  );
}

assert.match(
  contract,
  /Producer -> Canonical Authority -> Persistence -> Finance\/Stock\/Cari Effect -> Return\/Reversal -> Consumer/,
);
assert.match(contract, /FROZEN BASELINE/);
assert.match(contract, /Purchase Approval must not be a second stock-IN producer/);

const baselineSuites = [
  "tests/salesFaturalarFinalSemanticClosureSuite.ts",
  "tests/saleStockIdentityContract.test.ts",
  "tests/salesPaymentIdempotencySuite.ts",
  "tests/saleReturnFinanceCommandSuite.ts",
  "tests/saleReturnPersistenceContractSuite.ts",
  "tests/purchaseApprovalNoStockMutationSuite.ts",
  "tests/purchaseReturnNoReceiptReversalSuite.ts",
  "tests/purchaseReturnServerContractSuite.ts",
  "tests/purchaseFaturalarUiContractSuite.ts",
  "tests/saleDeletionPolicySuite.ts",
];

for (const relativePath of baselineSuites) {
  assert.equal(
    fs.existsSync(path.join(root, relativePath)),
    true,
    `Frozen baseline regression dependency missing: ${relativePath}`,
  );
}

const salesPersist = read(
  "src/app/api/sales/authority/persist/route.ts",
);
assert.match(salesPersist, /persistSaleDocumentAuthority/);
assert.match(salesPersist, /saleId:\s*body\.saleId/);

const salesApprove = read(
  "src/app/api/sales/authority/approve/route.ts",
);
assert.match(salesApprove, /approveSaleDocumentAuthority/);
assert.match(salesApprove, /saleId:\s*body\.saleId/);

const saleReturnPage = read("src/app/satis-iade/page.tsx");
assert.match(saleReturnPage, /saleReturn\.saleId/);
assert.match(saleReturnPage, /saleReturn\.customerId/);

const saleReturnAuthority = read(
  "src/app/api/sales/returns/authority/route.ts",
);
assert.match(saleReturnAuthority, /persistSaleReturnAuthority/);
assert.match(saleReturnAuthority, /stableFinanceOperationHash/);

const purchaseContract = read(
  "src/lib/purchaseApprovalServerContract.ts",
);
assert.match(purchaseContract, /purchaseDocumentId/);
assert.match(purchaseContract, /approvalIdempotencyKey/);
assert.match(purchaseContract, /stockItemId/);

const purchaseApproveRoute = read(
  "src/app/api/purchases/approve/route.ts",
);
assert.match(
  purchaseApproveRoute,
  /approve_purchase_document_authority_v1/,
);
assert.match(purchaseApproveRoute, /payable_movement_id/);

const purchaseApprovalSql = read(
  "docs/sql/20260827_purchase_approval_authority_v1.sql",
);
assert.doesNotMatch(
  purchaseApprovalSql,
  /\bstock_movements_v1\b/i,
  "Purchase approval must not become a second stock-IN producer.",
);

const purchaseReturnContract = read(
  "src/lib/purchaseReturnServerContract.ts",
);
assert.match(purchaseReturnContract, /purchaseDocumentId/);
assert.match(purchaseReturnContract, /purchaseDocumentLineId/);
assert.match(purchaseReturnContract, /idempotencyKey/);

const purchaseReturnRoute = read(
  "src/app/api/purchases/returns/route.ts",
);
assert.match(
  purchaseReturnRoute,
  /persist_purchase_return_authority_v1/,
);
assert.match(
  purchaseReturnRoute,
  /payable_reversal_movement_id/,
);

const purchaseReturnSql = read(
  "docs/sql/20260828_purchase_return_authority_v1.sql",
);
assert.match(purchaseReturnSql, /PURCHASE_RETURN_OVER_RETURN/);
assert.match(
  purchaseReturnSql,
  /PURCHASE_RETURN_INSUFFICIENT_STOCK/,
);
assert.match(
  purchaseReturnSql,
  /'PURCHASE_RETURN'[\s\S]*'OUT'/,
  "Purchase return stock OUT must remain bound to PURCHASE_RETURN authority.",
);

console.log(
  "invoiceSameLineRegressionContractSuite: PASS",
);
