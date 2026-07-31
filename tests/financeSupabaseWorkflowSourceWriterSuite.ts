import assert from "node:assert/strict";

import {
  FinanceSupabaseWorkflowSourceWriter,
  type FinanceWorkflowSourceWriteClient
} from "../src/lib/finance/financeSupabaseWorkflowSourceWriter";

const calls:
  Array<{
    table:
      string;
    values:
      object;
    onConflict:
      string;
  }> = [];

function createClient(
  returnedIdentity:
    Record<string, unknown>
): FinanceWorkflowSourceWriteClient {
  return {
    from(table) {
      return {
        upsert(values, options) {
          calls.push({
            table,
            values,
            onConflict:
              options.onConflict
          });

          assert.equal(
            options.ignoreDuplicates,
            false
          );

          return {
            select(columns) {
              assert.ok(
                columns === "sale_id" ||
                columns ===
                  "sale_return_id"
              );

              return this;
            },

            async single() {
              return {
                data:
                  returnedIdentity,
                error:
                  null
              };
            }
          };
        }
      };
    }
  };
}

async function main(): Promise<void> {
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

  const saleWriter =
    new FinanceSupabaseWorkflowSourceWriter(
      createClient({
        sale_id:
          "sale-1"
      })
    );

  assert.deepEqual(
    await saleWriter.writeApprovedSale({
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
    }),
    {
      outcome:
        "UPSERTED"
    }
  );

  const returnWriter =
    new FinanceSupabaseWorkflowSourceWriter(
      createClient({
        sale_return_id:
          "return-1"
      })
    );

  assert.deepEqual(
    await returnWriter.writeApprovedSaleReturn({
      ...scope,
      saleReturnId:
        "return-1",
      saleId:
        "sale-1",
      customerId:
        "customer-1",
      amount:
        40,
      currency:
        "TRY",
      actorUserId:
        "user-1",
      approvedAt:
        "2026-07-31T11:00:00.000Z",
      sourceVersion:
        1,
      payloadHash:
        "hash-return-1"
    }),
    {
      outcome:
        "UPSERTED"
    }
  );

  assert.equal(
    calls[0]?.table,
    "finance_sale_workflow_sources"
  );

  assert.equal(
    calls[0]?.onConflict,
    "tenant_id,company_id,branch_id,accounting_period_id,sale_id"
  );

  assert.equal(
    calls[1]?.table,
    "finance_sale_return_workflow_sources"
  );

  assert.equal(
    calls[1]?.onConflict,
    "tenant_id,company_id,branch_id,accounting_period_id,sale_return_id"
  );

  console.log(
    "financeSupabaseWorkflowSourceWriterSuite: PASS"
  );
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});