import assert from "node:assert/strict";
import {
  canStartSaleReturn,
  createSaleReturn,
  type CreateSaleReturnRequest
} from "../src/lib/saleReturnService";

const baseRequest:
  CreateSaleReturnRequest = {
    tenantId: "tenant-1",
    companyId: "company-1",
    branchId: "branch-1",
    accountingPeriodId: "period-1",

    saleId: "sale-1",
    customerId: "customer-1",
    saleStatus: "ONAYLANDI",
    actorUserId: "user-1",

    amount: 500,
    returnableAmount: 1000,
    currency: "try",
    reason: "Müşteri vazgeçti",
    occurredAt:
      "2026-07-31T01:30:00.000Z",
    idempotencyKey:
      "sale-return:sale-1:001"
  };

assert.equal(
  canStartSaleReturn("TEKLİF"),
  false
);

assert.equal(
  canStartSaleReturn("İPTAL"),
  false
);

assert.equal(
  canStartSaleReturn("TASLAK"),
  false
);

assert.equal(
  canStartSaleReturn("ONAYLANDI"),
  true
);

assert.equal(
  canStartSaleReturn("SİPARİŞ"),
  true
);

assert.equal(
  canStartSaleReturn(
    "ÜRETİME_GÖNDERİLDİ"
  ),
  true
);

assert.equal(
  canStartSaleReturn(
    "MONTAJA_GÖNDERİLDİ"
  ),
  true
);

assert.equal(
  canStartSaleReturn("TAMAMLANDI"),
  true
);

const accepted =
  createSaleReturn(baseRequest);

assert.equal(
  accepted.outcome,
  "ACCEPTED"
);

if (accepted.outcome !== "ACCEPTED") {
  throw new Error(
    "Expected accepted sale return."
  );
}

assert.equal(
  accepted.saleReturn.status,
  "BAŞLATILDI"
);

assert.equal(
  accepted.saleReturn.currency,
  "TRY"
);

assert.equal(
  accepted.saleReturn.amount,
  500
);

assert.equal(
  accepted.saleReturn.saleId,
  "sale-1"
);

assert.equal(
  accepted.saleReturn.customerId,
  "customer-1"
);

assert.equal(
  accepted.saleReturn.tenantId,
  "tenant-1"
);

assert.equal(
  accepted.saleReturn.companyId,
  "company-1"
);

assert.equal(
  accepted.saleReturn.branchId,
  "branch-1"
);

assert.equal(
  accepted.saleReturn
    .accountingPeriodId,
  "period-1"
);

const replay =
  createSaleReturn({
    ...baseRequest
  });

assert.equal(
  replay.outcome,
  "ACCEPTED"
);

if (replay.outcome !== "ACCEPTED") {
  throw new Error(
    "Expected replay to be accepted."
  );
}

assert.equal(
  replay.saleReturn.id,
  accepted.saleReturn.id
);

const noScope =
  createSaleReturn({
    ...baseRequest,
    branchId: ""
  });

assert.deepEqual(
  noScope,
  {
    outcome: "REJECTED",
    reason: "SCOPE_REQUIRED"
  }
);

const invalidStatus =
  createSaleReturn({
    ...baseRequest,
    saleStatus: "TEKLİF"
  });

assert.deepEqual(
  invalidStatus,
  {
    outcome: "REJECTED",
    reason:
      "SALE_STATUS_NOT_RETURNABLE"
  }
);

const cancelledSale =
  createSaleReturn({
    ...baseRequest,
    saleStatus: "İPTAL"
  });

assert.deepEqual(
  cancelledSale,
  {
    outcome: "REJECTED",
    reason:
      "SALE_STATUS_NOT_RETURNABLE"
  }
);

const zeroAmount =
  createSaleReturn({
    ...baseRequest,
    amount: 0
  });

assert.deepEqual(
  zeroAmount,
  {
    outcome: "REJECTED",
    reason: "AMOUNT_INVALID"
  }
);

const excessiveAmount =
  createSaleReturn({
    ...baseRequest,
    amount: 1001
  });

assert.deepEqual(
  excessiveAmount,
  {
    outcome: "REJECTED",
    reason:
      "AMOUNT_EXCEEDS_RETURNABLE"
  }
);

const invalidCurrency =
  createSaleReturn({
    ...baseRequest,
    currency: "TL"
  });

assert.deepEqual(
  invalidCurrency,
  {
    outcome: "REJECTED",
    reason: "CURRENCY_INVALID"
  }
);

const missingActor =
  createSaleReturn({
    ...baseRequest,
    actorUserId: " "
  });

assert.deepEqual(
  missingActor,
  {
    outcome: "REJECTED",
    reason: "ACTOR_REQUIRED"
  }
);

const missingIdempotency =
  createSaleReturn({
    ...baseRequest,
    idempotencyKey: ""
  });

assert.deepEqual(
  missingIdempotency,
  {
    outcome: "REJECTED",
    reason:
      "IDEMPOTENCY_KEY_REQUIRED"
  }
);

const invalidDate =
  createSaleReturn({
    ...baseRequest,
    occurredAt: "invalid-date"
  });

assert.deepEqual(
  invalidDate,
  {
    outcome: "REJECTED",
    reason:
      "OCCURRED_AT_INVALID"
  }
);

console.log(
  "saleReturnServiceSuite: PASS"
);