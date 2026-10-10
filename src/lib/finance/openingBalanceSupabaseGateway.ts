export type OpeningBalanceRpcOutcome =
  | "CREATED"
  | "REPLAY"
  | "CONFLICT"
  | "REJECT";

export interface OpeningBalanceRpcRow {
  outcome: OpeningBalanceRpcOutcome;
  operation_id: string | null;
  transaction_ids: string[] | null;
  reason: string | null;
}

export interface OpeningBalanceRpcClient {
  rpc(
    functionName: "persist_finance_opening_balance_v1",
    parameters: {
      p_command: Record<string, unknown>;
      p_actor_user_id: string;
      p_payload_hash: string;
    },
  ): Promise<{
    data: OpeningBalanceRpcRow[] | null;
    error: { message: string; code?: string } | null;
  }>;
}

export async function persistFinanceOpeningBalanceV1(
  client: OpeningBalanceRpcClient,
  command: Record<string, unknown>,
  actorUserId: string,
  payloadHash: string,
): Promise<OpeningBalanceRpcRow> {
  const response = await client.rpc("persist_finance_opening_balance_v1", {
    p_command: command,
    p_actor_user_id: actorUserId,
    p_payload_hash: payloadHash,
  });

  if (response.error) {
    throw new Error(`FINANCE_OPENING_BALANCE_RPC_FAILED:${response.error.message}`);
  }
  if (!response.data || response.data.length !== 1) {
    throw new Error("FINANCE_OPENING_BALANCE_RPC_RESULT_INVALID");
  }
  return response.data[0];
}
