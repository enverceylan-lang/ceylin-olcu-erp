import assert from "node:assert/strict";
import type {
  FinanceAccount,
  FinanceTransaction,
} from "../src/lib/finance/financeContracts";

const account = {
  id: "account-1",
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1",
  code: "100.01",
  name: "Merkez Kasa",
  type: "CASH",
  currency: "TRY",
  isActive: true,
  isDefaultCollection: true,
  isDefaultPayment: true,
  linkedBankAccountId: null,
  linkedPosAccountId: null,
  createdAt: "2026-07-27T10:00:00.000Z",
  updatedAt: "2026-07-27T10:00:00.000Z",
  archivedAt: null,
} satisfies FinanceAccount;

assert.equal("balance" in account, false);

const transaction = {
  id: "finance:sale:sale-1:charge",
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1",
  transactionId: "finance:sale:sale-1:charge",
  idempotencyKey: "finance:sale:sale-1:charge",
  transactionType: "SALE_CHARGE",
  direction: "DEBIT",
  paymentMethod: null,
  financeAccountId: null,
  counterAccountId: null,
  customerId: "customer-1",
  saleId: "sale-1",
  sourceDocumentId: "sale-1",
  sourceDocumentType: "SALE",
  grossAmount: 900,
  commissionAmount: 0,
  netAmount: 900,
  currency: "TRY",
  transactionDate: "2026-07-27",
  valueDate: "2026-07-27",
  dueDate: null,
  status: "POSTED",
  description: "Satış borcu",
  externalReference: null,
  reversalOfTransactionId: null,
  createdBy: "SALE_FINANCE_PROJECTION",
  createdAt: "2026-07-27T10:00:00.000Z",
  postedAt: "2026-07-27T10:00:00.000Z",
  reversedAt: null,
  archivedAt: null,
  projectionSource: "SALE_CHARGE",
} satisfies FinanceTransaction;

assert.equal(transaction.transactionType, "SALE_CHARGE");
assert.equal(transaction.projectionSource, "SALE_CHARGE");
assert.deepEqual(
  [
    transaction.tenantId,
    transaction.companyId,
    transaction.branchId,
    transaction.accountingPeriodId,
  ],
  ["tenant-1", "company-1", "branch-1", "period-1"],
);

console.log("[PASS] canonical finance contracts");
