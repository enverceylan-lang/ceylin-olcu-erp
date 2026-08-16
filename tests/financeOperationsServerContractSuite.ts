import assert from "node:assert/strict";
import {
  decideFinanceServerOperationContract
} from "../src/lib/finance/financeOperationsServerContract";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1"
};

const cash = {
  command: {
    ...scope,
    operationId: "operation-1",
    idempotencyKey: "idem-1",
    kind: "COLLECTION",
    channel: "CASH",
    action: "CREATE",
    amount: 100,
    currency: "TRY",
    paymentMethod: "CASH",
    accounts: {
      cashAccountId: "11111111-1111-4111-8111-111111111111",
      counterAccountId: "22222222-2222-4222-8222-222222222222"
    },
    source: {
      customerId: "customer-1",
      sourceDocumentId: "payment-1"
    },
    occurredAt: "2026-08-15T00:00:00.000Z"
  }
} as const;

const decision = decideFinanceServerOperationContract(cash, scope);
assert.equal(decision.allowed, true);
if (decision.allowed) {
  assert.equal(decision.guard.operation, "COLLECTION");
  assert.equal(decision.guard.requestedPermission, "finance.cash.collection.create");
}

assert.equal(
  decideFinanceServerOperationContract(
    {
      command: {
        ...cash.command,
        kind: "PAYMENT",
        source: { counterpartyId: "supplier-1" },
        accounts: {
          cashAccountId: "11111111-1111-4111-8111-111111111111",
          counterAccountId: "22222222-2222-4222-8222-222222222222"
        }
      }
    },
    scope
  ).allowed,
  true
);

assert.equal(
  decideFinanceServerOperationContract(
    {
      command: {
        ...cash.command,
        channel: "CHEQUE"
      }
    },
    scope
  ).allowed,
  false
);

console.log("[PASS] Finance Operations server contract");