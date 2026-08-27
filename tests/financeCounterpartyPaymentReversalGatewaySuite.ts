import assert from "node:assert/strict";
import {
  persistFinanceCounterpartyPaymentReversalV1,
  type FinanceCounterpartyPaymentReversalRpcClient,
} from "../src/lib/finance/financeCounterpartyPaymentSupabaseGateway";

async function main(): Promise<void> {
  const calls: Array<{
    name: string;
    parameters: Record<string, unknown>;
  }> = [];

  const client: FinanceCounterpartyPaymentReversalRpcClient = {
    async rpc(functionName, parameters) {
      calls.push({
        name: functionName,
        parameters: parameters as unknown as Record<string, unknown>,
      });
      return {
        data: [
          {
            outcome: "CREATED",
            operation_id: "reverse-op-1",
            transaction_ids: ["reverse-op-1:REV:1"],
            movement_id: "reverse-op-1:PAYABLE-REVERSAL",
            reason: null,
          },
        ],
        error: null,
      };
    },
  };

  const row = await persistFinanceCounterpartyPaymentReversalV1(
    client,
    { operationId: "reverse-op-1" },
    { actorUserId: "user-1" },
    "user-1",
    "hash-1",
  );

  assert.equal(row.outcome, "CREATED");
  assert.equal(row.movement_id, "reverse-op-1:PAYABLE-REVERSAL");
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0]?.name,
    "persist_finance_counterparty_payment_reversal_v1",
  );
  assert.deepEqual(calls[0]?.parameters, {
    p_operation: { operationId: "reverse-op-1" },
    p_audit: { actorUserId: "user-1" },
    p_actor_user_id: "user-1",
    p_payload_hash: "hash-1",
  });

  console.log("FINANCE_COUNTERPARTY_PAYMENT_REVERSAL_GATEWAY: PAK");
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});