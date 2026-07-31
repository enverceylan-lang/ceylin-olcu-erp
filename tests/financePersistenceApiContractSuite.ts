import assert from "node:assert/strict";

import type {
  FinanceTransaction
} from "../src/lib/finance/financeContracts";

import {
  decideFinancePersistenceApiContract
} from "../src/lib/finance/financePersistenceApiContract";

const activeScope = {
  tenantId:
    "tenant-1",
  companyId:
    "company-1",
  branchId:
    "branch-1",
  accountingPeriodId:
    "period-1"
};

const collection:
  FinanceTransaction = {
  ...activeScope,

  id:
    "finance-1",
  transactionId:
    "transaction-1",
  idempotencyKey:
    "payment-1",

  transactionType:
    "COLLECTION",
  direction:
    "CREDIT",
  paymentMethod:
    "CASH",

  financeAccountId:
    "cash-1",
  counterAccountId:
    "customer-receivable",

  customerId:
    "customer-1",
  saleId:
    "sale-1",

  sourceDocumentId:
    "payment-1",
  sourceDocumentType:
    "SALE_PAYMENT",

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
    "SALE_PAYMENT"
};

assert.deepEqual(
  decideFinancePersistenceApiContract(
    {
      transaction:
        collection
    },
    {
      id:
        "user-1"
    },
    activeScope
  ),
  {
    allowed:
      true,
    transaction:
      collection,
    guardInput: {
      channel:
        "CASH",
      operation:
        "COLLECTION",
      direction:
        "CREATE",
      requestedPermission:
        "finance.cash.collection.create",
      requestedCapability:
        "CASH_COLLECTION_CREATE"
    }
  }
);

assert.deepEqual(
  decideFinancePersistenceApiContract(
    {
      transaction: {
        ...collection,
        branchId:
          "branch-2"
      }
    },
    {
      id:
        "user-1"
    },
    activeScope
  ),
  {
    allowed:
      false,
    status:
      403,
    code:
      "SCOPE_MISMATCH"
  }
);

assert.deepEqual(
  decideFinancePersistenceApiContract(
    {
      transaction: {
        ...collection,
        createdBy:
          "other-user"
      }
    },
    {
      id:
        "user-1"
    },
    activeScope
  ),
  {
    allowed:
      false,
    status:
      403,
    code:
      "ACTOR_MISMATCH"
  }
);

assert.deepEqual(
  decideFinancePersistenceApiContract(
    {
      transaction: {
        ...collection,
        transactionType:
          "SALE_CHARGE",
        direction:
          "DEBIT",
        paymentMethod:
          null,
        sourceDocumentType:
          "SALE",
        sourceDocumentId:
          "sale-1",
        projectionSource:
          "SALE_CHARGE"
      }
    },
    {
      id:
        "user-1"
    },
    activeScope
  ),
  {
    allowed:
      false,
    status:
      409,
    code:
      "SYSTEM_WORKFLOW_ENDPOINT_REQUIRED"
  }
);

assert.deepEqual(
  decideFinancePersistenceApiContract(
    {},
    {
      id:
        "user-1"
    },
    activeScope
  ),
  {
    allowed:
      false,
    status:
      400,
    code:
      "INVALID_REQUEST"
  }
);

assert.deepEqual(
  decideFinancePersistenceApiContract(
    {
      transaction: {
        ...collection,
        transactionType:
          "PAYMENT"
      }
    },
    {
      id:
        "user-1"
    },
    activeScope
  ),
  {
    allowed:
      false,
    status:
      400,
    code:
      "TRANSACTION_AUTHORIZATION_DENIED"
  }
);

console.log(
  "financePersistenceApiContractSuite: PASS"
);