import assert from "node:assert/strict";

import type {
  FinanceTransaction
} from "../src/lib/finance/financeContracts";

import {
  persistSupabaseSystemWorkflowFinance,
  type FinanceSupabaseSystemWorkflowClient
} from "../src/lib/finance/financeSupabaseSystemWorkflowOrchestrator";

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

let rpcCallCount = 0;
let sourceReadCount = 0;

const client: FinanceSupabaseSystemWorkflowClient = {
  from(table) {
    assert.equal(
      table,
      "finance_sale_workflow_sources"
    );

    return {
      select() {
        return {
          match(values) {
            assert.deepEqual(values, {
              tenant_id: "tenant-1",
              company_id: "company-1",
              branch_id: "branch-1",
              accounting_period_id: "period-1"
            });

            return this;
          },

          eq(column, value) {
            assert.equal(column, "sale_id");
            assert.equal(value, "sale-1");

            return this;
          },

          async maybeSingle() {
            sourceReadCount += 1;

            return {
              data: {
                tenant_id: "tenant-1",
                company_id: "company-1",
                branch_id: "branch-1",
                accounting_period_id: "period-1",
                sale_id: "sale-1",
                customer_id: "customer-1",
                status: "ONAYLANDI",
                total_amount: 100,
                approved_by_user_id: "user-1"
              },
              error: null
            };
          }
        };
      }
    };
  },

  async rpc(functionName, parameters) {
    rpcCallCount += 1;

    assert.equal(
      functionName,
      "persist_finance_transaction_v1"
    );

    assert.ok(
      parameters.p_transaction
    );

    assert.ok(
      parameters.p_audit
    );

    return {
      data: [
        {
          outcome: "CREATED",
          transaction_id: "transaction-1",
          reason: null
        }
      ],
      error: null
    };
  }
};

async function main(): Promise<void> {
  const result =
    await persistSupabaseSystemWorkflowFinance(
      transaction,
      {
        workflow: "SALE_APPROVAL",
        actorUserId: "user-1",
        scope
      },
      client
    );

  assert.deepEqual(
    result,
    {
      outcome: "CREATED",
      transactionId: "transaction-1"
    }
  );

  assert.equal(
    sourceReadCount,
    1
  );

  assert.equal(
    rpcCallCount,
    1
  );

  console.log(
    "financeSupabaseSystemWorkflowOrchestratorSuite: PASS"
  );
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});