import assert from "node:assert/strict";

import {
  parseFinanceSystemWorkflowApiRequest
} from "../src/lib/finance/financeSystemWorkflowApiContract";

const scope = {
  tenantId:
    "tenant-1",
  companyId:
    "company-1",
  branchId:
    "branch-1",
  accountingPeriodId:
    "period-1"
};

const transaction = {
  ...scope,
  id:
    "finance-1",
  transactionId:
    "transaction-1",
  idempotencyKey:
    "sale:sale-1:charge",
  transactionType:
    "SALE_CHARGE",
  direction:
    "DEBIT",
  paymentMethod:
    null,
  financeAccountId:
    null,
  counterAccountId:
    null,
  customerId:
    "customer-1",
  saleId:
    "sale-1",
  sourceDocumentId:
    "sale-1",
  sourceDocumentType:
    "SALE",
  grossAmount:
    100,
  commissionAmount:
    0,
  netAmount:
    100,
  currency:
    "TRY",
  transactionDate:
    "2026-07-31",
  valueDate:
    "2026-07-31",
  dueDate:
    null,
  status:
    "POSTED",
  description:
    null,
  externalReference:
    null,
  reversalOfTransactionId:
    null,
  createdBy:
    "user-1",
  createdAt:
    "2026-07-31T10:00:00.000Z",
  postedAt:
    "2026-07-31T10:00:00.000Z",
  reversedAt:
    null,
  archivedAt:
    null,
  projectionSource:
    "SALE_CHARGE"
};

const validSaleRequest =
  parseFinanceSystemWorkflowApiRequest({
    workflow:
      "SALE_APPROVAL",
    source: {
      ...scope,
      saleId:
        "sale-1",
      customerId:
        "customer-1",
      totalAmount:
        100,
      currency:
        "TRY",
      approvedByUserId:
        "user-1",
      approvedAt:
        "2026-07-31T10:00:00.000Z",
      sourceVersion:
        1,
      payloadHash:
        "hash-sale-1"
    },
    transaction
  });

assert.equal(
  validSaleRequest.valid,
  true
);

assert.deepEqual(
  parseFinanceSystemWorkflowApiRequest({
    workflow:
      "SALE_APPROVAL",
    source: {
      ...scope,
      saleId:
        "sale-2",
      customerId:
        "customer-1",
      totalAmount:
        100,
      currency:
        "TRY",
      approvedByUserId:
        "user-1",
      approvedAt:
        "2026-07-31T10:00:00.000Z",
      sourceVersion:
        1,
      payloadHash:
        "hash-sale-2"
    },
    transaction
  }),
  {
    valid:
      false,
    reason:
      "WORKFLOW_TRANSACTION_MISMATCH"
  }
);

assert.deepEqual(
  parseFinanceSystemWorkflowApiRequest({
    workflow:
      "MANUAL",
    source:
      {},
    transaction
  }),
  {
    valid:
      false,
    reason:
      "INVALID_WORKFLOW"
  }
);

console.log(
  "financeSystemWorkflowApiContractSuite: PASS"
);