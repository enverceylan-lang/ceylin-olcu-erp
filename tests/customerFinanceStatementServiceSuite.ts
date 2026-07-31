import assert from "node:assert/strict";
import type { FinanceTransaction } from "../src/lib/finance/financeContracts";
import { calculateCustomerFinanceStatement } from "../src/lib/finance/customerFinanceStatementService";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1"
};

function transaction(overrides: Partial<FinanceTransaction> = {}): FinanceTransaction {
  const base: FinanceTransaction = {
    ...scope,
    id: "transaction-1",
    transactionId: "transaction-1",
    idempotencyKey: "transaction-1",
    transactionType: "SALE_CHARGE",
    direction: "DEBIT",
    paymentMethod: null,
    financeAccountId: null,
    counterAccountId: null,
    customerId: "customer-1",
    saleId: "sale-1",
    sourceDocumentId: "sale-1",
    sourceDocumentType: "SALE",
    grossAmount: 1000,
    commissionAmount: 0,
    netAmount: 1000,
    currency: "TRY",
    transactionDate: "2026-07-31",
    valueDate: "2026-07-31",
    dueDate: null,
    status: "POSTED",
    description: "Satış borçlandırması",
    externalReference: null,
    reversalOfTransactionId: null,
    createdBy: "admin-1",
    createdAt: "2026-07-31T09:20:00.000Z",
    postedAt: "2026-07-31T09:20:00.000Z",
    reversedAt: null,
    archivedAt: null,
    projectionSource: "SALE_CHARGE"
  };
  return { ...base, ...overrides };
}

const result = calculateCustomerFinanceStatement(
  [
    transaction({
      id: "collection-1",
      transactionId: "collection-1",
      idempotencyKey: "collection-1",
      transactionType: "COLLECTION",
      direction: "CREDIT",
      sourceDocumentId: "payment-1",
      sourceDocumentType: "SALE_PAYMENT",
      grossAmount: 400,
      netAmount: 400,
      description: "Tahsilat",
      transactionDate: "2026-08-02",
      createdAt: "2026-08-02T10:00:00.000Z",
      postedAt: "2026-08-02T10:00:00.000Z",
      projectionSource: "SALE_PAYMENT"
    }),
    transaction(),
    transaction({
      id: "refund-1",
      transactionId: "refund-1",
      idempotencyKey: "refund-1",
      transactionType: "REFUND",
      direction: "CREDIT",
      sourceDocumentId: "return-1",
      sourceDocumentType: "SALE_RETURN",
      grossAmount: 100,
      netAmount: 100,
      description: "İade",
      transactionDate: "2026-08-03",
      createdAt: "2026-08-03T11:00:00.000Z",
      postedAt: "2026-08-03T11:00:00.000Z",
      projectionSource: "SALE_RETURN"
    }),
    transaction({
      id: "archived-1",
      transactionId: "archived-1",
      idempotencyKey: "archived-1",
      grossAmount: 9000,
      netAmount: 9000,
      archivedAt: "2026-08-04T11:00:00.000Z"
    })
  ],
  scope,
  "customer-1",
  "TRY"
);

assert.equal(result.outcome, "CALCULATED");
if (result.outcome !== "CALCULATED") throw new Error("Expected calculated statement.");

assert.equal(result.statement.lines.length, 3);
assert.deepEqual(
  result.statement.lines.map(line => ({
    type: line.transactionType,
    debit: line.debitAmount,
    credit: line.creditAmount,
    balance: line.runningBalance
  })),
  [
    { type: "SALE_CHARGE", debit: 1000, credit: 0, balance: 1000 },
    { type: "COLLECTION", debit: 0, credit: 400, balance: 600 },
    { type: "REFUND", debit: 0, credit: 100, balance: 500 }
  ]
);

assert.equal(result.statement.openingBalance, 0);
assert.equal(result.statement.closingBalance, 500);
assert.equal(result.statement.summary.balance, 500);

const scopeMismatch = calculateCustomerFinanceStatement(
  [transaction({ branchId: "other-branch" })],
  scope,
  "customer-1",
  "TRY"
);

assert.deepEqual(scopeMismatch, {
  outcome: "REJECTED",
  reason: "FINANCE_SCOPE_MISMATCH"
});

console.log("customerFinanceStatementServiceSuite: PASS");