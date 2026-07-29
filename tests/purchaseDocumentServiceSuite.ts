import assert from "node:assert/strict";
import {
  decideCreatePurchaseDocument
} from "../src/lib/purchaseDocumentService";
import type {
  CreatePurchaseDocumentRequest
} from "../src/lib/purchaseContracts";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1"
};

const request:
  CreatePurchaseDocumentRequest = {
    ...scope,

    id: "purchase-1",

    idempotencyKey:
      "PURCHASE:SUPPLIER-1:FAT-1001",

    documentNo:
      "FAT-1001",

    supplierId:
      "supplier-1",

    supplierName:
      "Örnek Tedarikçi",

    documentDate:
      "2026-07-29T08:00:00.000Z",

    dueDate:
      "2026-08-29T08:00:00.000Z",

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
        discountRate: 10,
        taxRate: 20
      },
      {
        id: "line-2",
        kind: "SERVICE",
        description: "Nakliye",
        quantity: 1,
        unit: "hizmet",
        unitPrice: 250,
        discountRate: 0,
        taxRate: 20
      }
    ],

    createdByUserId:
      "admin-1",

    now:
      "2026-07-29T08:00:00.000Z"
  };

const created =
  decideCreatePurchaseDocument(
    request,
    []
  );

assert.equal(
  created.outcome,
  "CREATED"
);

if (created.outcome !== "CREATED") {
  throw new Error(
    "Belge oluşturulamadı."
  );
}

assert.equal(
  created.document.status,
  "DRAFT"
);

assert.equal(
  created.document.currency,
  "TRY"
);

assert.equal(
  created.document.lines.length,
  2
);

assert.equal(
  created.document.lines[0].netAmount,
  900
);

assert.equal(
  created.document.lines[0].taxAmount,
  180
);

assert.equal(
  created.document.lines[0].grossAmount,
  1080
);

assert.equal(
  created.document.totals.subtotal,
  1250
);

assert.equal(
  created.document.totals.discountTotal,
  100
);

assert.equal(
  created.document.totals.netTotal,
  1150
);

assert.equal(
  created.document.totals.taxTotal,
  230
);

assert.equal(
  created.document.totals.grandTotal,
  1380
);

const replay =
  decideCreatePurchaseDocument(
    request,
    [created.document]
  );

assert.equal(
  replay.outcome,
  "REPLAY"
);

const idempotencyConflict =
  decideCreatePurchaseDocument(
    {
      ...request,
      supplierName:
        "Değiştirilmiş Tedarikçi",
      lines: [
        {
          ...request.lines[0],
          quantity: 11
        }
      ]
    },
    [created.document]
  );

assert.equal(
  idempotencyConflict.outcome,
  "REJECTED"
);

if (
  idempotencyConflict.outcome ===
  "REJECTED"
) {
  assert.equal(
    idempotencyConflict.reason,
    "IDEMPOTENCY_CONFLICT"
  );
}

const duplicateDocumentNo =
  decideCreatePurchaseDocument(
    {
      ...request,
      id: "purchase-2",
      idempotencyKey:
        "PURCHASE:SUPPLIER-1:FAT-1001-SECOND"
    },
    [created.document]
  );

assert.equal(
  duplicateDocumentNo.outcome,
  "REJECTED"
);

if (
  duplicateDocumentNo.outcome ===
  "REJECTED"
) {
  assert.equal(
    duplicateDocumentNo.reason,
    "DUPLICATE_DOCUMENT_NO"
  );
}

const otherScope =
  decideCreatePurchaseDocument(
    {
      ...request,
      tenantId: "tenant-2",
      id: "purchase-tenant-2",
      idempotencyKey:
        request.idempotencyKey,
      documentNo:
        request.documentNo
    },
    [created.document]
  );

assert.equal(
  otherScope.outcome,
  "CREATED"
);

const missingStock =
  decideCreatePurchaseDocument(
    {
      ...request,
      id: "purchase-3",
      idempotencyKey:
        "PURCHASE:MISSING-STOCK",
      documentNo:
        "FAT-1002",
      lines: [
        {
          id: "line-missing-stock",
          kind: "GOODS",
          description: "Stoksuz Mal",
          quantity: 1,
          unit: "adet",
          unitPrice: 100,
          taxRate: 20
        }
      ]
    },
    []
  );

assert.equal(
  missingStock.outcome,
  "REJECTED"
);

if (
  missingStock.outcome ===
  "REJECTED"
) {
  assert.equal(
    missingStock.reason,
    "STOCK_ITEM_REQUIRED_FOR_GOODS"
  );
}

console.log(
  "PURCHASE_DOCUMENT_SERVICE_TEST: PAK"
);