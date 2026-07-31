import assert from "node:assert/strict";

import {
  FinanceSupabaseWorkflowSourceRepository,
  type FinanceWorkflowSourceSupabaseClient
} from "../src/lib/finance/financeSupabaseWorkflowSourceRepository";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1"
};

function createClient(
  row: Record<string, unknown> | null
): FinanceWorkflowSourceSupabaseClient {
  return {
    from(table) {
      assert.ok(
        table === "finance_sale_workflow_sources" ||
          table === "finance_sale_return_workflow_sources"
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

            eq() {
              return this;
            },

            async maybeSingle() {
              return {
                data: row,
                error: null
              };
            }
          };
        }
      };
    }
  };
}

async function main(): Promise<void> {
  const saleRepository =
    new FinanceSupabaseWorkflowSourceRepository(
      createClient({
        tenant_id: "tenant-1",
        company_id: "company-1",
        branch_id: "branch-1",
        accounting_period_id: "period-1",
        sale_id: "sale-1",
        customer_id: "customer-1",
        status: "ONAYLANDI",
        total_amount: 100,
        approved_by_user_id: "user-1"
      })
    );

  assert.deepEqual(
    await saleRepository.loadApprovedSale(scope, "sale-1"),
    {
      ...scope,
      id: "sale-1",
      customerId: "customer-1",
      status: "ONAYLANDI",
      totalAmount: 100,
      approvedByUserId: "user-1"
    }
  );

  const returnRepository =
    new FinanceSupabaseWorkflowSourceRepository(
      createClient({
        tenant_id: "tenant-1",
        company_id: "company-1",
        branch_id: "branch-1",
        accounting_period_id: "period-1",
        sale_return_id: "return-1",
        sale_id: "sale-1",
        customer_id: "customer-1",
        status: "ONAYLANDI",
        amount: 40,
        actor_user_id: "user-1"
      })
    );

  assert.deepEqual(
    await returnRepository.loadApprovedSaleReturn(scope, "return-1"),
    {
      ...scope,
      id: "return-1",
      saleId: "sale-1",
      customerId: "customer-1",
      status: "ONAYLANDI",
      amount: 40,
      actorUserId: "user-1"
    }
  );

  const emptyRepository =
    new FinanceSupabaseWorkflowSourceRepository(createClient(null));

  assert.equal(
    await emptyRepository.loadApprovedSale(scope, "missing-sale"),
    null
  );

  console.log(
    "financeSupabaseWorkflowSourceRepositorySuite: PASS"
  );
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});