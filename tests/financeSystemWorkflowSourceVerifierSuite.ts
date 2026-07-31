import assert from "node:assert/strict";

import type {
  FinanceTransaction
} from "../src/lib/finance/financeContracts";

import {
  verifyFinanceSystemWorkflowSource,
  type FinanceSystemWorkflowSourceRepository
} from "../src/lib/finance/financeSystemWorkflowSourceVerifier";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1"
};

const transaction: FinanceTransaction = {
  ...scope,
  id: "finance-1",
  transactionId: "transaction-1",
  idempotencyKey: "sale:sale-1:charge",
  transactionType: "SALE_CHARGE",
  direction: "DEBIT",
  paymentMethod: null,
  financeAccountId: null,
  counterAccountId: null,
  customerId: "customer-1",
  saleId: "sale-1",
  sourceDocumentId: "sale-1",
  sourceDocumentType: "SALE",
  grossAmount: 100,
  commissionAmount: 0,
  netAmount: 100,
  currency: "TRY",
  transactionDate: "2026-07-31",
  valueDate: "2026-07-31",
  dueDate: null,
  status: "POSTED",
  description: null,
  externalReference: null,
  reversalOfTransactionId: null,
  createdBy: "user-1",
  createdAt: "2026-07-31T10:00:00.000Z",
  postedAt: "2026-07-31T10:00:00.000Z",
  reversedAt: null,
  archivedAt: null,
  projectionSource: "SALE_CHARGE"
};

const repository: FinanceSystemWorkflowSourceRepository = {
  async loadApprovedSale() {
    return {
      ...scope,
      id: "sale-1",
      customerId: "customer-1",
      status: "ONAYLANDI",
      totalAmount: 100,
      approvedByUserId: "user-1"
    };
  },

  async loadApprovedSaleReturn() {
    return {
      ...scope,
      id: "return-1",
      saleId: "sale-1",
      customerId: "customer-1",
      status: "ONAYLANDI",
      amount: 40,
      actorUserId: "user-1"
    };
  }
};

async function main(): Promise<void> {
  assert.deepEqual(
    await verifyFinanceSystemWorkflowSource(
      transaction,
      "SALE_APPROVAL",
      repository
    ),
    { verified: true }
  );

  assert.deepEqual(
    await verifyFinanceSystemWorkflowSource(
      { ...transaction, netAmount: 101 },
      "SALE_APPROVAL",
      repository
    ),
    { verified: false, reason: "SOURCE_AMOUNT_MISMATCH" }
  );

  assert.deepEqual(
    await verifyFinanceSystemWorkflowSource(
      {
        ...transaction,
        transactionType: "REFUND",
        direction: "CREDIT",
        sourceDocumentType: "SALE_RETURN",
        sourceDocumentId: "return-1",
        grossAmount: 40,
        netAmount: 40,
        projectionSource: "SALE_RETURN"
      },
      "SALE_RETURN_APPROVAL",
      repository
    ),
    { verified: true }
  );

  console.log("financeSystemWorkflowSourceVerifierSuite: PASS");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});