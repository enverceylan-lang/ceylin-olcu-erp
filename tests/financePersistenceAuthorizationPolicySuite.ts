import assert from "node:assert/strict";

import type {
  FinanceTransaction
} from "../src/lib/finance/financeContracts";

import {
  decideFinancePersistenceAuthorization
} from "../src/lib/finance/financePersistenceAuthorizationPolicy";

const base:
  FinanceTransaction = {
  tenantId:
    "tenant-1",
  companyId:
    "company-1",
  branchId:
    "branch-1",
  accountingPeriodId:
    "period-1",

  id:
    "finance-1",
  transactionId:
    "transaction-1",
  idempotencyKey:
    "idempotency-1",

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

assert.deepEqual(
  decideFinancePersistenceAuthorization(
    base
  ),
  {
    allowed:
      true,
    authorization: {
      mode:
        "SYSTEM_WORKFLOW_ONLY",
      workflow:
        "SALE_APPROVAL"
    }
  }
);

assert.deepEqual(
  decideFinancePersistenceAuthorization({
    ...base,
    transactionType:
      "REFUND",
    direction:
      "CREDIT",
    sourceDocumentType:
      "SALE_RETURN",
    sourceDocumentId:
      "return-1",
    projectionSource:
      "SALE_RETURN"
  }),
  {
    allowed:
      true,
    authorization: {
      mode:
        "SYSTEM_WORKFLOW_ONLY",
      workflow:
        "SALE_RETURN_APPROVAL"
    }
  }
);

assert.deepEqual(
  decideFinancePersistenceAuthorization({
    ...base,
    transactionType:
      "COLLECTION",
    direction:
      "CREDIT",
    paymentMethod:
      "CASH",
    sourceDocumentType:
      "SALE_PAYMENT",
    sourceDocumentId:
      "payment-1",
    projectionSource:
      "SALE_PAYMENT"
  }),
  {
    allowed:
      true,
    authorization: {
      mode:
        "USER_FINANCE_OPERATION",
      channel:
        "CASH",
      permission:
        "finance.cash.collection.create",
      capability:
        "CASH_COLLECTION_CREATE"
    }
  }
);

assert.deepEqual(
  decideFinancePersistenceAuthorization({
    ...base,
    transactionType:
      "COLLECTION",
    direction:
      "CREDIT",
    paymentMethod:
      "CREDIT_CARD",
    sourceDocumentType:
      "SALE_PAYMENT",
    sourceDocumentId:
      "payment-1",
    projectionSource:
      "SALE_PAYMENT"
  }).allowed,
  true
);

assert.deepEqual(
  decideFinancePersistenceAuthorization({
    ...base,
    transactionType:
      "COLLECTION",
    direction:
      "CREDIT",
    paymentMethod:
      "EFT",
    sourceDocumentType:
      "SALE_PAYMENT",
    sourceDocumentId:
      "payment-1",
    projectionSource:
      "SALE_PAYMENT"
  }).allowed,
  true
);

assert.deepEqual(
  decideFinancePersistenceAuthorization({
    ...base,
    transactionType:
      "COLLECTION",
    direction:
      "CREDIT",
    paymentMethod:
      null,
    sourceDocumentType:
      "SALE_PAYMENT",
    sourceDocumentId:
      "payment-1",
    projectionSource:
      "SALE_PAYMENT"
  }),
  {
    allowed:
      false,
    reason:
      "PAYMENT_METHOD_REQUIRED"
  }
);

assert.deepEqual(
  decideFinancePersistenceAuthorization({
    ...base,
    transactionType:
      "PAYMENT"
  }),
  {
    allowed:
      false,
    reason:
      "UNSUPPORTED_TRANSACTION_TYPE"
  }
);

assert.deepEqual(
  decideFinancePersistenceAuthorization({
    ...base,
    sourceDocumentType:
      "MANUAL"
  }),
  {
    allowed:
      false,
    reason:
      "SOURCE_DOCUMENT_MISMATCH"
  }
);

console.log(
  "financePersistenceAuthorizationPolicySuite: PASS"
);