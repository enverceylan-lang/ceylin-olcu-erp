import assert from "node:assert/strict";
import {
  calculateTailorPayableBalance,
  decideTailorEarningAccrual,
  type TailorEarning,
  type TailorEarningAccrualRequest,
} from "../src/lib/tailorEarnings";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1",
};

function request(
  overrides: Partial<TailorEarningAccrualRequest> = {}
): TailorEarningAccrualRequest {
  return {
    ...scope,
    id: "earning-1",
    idempotencyKey: "earning:tailor-work-1",
    saleId: "sale-1",
    saleItemId: "sale-item-1",
    productionOrderId: "production-1",
    tailorWorkOrderId: "tailor-work-1",
    tailorId: "tailor-1",
    productionStatus: "READY",
    sewingFee: 150,
    approvedExtraWorkFee: 25,
    createdByUserId: "office-1",
    createdAt: "2026-07-26T03:50:00.000Z",
    ...overrides,
  };
}

const create = decideTailorEarningAccrual(request(), []);
assert.equal(create.outcome, "CREATE");
if (create.outcome !== "CREATE") {
  throw new Error("Hakediş oluşturulamadı.");
}
assert.equal(create.earning.amount, 175);
assert.equal(create.audit.previousStatus, null);
assert.equal(create.audit.nextStatus, "ACCRUED");

const saved = create.earning;
assert.equal(
  decideTailorEarningAccrual(request(), [saved]).outcome,
  "REPLAY"
);

const conflict = decideTailorEarningAccrual(
  request({ sewingFee: 200 }),
  [saved]
);
assert.equal(conflict.outcome, "REJECT");
if (conflict.outcome === "REJECT") {
  assert.equal(conflict.reason, "IDEMPOTENCY_CONFLICT");
}

const notReady = decideTailorEarningAccrual(
  request({ productionStatus: "SEWN" }),
  []
);
assert.equal(notReady.outcome, "REJECT");
if (notReady.outcome === "REJECT") {
  assert.equal(notReady.reason, "PRODUCTION_NOT_READY");
}

const duplicate = decideTailorEarningAccrual(
  request({ id: "earning-2", idempotencyKey: "other-key" }),
  [saved]
);
assert.equal(duplicate.outcome, "REJECT");
if (duplicate.outcome === "REJECT") {
  assert.equal(duplicate.reason, "DUPLICATE_WORK_ORDER");
}

const approved: TailorEarning = {
  ...saved,
  id: "earning-2",
  tailorWorkOrderId: "tailor-work-2",
  idempotencyKey: "earning:tailor-work-2",
  amount: 100,
  status: "APPROVED",
};
const paid: TailorEarning = {
  ...approved,
  id: "earning-3",
  tailorWorkOrderId: "tailor-work-3",
  status: "PAID",
};
assert.equal(
  calculateTailorPayableBalance([saved, approved, paid], "tailor-1"),
  275
);

console.log("[PASS] tailor earnings");
