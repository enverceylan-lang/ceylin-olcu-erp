import assert from "node:assert/strict";
import {
  isFinanceOperationCombinationAllowed,
  validateFinanceOperationCommand
} from "../src/lib/finance/financeOperationsPolicy";

assert.equal(
  isFinanceOperationCombinationAllowed("COLLECTION", "CASH", "CREATE"),
  true
);
assert.equal(
  isFinanceOperationCombinationAllowed("PAYMENT", "POS", "CREATE"),
  false
);
assert.equal(
  isFinanceOperationCombinationAllowed("TRANSFER", "TRANSFER", "CREATE"),
  true
);
assert.equal(
  isFinanceOperationCombinationAllowed("REFUND", "POS", "CREATE"),
  true
);

const base = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1",
  operationId: "operation-1",
  idempotencyKey: "idem-1",
  kind: "COLLECTION" as const,
  channel: "CASH" as const,
  action: "CREATE" as const,
  amount: 100,
  currency: "TRY",
  paymentMethod: "CASH" as const,
  accounts: { cashAccountId: "cash-1" },
  source: { customerId: "customer-1" },
  occurredAt: "2026-08-15T00:00:00.000Z",
  description: null,
  reversalOfTransactionId: null
};

assert.deepEqual(validateFinanceOperationCommand(base), {
  ok: true,
  reason: null
});

assert.equal(
  validateFinanceOperationCommand({
    ...base,
    amount: 0
  }).reason,
  "FINANCE_OPERATION_AMOUNT_INVALID"
);

assert.equal(
  validateFinanceOperationCommand({
    ...base,
    source: { customerId: null }
  }).reason,
  "FINANCE_COLLECTION_CUSTOMER_REQUIRED"
);

console.log("[PASS] Finance Operations V1 policy");