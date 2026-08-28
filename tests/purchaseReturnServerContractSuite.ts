import assert from "node:assert/strict";

import {
  assertPurchaseReturnRequest,
} from "../src/lib/purchaseReturnServerContract";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1",
};

const valid = {
  ...scope,
  purchaseReturnId: "return-1",
  purchaseDocumentId: "purchase-1",
  idempotencyKey: "PURCHASE_RETURN:return-1",
  returnedAt: "2026-08-28T10:00:00.000Z",
  reason: "Hatalı ürün",
  lines: [
    {
      purchaseDocumentLineId:
        "line-1",
      quantity: 2,
    },
  ],
};

assert.doesNotThrow(
  () =>
    assertPurchaseReturnRequest(
      valid,
      scope,
    ),
);

assert.throws(
  () =>
    assertPurchaseReturnRequest(
      {
        ...valid,
        lines: [
          valid.lines[0],
          valid.lines[0],
        ],
      },
      scope,
    ),
  /PURCHASE_RETURN_DUPLICATE_LINE/,
);

assert.throws(
  () =>
    assertPurchaseReturnRequest(
      {
        ...valid,
        companyId: "foreign",
      },
      scope,
    ),
  /PURCHASE_RETURN_SCOPE_MISMATCH/,
);

assert.throws(
  () =>
    assertPurchaseReturnRequest(
      {
        ...valid,
        lines: [
          {
            purchaseDocumentLineId:
              "line-1",
            quantity: 0,
          },
        ],
      },
      scope,
    ),
  /PURCHASE_RETURN_QUANTITY_INVALID/,
);

console.log(
  "purchaseReturnServerContractSuite: PASS",
);
