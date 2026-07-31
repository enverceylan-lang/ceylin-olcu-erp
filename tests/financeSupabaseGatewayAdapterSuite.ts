import assert from "node:assert/strict";

import {
  FinanceSupabaseGatewayAdapter,
  type FinanceSupabaseRpcClient
} from "../src/lib/finance/financeSupabaseGatewayAdapter";

import type {
  FinanceSupabasePersistencePayload
} from "../src/lib/finance/financeSupabasePayload";

const payload:
  FinanceSupabasePersistencePayload = {
  transaction: {
    id:
      "finance-1",
    transaction_id:
      "transaction-1",
    idempotency_key:
      "sale:sale-1:charge",

    tenant_id:
      "tenant-1",
    company_id:
      "company-1",
    branch_id:
      "branch-1",
    accounting_period_id:
      "period-2026",

    transaction_type:
      "SALE_CHARGE",
    direction:
      "DEBIT",
    payment_method:
      null,

    finance_account_id:
      null,
    counter_account_id:
      null,

    customer_id:
      "customer-1",
    sale_id:
      "sale-1",

    source_document_id:
      "sale-1",
    source_document_type:
      "SALE",

    gross_amount:
      1250,
    commission_amount:
      0,
    net_amount:
      1250,

    currency:
      "TRY",

    transaction_date:
      "2026-07-31",
    value_date:
      "2026-07-31",
    due_date:
      "2026-08-31",

    status:
      "POSTED",

    description:
      "Satış borç kaydı",
    external_reference:
      null,
    reversal_of_transaction_id:
      null,

    created_by:
      "user-1",
    created_at:
      "2026-07-31T07:00:00.000Z",
    posted_at:
      "2026-07-31T07:00:00.000Z",
    reversed_at:
      null,
    archived_at:
      null,

    projection_source:
      "SALE_CHARGE"
  },

  audit: {
    id:
      "audit:transaction-1",
    transaction_id:
      "transaction-1",
    idempotency_key:
      "sale:sale-1:charge",

    tenant_id:
      "tenant-1",
    company_id:
      "company-1",
    branch_id:
      "branch-1",
    accounting_period_id:
      "period-2026",

    action:
      "POSTED",
    actor_user_id:
      "user-1",
    customer_id:
      "customer-1",
    sale_id:
      "sale-1",
    occurred_at:
      "2026-07-31T07:00:00.000Z",

    payload_hash:
      "abc12345"
  }
};

async function main(): Promise<void> {
  const captured:
    unknown[] = [];

  const createdClient:
    FinanceSupabaseRpcClient = {
    async rpc(
      functionName,
      parameters
    ) {
      captured.push({
        functionName,
        parameters
      });

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

  const createdAdapter =
    new FinanceSupabaseGatewayAdapter(
      createdClient
    );

  assert.deepEqual(
    await createdAdapter.persist(
      payload
    ),
    {
      outcome:
        "CREATED",
      transactionId:
        "transaction-1"
    }
  );

  assert.equal(
    captured.length,
    1
  );

  const replayAdapter =
    new FinanceSupabaseGatewayAdapter({
      async rpc() {
        return {
          data: [
            {
              outcome:
                "REPLAY",
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
    });

  assert.deepEqual(
    await replayAdapter.persist(
      payload
    ),
    {
      outcome:
        "REPLAY",
      transactionId:
        "transaction-1"
    }
  );

  const conflictAdapter =
    new FinanceSupabaseGatewayAdapter({
      async rpc() {
        return {
          data: [
            {
              outcome:
                "CONFLICT",
              transaction_id:
                "transaction-1",
              reason:
                "IDEMPOTENCY_PAYLOAD_CONFLICT"
            }
          ],
          error:
            null
        };
      }
    });

  assert.deepEqual(
    await conflictAdapter.persist(
      payload
    ),
    {
      outcome:
        "CONFLICT",
      transactionId:
        "transaction-1",
      reason:
        "IDEMPOTENCY_PAYLOAD_CONFLICT"
    }
  );

  const rpcErrorAdapter =
    new FinanceSupabaseGatewayAdapter({
      async rpc() {
        return {
          data:
            null,
          error: {
            message:
              "database unavailable"
          }
        };
      }
    });

  await assert.rejects(
    () =>
      rpcErrorAdapter.persist(
        payload
      ),
    /FINANCE_SUPABASE_RPC_FAILED:database unavailable/
  );

  const emptyResultAdapter =
    new FinanceSupabaseGatewayAdapter({
      async rpc() {
        return {
          data: [],
          error:
            null
        };
      }
    });

  await assert.rejects(
    () =>
      emptyResultAdapter.persist(
        payload
      ),
    /FINANCE_SUPABASE_RPC_RESULT_INVALID/
  );

  const conflictWithoutReasonAdapter =
    new FinanceSupabaseGatewayAdapter({
      async rpc() {
        return {
          data: [
            {
              outcome:
                "CONFLICT",
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
    });

  await assert.rejects(
    () =>
      conflictWithoutReasonAdapter.persist(
        payload
      ),
    /FINANCE_SUPABASE_CONFLICT_REASON_REQUIRED/
  );

  const unexpectedReasonAdapter =
    new FinanceSupabaseGatewayAdapter({
      async rpc() {
        return {
          data: [
            {
              outcome:
                "CREATED",
              transaction_id:
                "transaction-1",
              reason:
                "SOURCE_DOCUMENT_CONFLICT"
            }
          ],
          error:
            null
        };
      }
    });

  await assert.rejects(
    () =>
      unexpectedReasonAdapter.persist(
        payload
      ),
    /FINANCE_SUPABASE_UNEXPECTED_REASON/
  );

  console.log(
    "financeSupabaseGatewayAdapterSuite: PASS"
  );
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});