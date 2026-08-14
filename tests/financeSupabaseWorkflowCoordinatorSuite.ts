import assert from "node:assert/strict";

import type {
  FinanceTransaction
} from "../src/lib/finance/financeContracts";

import {
  persistSupabaseWorkflowSourceAndFinance,
  type FinanceSupabaseWorkflowCoordinatorClient
} from "../src/lib/finance/financeSupabaseWorkflowCoordinator";

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

const transaction:
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

const callOrder:
  string[] = [];

const client:
  FinanceSupabaseWorkflowCoordinatorClient = {
  from(table) {
    if (
      table ===
        "finance_sale_workflow_sources"
    ) {
      return {
        upsert(values, options) {
          callOrder.push(
            "SOURCE_WRITE"
          );

          assert.equal(
            values.sale_id,
            "sale-1"
          );

          assert.equal(
            options.onConflict,
            "tenant_id,company_id,branch_id,accounting_period_id,sale_id"
          );

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
              callOrder.push(
                "SOURCE_READ"
              );

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

  async rpc(functionName, parameters) {
    callOrder.push(
      "WORKFLOW_FINANCE_RPC"
    );

    assert.equal(
      functionName,
      "persist_finance_system_workflow_v1"
    );
    assert.equal(
      parameters.p_workflow,
      "SALE_APPROVAL"
    );
    assert.equal(
      parameters.p_source.sale_id,
      "sale-1"
    );
    assert.equal(
      parameters.p_transaction.transaction_id,
      "transaction-1"
    );

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
  const result =
    await persistSupabaseWorkflowSourceAndFinance(
      {
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
        transaction,
        context: {
          workflow:
            "SALE_APPROVAL",
          actorUserId:
            "user-1",
          scope
        }
      },
      client
    );

  assert.deepEqual(
    result,
    {
      outcome:
        "CREATED",
      transactionId:
        "transaction-1"
    }
  );

  assert.deepEqual(
    callOrder,
    [
      "WORKFLOW_FINANCE_RPC"
    ]
  );

  console.log(
    "financeSupabaseWorkflowCoordinatorSuite: PASS"
  );
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});