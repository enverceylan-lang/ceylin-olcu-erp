import assert from "node:assert/strict";
import { decideCreatePurchaseDocument } from "../src/lib/purchaseDocumentService";
import type { CreatePurchaseDocumentRequest } from "../src/lib/purchaseContracts";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1"
};

function pendingRequest(
  overrides: Partial<CreatePurchaseDocumentRequest> = {}
): CreatePurchaseDocumentRequest {
  return {
    ...scope,
    id: "purchase-1",
    idempotencyKey: "PENDING_PURCHASE:receipt-1",
    documentNo: null,
    supplierId: "supplier-1",
    supplierName: "Tedarikçi 1",
    documentDate: null,
    lines: [{
      id: "line-1",
      kind: "GOODS",
      stockItemId: "stock-1",
      description: "Perde kumaşı",
      quantity: 10,
      unit: "mt",
      unitPrice: null,
      taxRate: null,
      taxIncluded: null,
      receivedQuantity: 10
    }],
    supplierOrderId: "order-1",
    supplierReceiptId: "receipt-1",
    createdByUserId: "user-1",
    now: "2026-08-27T00:00:00.000Z",
    ...overrides
  };
}

const pending = decideCreatePurchaseDocument(pendingRequest(), []);
assert.equal(pending.outcome, "CREATED");
if (pending.outcome !== "CREATED") throw new Error("pending create failed");
assert.equal(pending.document.status, "PENDING_INFO");
assert.equal(pending.document.lines[0].unitPrice, null);
assert.equal(pending.document.lines[0].taxRate, null);
assert.equal(pending.document.lines[0].taxIncluded, null);
assert.equal(pending.document.lines[0].pricingStatus, "INCOMPLETE");
assert.equal(pending.document.totals.pricingStatus, "INCOMPLETE");

const replay = decideCreatePurchaseDocument(pendingRequest(), [pending.document]);
assert.equal(replay.outcome, "REPLAY");

const conflict = decideCreatePurchaseDocument(
  pendingRequest({
    lines: [{ ...pendingRequest().lines[0], description: "Perde kumaşı değişti" }]
  }),
  [pending.document]
);
assert.equal(conflict.outcome, "REJECTED");
if (conflict.outcome === "REJECTED") {
  assert.equal(conflict.reason, "IDEMPOTENCY_CONFLICT");
}

const exclusive = decideCreatePurchaseDocument(
  pendingRequest({
    id: "purchase-exclusive",
    idempotencyKey: "purchase-exclusive",
    documentNo: "AF-1",
    documentDate: "2026-08-27T00:00:00.000Z",
    lines: [{
      ...pendingRequest().lines[0],
      quantity: 1,
      receivedQuantity: 1,
      unitPrice: 1000,
      taxRate: 10,
      taxIncluded: false
    }]
  }),
  []
);
assert.equal(exclusive.outcome, "CREATED");
if (exclusive.outcome === "CREATED") {
  assert.equal(exclusive.document.status, "DRAFT");
  assert.equal(exclusive.document.lines[0].netAmount, 1000);
  assert.equal(exclusive.document.lines[0].taxAmount, 100);
  assert.equal(exclusive.document.lines[0].grossAmount, 1100);
}

const inclusive = decideCreatePurchaseDocument(
  pendingRequest({
    id: "purchase-inclusive",
    idempotencyKey: "purchase-inclusive",
    documentNo: "AF-2",
    documentDate: "2026-08-27T00:00:00.000Z",
    lines: [{
      ...pendingRequest().lines[0],
      quantity: 1,
      receivedQuantity: 1,
      unitPrice: 1100,
      taxRate: 10,
      taxIncluded: true
    }]
  }),
  []
);
assert.equal(inclusive.outcome, "CREATED");
if (inclusive.outcome === "CREATED") {
  assert.equal(inclusive.document.lines[0].netAmount, 1000);
  assert.equal(inclusive.document.lines[0].taxAmount, 100);
  assert.equal(inclusive.document.lines[0].grossAmount, 1100);
}

const noSilentDefault = decideCreatePurchaseDocument(
  pendingRequest({
    id: "purchase-no-default",
    idempotencyKey: "purchase-no-default",
    documentNo: "AF-3",
    documentDate: "2026-08-27T00:00:00.000Z",
    lines: [{
      ...pendingRequest().lines[0],
      unitPrice: 1000,
      taxRate: null,
      taxIncluded: null
    }]
  }),
  []
);
assert.equal(noSilentDefault.outcome, "CREATED");
if (noSilentDefault.outcome === "CREATED") {
  assert.equal(noSilentDefault.document.status, "PENDING_INFO");
  assert.equal(noSilentDefault.document.lines[0].taxRate, null);
}

console.log("pendingPurchaseDocumentDraftSuite: PASS");
