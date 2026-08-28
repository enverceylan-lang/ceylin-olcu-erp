import assert from "node:assert/strict";

import {
  assertPurchaseApprovalRequest,
  buildPurchaseCanonicalDraft,
  hashPurchaseCanonicalDraft,
} from "../src/lib/purchaseApprovalServerContract";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1",
};

const draft =
  buildPurchaseCanonicalDraft({
    ...scope,
    purchaseDocumentId:
      "purchase-1",
    documentNo: "FAT-1001",
    supplierId: "supplier-1",
    supplierName:
      "Örnek Tedarikçi",
    documentDate:
      "2026-08-27T12:00:00.000Z",
    currency: "TRY",
    status: "DRAFT",
    lines: [
      {
        id: "line-1",
        kind: "GOODS",
        stockItemId: "stock-1",
        stockCode: "TUL-001",
        description: "Keten Tül",
        quantity: 10,
        unit: "mt",
        unitPrice: 100,
        taxRate: 10,
        taxIncluded: false,
      },
      {
        id: "line-2",
        kind: "SERVICE",
        stockItemId:
          "service-stock-1",
        description: "Nakliye",
        quantity: 1,
        unit: "hizmet",
        unitPrice: 110,
        taxRate: 20,
        taxIncluded: true,
      },
    ],
  });

assert.equal(
  draft.lines[0].grossAmount,
  1100,
);
assert.equal(
  draft.lines[1].grossAmount,
  110,
);
assert.equal(
  draft.grandTotal,
  1210,
);
assert.equal(
  draft.price1Updates[0]
    .purchasePrice1,
  100,
);

const hash =
  hashPurchaseCanonicalDraft(
    draft,
  );
assert.match(
  hash,
  /^[a-f0-9]{64}$/,
);

assert.doesNotThrow(
  () =>
    assertPurchaseApprovalRequest(
      {
        ...scope,
        purchaseDocumentId:
          "purchase-1",
        approvalIdempotencyKey:
          "approve-1",
        expectedDraftPayloadHash:
          hash,
      },
      scope,
    ),
);

assert.throws(
  () =>
    buildPurchaseCanonicalDraft({
      ...scope,
      purchaseDocumentId:
        "purchase-conflict",
      documentNo: "FAT-2",
      supplierId: "supplier-1",
      documentDate:
        "2026-08-27T12:00:00.000Z",
      currency: "TRY",
      status: "DRAFT",
      lines: [
        {
          id: "a",
          kind: "GOODS",
          stockItemId:
            "stock-1",
          description: "Tül A",
          quantity: 1,
          unit: "mt",
          unitPrice: 100,
          taxRate: 10,
          taxIncluded: false,
        },
        {
          id: "b",
          kind: "GOODS",
          stockItemId:
            "stock-1",
          description: "Tül B",
          quantity: 1,
          unit: "mt",
          unitPrice: 105,
          taxRate: 10,
          taxIncluded: false,
        },
      ],
    }),
  /PURCHASE_DRAFT_DUPLICATE_STOCK_PRICE_CONFLICT/,
);

console.log(
  "purchaseApprovalServerContractSuite: PASS",
);
