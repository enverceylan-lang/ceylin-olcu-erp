import assert from "node:assert/strict";
import {
  decideCustomerFinanceTransaction,
  summarizeCustomerFinance,
  type CustomerFinanceTransaction,
} from "../src/lib/customerFinanceLedger";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1",
};

function transaction(
  overrides: Partial<CustomerFinanceTransaction> = {}
): CustomerFinanceTransaction {
  return {
    ...scope,
    id: "sale-charge-1",
    idempotencyKey: "sale-charge:sale-1",
    customerId: "customer-1",
    saleId: "sale-1",
    type: "SALE_CHARGE",
    direction: "DEBIT",
    amount: 1000,
    status: "POSTED",
    createdByUserId: "office-1",
    createdAt: "2026-07-26T09:30:00.000Z",
    ...overrides,
  };
}

const charge = decideCustomerFinanceTransaction(transaction(), []);
assert.equal(charge.outcome, "CREATE");
if (charge.outcome !== "CREATE") throw new Error("Borç hareketi oluşmadı.");
assert.equal(charge.audit.previousStatus, null);
const chargeRecord = charge.transaction;

assert.equal(
  decideCustomerFinanceTransaction(transaction(), [chargeRecord]).outcome,
  "REPLAY"
);
assert.equal(
  decideCustomerFinanceTransaction(
    transaction({ amount: 900 }),
    [chargeRecord]
  ).outcome,
  "REJECT"
);

const paymentRequest = transaction({
  id: "payment-1",
  idempotencyKey: "payment:payment-1",
  paymentId: "payment-1",
  type: "PAYMENT_RECEIPT",
  direction: "CREDIT",
  amount: 400,
});
const payment = decideCustomerFinanceTransaction(
  paymentRequest,
  [chargeRecord]
);
assert.equal(payment.outcome, "CREATE");
if (payment.outcome !== "CREATE") throw new Error("Tahsilat oluşmadı.");

assert.deepEqual(
  summarizeCustomerFinance(
    [chargeRecord, payment.transaction],
    "customer-1",
    "sale-1"
  ),
  { debitTotal: 1000, creditTotal: 400, balance: 600 }
);

const duplicatePayment = decideCustomerFinanceTransaction(
  {
    ...paymentRequest,
    id: "payment-ledger-2",
    idempotencyKey: "payment:second-key",
  },
  [chargeRecord, payment.transaction]
);
assert.equal(duplicatePayment.outcome, "REJECT");
if (duplicatePayment.outcome === "REJECT") {
  assert.equal(duplicatePayment.reason, "DUPLICATE_PAYMENT");
}

const overpayment = decideCustomerFinanceTransaction(
  {
    ...paymentRequest,
    id: "payment-2",
    idempotencyKey: "payment:payment-2",
    paymentId: "payment-2",
    amount: 700,
  },
  [chargeRecord, payment.transaction]
);
assert.equal(overpayment.outcome, "REJECT");
if (overpayment.outcome === "REJECT") {
  assert.equal(overpayment.reason, "OVERPAYMENT");
}

const reversal = transaction({
  id: "reversal-1",
  idempotencyKey: "reversal:payment-1",
  type: "REVERSAL",
  direction: "DEBIT",
  amount: 400,
  reversesTransactionId: payment.transaction.id,
});
const reversalDecision = decideCustomerFinanceTransaction(
  reversal,
  [chargeRecord, payment.transaction]
);
assert.equal(reversalDecision.outcome, "CREATE");
if (reversalDecision.outcome !== "CREATE") {
  throw new Error("Ters kayıt oluşmadı.");
}
assert.equal(
  summarizeCustomerFinance(
    [chargeRecord, payment.transaction, reversalDecision.transaction],
    "customer-1",
    "sale-1"
  ).balance,
  1000
);

const secondReversal = decideCustomerFinanceTransaction(
  {
    ...reversal,
    id: "reversal-2",
    idempotencyKey: "reversal:second",
  },
  [chargeRecord, payment.transaction, reversalDecision.transaction]
);
assert.equal(secondReversal.outcome, "REJECT");
if (secondReversal.outcome === "REJECT") {
  assert.equal(secondReversal.reason, "ALREADY_REVERSED");
}

console.log("[PASS] customer finance ledger");
