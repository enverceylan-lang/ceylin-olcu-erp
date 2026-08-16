export type PosServerAuthorityRpcOutcome =
  | "CREATED"
  | "UPDATED"
  | "REPLAY"
  | "CONFLICT"
  | "REJECT";

export interface PosServerAuthorityRpcRow {
  outcome: PosServerAuthorityRpcOutcome;
  operation_id: string | null;
  transaction_ids: string[] | null;
  reason: string | null;
}

export interface PosServerAuthorityRpcResponse {
  data: PosServerAuthorityRpcRow[] | null;
  error: { message: string; code?: string } | null;
}

export interface PosServerAuthorityRpcClient {
  rpc(
    functionName: "persist_finance_pos_authority_v1",
    parameters: {
      p_operation: Record<string, unknown>;
      p_actor_user_id: string;
      p_payload_hash: string;
    }
  ): Promise<PosServerAuthorityRpcResponse>;
}

export async function persistFinancePosAuthorityV1(
  client: PosServerAuthorityRpcClient,
  operation: Record<string, unknown>,
  actorUserId: string,
  payloadHash: string
): Promise<PosServerAuthorityRpcRow> {
  const response = await client.rpc("persist_finance_pos_authority_v1", {
    p_operation: operation,
    p_actor_user_id: actorUserId,
    p_payload_hash: payloadHash
  });

  if (response.error) {
    throw new Error(`FINANCE_POS_AUTHORITY_RPC_FAILED:${response.error.message}`);
  }

  if (!response.data || response.data.length !== 1) {
    throw new Error("FINANCE_POS_AUTHORITY_RPC_RESULT_INVALID");
  }

  return response.data[0];
}
