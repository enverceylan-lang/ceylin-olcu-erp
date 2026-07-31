import assert from "node:assert/strict";

import type {
  FinanceSupabaseWorkflowCoordinatorClient
} from "../src/lib/finance/financeSupabaseWorkflowCoordinator";

import {
  handleFinanceSystemWorkflowApi
} from "../src/lib/finance/financeSystemWorkflowApiHandler";

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

const body = {
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
};

const client:
  FinanceSupabaseWorkflowCoordinatorClient = {
  from(table) {
    if (
      table ===
        "finance_sale_workflow_sources"
    ) {
      return {
        upsert() {
          return {
            select() {
              return this;
            },

            async single() {
              return {
                data: {
                  sale_id:
                    "sale-1"
                },
                error:
                  null
              };
            }
          };
        },

        select() {
          return {
            match() {
              return this;
            },

            eq() {
              return this;
            },

            async maybeSingle() {
              return {
                data: {
                  tenant_id:
                    "tenant-1",
                  company_id:
                    "company-1",
                  branch_id:
                    "branch-1",
                  accounting_period_id:
                    "period-1",
                  sale_id:
                    "sale-1",
                  customer_id:
                    "customer-1",
                  status:
                    "ONAYLANDI",
                  total_amount:
                    100,
                  approved_by_user_id:
                    "user-1"
                },
                error:
                  null
              };
            }
          };
        }
      };
    }

    throw new Error(
      `UNEXPECTED_TABLE:${table}`
    );
  },

  async rpc() {
    return {
      data: [
        {
          outcome:
            "CREATED",
          transaction_id:
            "transaction-1",
          reason:
            null
        }
      ],
      error:
        null
    };
  }
};

async function main(): Promise<void> {
  assert.deepEqual(
    await handleFinanceSystemWorkflowApi(
      body,
      {
        userId:
          "user-1",
        scope
      },
      client
    ),
    {
      status:
        201,
      body: {
        outcome:
          "CREATED",
        transactionId:
          "transaction-1"
      }
    }
  );

  assert.deepEqual(
    await handleFinanceSystemWorkflowApi(
      body,
      {
        userId:
          "user-2",
        scope
      },
      client
    ),
    {
      status:
        403,
      body: {
        outcome:
          "REJECT",
        reason:
          "ACTOR_MISMATCH"
      }
    }
  );

  assert.deepEqual(
    await handleFinanceSystemWorkflowApi(
      {
        ...body,
        workflow:
          "MANUAL"
      },
      {
        userId:
          "user-1",
        scope
      },
      client
    ),
    {
      status:
        400,
      body: {
        outcome:
          "REJECT",
        reason:
          "INVALID_WORKFLOW"
      }
    }
  );

  console.log(
    "financeSystemWorkflowApiHandlerSuite: PASS"
  );
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});