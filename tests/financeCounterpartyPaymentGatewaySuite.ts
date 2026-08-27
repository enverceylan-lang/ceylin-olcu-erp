import assert from "node:assert/strict";
import {
  persistFinanceCounterpartyPaymentV1,
  type FinanceCounterpartyPaymentRpcClient,
} from "../src/lib/finance/financeCounterpartyPaymentSupabaseGateway";

const calls: Array<{
  name: string;
  parameters: Record<string, unknown>;
}> = [];

const client: FinanceCounterpartyPaymentRpcClient = {
  async rpc(functionName, parameters) {
    calls.push({
      name: functionName,
      parameters: parameters as unknown as Record<string, unknown>,
    });
    return {
      data: [
        {
          outcome: "CREATED",
          operation_id: "op-1",
          transaction_ids: ["tx-1"],
          movement_id: "op-1:PAYABLE",
          reason: null,
        },
      ],
      error: null,
    };
  },
};

async function main(): Promise<void> {
  const row = await persistFinanceCounterpartyPaymentV1(
    client,
    { operationId: "op-1" },
    { movementId: "op-1:PAYABLE" },
    { actorUserId: "user-1" },
    "user-1",
    "hash-1",
  );

  assert.equal(row.outcome, "CREATED");
  assert.equal(row.movement_id, "op-1:PAYABLE");
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.name, "persist_finance_counterparty_payment_v1");
  assert.deepEqual(calls[0]?.parameters, {
    p_operation: { operationId: "op-1" },
    p_movement: { movementId: "op-1:PAYABLE" },
    p_audit: { actorUserId: "user-1" },
    p_actor_user_id: "user-1",
    p_payload_hash: "hash-1",
  });

  console.log("FINANCE_COUNTERPARTY_PAYMENT_GATEWAY: PAK");
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
