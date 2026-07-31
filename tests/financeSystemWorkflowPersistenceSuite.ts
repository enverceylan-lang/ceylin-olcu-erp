import assert from "node:assert/strict";

import type {
  FinanceTransaction
} from "../src/lib/finance/financeContracts";

import {
  persistSystemWorkflowFinanceTransaction
} from "../src/lib/finance/financeSystemWorkflowPersistence";

import type {
  FinancePersistenceGateway
} from "../src/lib/finance/financePersistenceGateway";

import type {
  FinanceSystemWorkflowSourceRepository
} from "../src/lib/finance/financeSystemWorkflowSourceVerifier";

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

const saleCharge:
  FinanceTransaction = {
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

const gateway:
  FinancePersistenceGateway = {
  async persist(payload) {
    return {
      outcome:
        "CREATED",
      transactionId:
        payload.transaction.transaction_id
    };
  }
};

const sourceRepository:
  FinanceSystemWorkflowSourceRepository = {
  async loadApprovedSale() {
    return {
      ...scope,
      id:
        "sale-1",
      customerId:
        "customer-1",
      status:
        "ONAYLANDI",
      totalAmount:
        100,
      approvedByUserId:
        "user-1"
    };
  },

  async loadApprovedSaleReturn() {
    return {
      ...scope,
      id:
        "return-1",
      saleId:
        "sale-1",
      customerId:
        "customer-1",
      status:
        "ONAYLANDI",
      amount:
        40,
      actorUserId:
        "user-1"
    };
  }
};

async function main(): Promise<void> {
  assert.deepEqual(
    await persistSystemWorkflowFinanceTransaction(
      saleCharge,
      {
        workflow:
          "SALE_APPROVAL",
        actorUserId:
          "user-1",
        scope
      },
      {
        gateway,
        sourceRepository
      }
    ),
    {
      outcome:
        "CREATED",
      transactionId:
        "transaction-1"
    }
  );

  const missingSourceRepository:
    FinanceSystemWorkflowSourceRepository = {
    async loadApprovedSale() {
      return null;
    },
    async loadApprovedSaleReturn() {
      return null;
    }
  };

  assert.deepEqual(
    await persistSystemWorkflowFinanceTransaction(
      saleCharge,
      {
        workflow:
          "SALE_APPROVAL",
        actorUserId:
          "user-1",
        scope
      },
      {
        gateway,
        sourceRepository:
          missingSourceRepository
      }
    ),
    {
      outcome:
        "REJECT",
      reason:
        "SOURCE_INVALID",
      sourceReason:
        "SOURCE_NOT_FOUND"
    }
  );

  const wrongAmountRepository:
    FinanceSystemWorkflowSourceRepository = {
    ...sourceRepository,
    async loadApprovedSale() {
      return {
        ...scope,
        id:
          "sale-1",
        customerId:
          "customer-1",
        status:
          "ONAYLANDI",
        totalAmount:
          101,
        approvedByUserId:
          "user-1"
      };
    }
  };

  assert.deepEqual(
    await persistSystemWorkflowFinanceTransaction(
      saleCharge,
      {
        workflow:
          "SALE_APPROVAL",
        actorUserId:
          "user-1",
        scope
      },
      {
        gateway,
        sourceRepository:
          wrongAmountRepository
      }
    ),
    {
      outcome:
        "REJECT",
      reason:
        "SOURCE_INVALID",
      sourceReason:
        "SOURCE_AMOUNT_MISMATCH"
    }
  );

  console.log(
    "financeSystemWorkflowPersistenceSuite: PASS"
  );
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});