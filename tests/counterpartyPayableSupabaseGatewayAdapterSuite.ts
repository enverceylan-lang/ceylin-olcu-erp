import assert from "node:assert/strict";
import test from "node:test";

import {
  CounterpartyPayableSupabaseGatewayAdapter
} from "../src/lib/finance/counterpartyPayableSupabaseGatewayAdapter";

const movement = {
  tenantId:
    "tenant-1",
  companyId:
    "company-1",
  branchId:
    "branch-1",
  accountingPeriodId:
    "period-1",
  id:
    "movement-1",
  idempotencyKey:
    "idem-1",
  counterpartyCustomerId:
    "supplier-1",
  counterpartyType:
    "SUPPLIER" as const,
  kind:
    "ACCRUAL" as const,
  amount:
    100,
  currency:
    "TRY" as const,
  occurredAt:
    "2026-08-05T00:00:00.000Z",
  recordedAt:
    "2026-08-05T00:00:00.000Z"
};

const audit = {
  actorUserId:
    "admin-1",
  action:
    "CREATE" as const,
  recordedAt:
    "2026-08-05T00:00:00.000Z",
  source:
    "COUNTERPARTY_PAYABLE" as const
};

test(
  "adapter maps created replay and conflict",
  async () => {
    for (
      const row of
      [
        {
          outcome:
            "CREATED" as const,
          movement_id:
            "movement-1",
          reason:
            null
        },
        {
          outcome:
            "REPLAY" as const,
          movement_id:
            "movement-1",
          reason:
            null
        },
        {
          outcome:
            "CONFLICT" as const,
          movement_id:
            "movement-1",
          reason:
            "IDEMPOTENCY_PAYLOAD_CONFLICT" as const
        }
      ]
    ) {
      const adapter =
        new CounterpartyPayableSupabaseGatewayAdapter(
          {
            async rpc() {
              return {
                data:
                  [row],
                error:
                  null
              };
            }
          }
        );

      const result =
        await adapter.persist({
          movement,
          audit
        });

      assert.equal(
        result.outcome,
        row.outcome
      );

      assert.equal(
        result.movementId,
        "movement-1"
      );
    }
  }
);

test(
  "adapter fails closed on invalid rpc response",
  async () => {
    const adapter =
      new CounterpartyPayableSupabaseGatewayAdapter(
        {
          async rpc() {
            return {
              data:
                [],
              error:
                null
            };
          }
        }
      );

    await assert.rejects(
      () =>
        adapter.persist({
          movement,
          audit
        }),
      /COUNTERPARTY_PAYABLE_SUPABASE_RPC_RESULT_INVALID/
    );
  }
);