export type FinanceOperationRpcOutcome =
  | "CREATED"
  | "REPLAY"
  | "CONFLICT"
  | "REJECT";

export interface FinanceOperationRpcRow {
  outcome: FinanceOperationRpcOutcome;
  operation_id: string | null;
  transaction_ids: string[] | null;
  reason: string | null;
}

export interface FinanceOperationRpcResponse {
  data: FinanceOperationRpcRow[] | null;
  error: { message: string; code?: string } | null;
}

export interface FinanceOperationsRpcClient {
  rpc(
    functionName: "persist_finance_operation_v1",
    parameters: {
      p_operation: Record<string, unknown>;
      p_actor_user_id: string;
      p_payload_hash: string;
    }
  ): Promise<FinanceOperationRpcResponse>;
}

export async function persistFinanceOperationV1(
  client: FinanceOperationsRpcClient,
  operation: Record<string, unknown>,
  actorUserId: string,
  payloadHash: string
): Promise<FinanceOperationRpcRow> {
  const response = await client.rpc("persist_finance_operation_v1", {
    p_operation: operation,
    p_actor_user_id: actorUserId,
    p_payload_hash: payloadHash
  });

  if (response.error) {
    throw new Error(`FINANCE_OPERATION_RPC_FAILED:${response.error.message}`);
  }

  if (!response.data || response.data.length !== 1) {
    throw new Error("FINANCE_OPERATION_RPC_RESULT_INVALID");
  }

  return response.data[0];
}