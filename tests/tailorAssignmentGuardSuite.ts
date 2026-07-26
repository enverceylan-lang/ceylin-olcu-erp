import assert from "node:assert/strict";
import {
  decideTailorAssignment,
  type TailorAssignmentRequest,
  type TailorWorkOrder,
} from "../src/lib/tailorAssignmentGuard";
import type { MixedSupplySummary } from "../src/lib/supplierSupplyFlow";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1",
};

function request(
  overrides: Partial<TailorAssignmentRequest> = {}
): TailorAssignmentRequest {
  return {
    ...scope,
    id: "tailor-work-1",
    idempotencyKey: "tailor:production-1",
    saleId: "sale-1",
    productionOrderId: "production-1",
    assignedTailorId: "tailor-1",
    assignedByUserId: "office-1",
    assignedByRole: "OFFICE",
    assignedAt: "2026-07-26T03:40:00.000Z",
    ...overrides,
  };
}

function supply(
  status: MixedSupplySummary["status"]
): MixedSupplySummary {
  return {
    status,
    isMixedSource: true,
    requiredQuantity: 10,
    readyQuantity:
      status === "READY" ? 10 : status === "PARTIALLY_READY" ? 5 : 0,
    lines: [],
  };
}

const readyAssignment = decideTailorAssignment(
  request(),
  supply("READY"),
  []
);
assert.equal(readyAssignment.outcome, "CREATE");
const saved = (readyAssignment as { workOrder: TailorWorkOrder }).workOrder;
assert.equal(saved.partialStartApproved, false);
assert.equal(
  decideTailorAssignment(request(), supply("READY"), [saved]).outcome,
  "REPLAY"
);

const tailorCannotAssign = decideTailorAssignment(
  request({ assignedByRole: "TAILOR" }),
  supply("READY"),
  []
);
assert.equal(tailorCannotAssign.outcome, "REJECT");
if (tailorCannotAssign.outcome === "REJECT") {
  assert.equal(tailorCannotAssign.reason, "ROLE_FORBIDDEN");
}

const waitingCannotAssign = decideTailorAssignment(
  request(),
  supply("WAITING"),
  []
);
assert.equal(waitingCannotAssign.outcome, "REJECT");
if (waitingCannotAssign.outcome === "REJECT") {
  assert.equal(waitingCannotAssign.reason, "SUPPLY_NOT_READY");
}

const partialWithoutApproval = decideTailorAssignment(
  request(),
  supply("PARTIALLY_READY"),
  []
);
assert.equal(partialWithoutApproval.outcome, "REJECT");
if (partialWithoutApproval.outcome === "REJECT") {
  assert.equal(
    partialWithoutApproval.reason,
    "PARTIAL_APPROVAL_REQUIRED"
  );
}

const partialWithApproval = decideTailorAssignment(
  request({ partialStartApprovedByUserId: "admin-1" }),
  supply("PARTIALLY_READY"),
  []
);
assert.equal(partialWithApproval.outcome, "CREATE");
if (partialWithApproval.outcome === "CREATE") {
  assert.equal(partialWithApproval.workOrder.partialStartApproved, true);
}

const duplicateWorkOrder = decideTailorAssignment(
  request({
    id: "tailor-work-2",
    idempotencyKey: "other-key",
  }),
  supply("READY"),
  [saved]
);
assert.equal(duplicateWorkOrder.outcome, "REJECT");
if (duplicateWorkOrder.outcome === "REJECT") {
  assert.equal(duplicateWorkOrder.reason, "DUPLICATE_WORK_ORDER");
}

console.log("[PASS] tailor assignment guard");
