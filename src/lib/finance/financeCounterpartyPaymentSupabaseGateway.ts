export type FinanceCounterpartyPaymentRpcOutcome =
  | "CREATED"
  | "REPLAY"
  | "CONFLICT"
  | "REJECT";

export interface FinanceCounterpartyPaymentRpcRow {
  outcome: FinanceCounterpartyPaymentRpcOutcome;
  operation_id: string | null;
  transaction_ids: string[] | null;
  movement_id: string | null;
  reason: string | null;
}

export interface FinanceCounterpartyPaymentRpcResponse {
  data: FinanceCounterpartyPaymentRpcRow[] | null;
  error: { message: string; code?: string } | null;
}

export interface FinanceCounterpartyPaymentRpcClient {
  rpc(
    functionName: "persist_finance_counterparty_payment_v1",
    parameters: {
      p_operation: Record<string, unknown>;
      p_movement: Record<string, unknown>;
      p_audit: Record<string, unknown>;
      p_actor_user_id: string;
      p_payload_hash: string;
    },
  ): Promise<FinanceCounterpartyPaymentRpcResponse>;
}

export async function persistFinanceCounterpartyPaymentV1(
  client: FinanceCounterpartyPaymentRpcClient,
  operation: Record<string, unknown>,
  movement: Record<string, unknown>,
  audit: Record<string, unknown>,
  actorUserId: string,
  payloadHash: string,
): Promise<FinanceCounterpartyPaymentRpcRow> {
  const response = await client.rpc(
    "persist_finance_counterparty_payment_v1",
    {
      p_operation: operation,
      p_movement: movement,
      p_audit: audit,
      p_actor_user_id: actorUserId,
      p_payload_hash: payloadHash,
    },
  );

  if (response.error) {
    throw new Error(
      `FINANCE_COUNTERPARTY_PAYMENT_RPC_FAILED:${response.error.message}`,
    );
  }

  if (!response.data || response.data.length !== 1) {
    throw new Error("FINANCE_COUNTERPARTY_PAYMENT_RPC_RESULT_INVALID");
  }

  return response.data[0];
}
export interface FinanceCounterpartyPaymentReversalRpcClient {
  rpc(
    functionName: "persist_finance_counterparty_payment_reversal_v1",
    parameters: {
      p_operation: Record<string, unknown>;
      p_audit: Record<string, unknown>;
      p_actor_user_id: string;
      p_payload_hash: string;
    },
  ): Promise<FinanceCounterpartyPaymentRpcResponse>;
}

export async function persistFinanceCounterpartyPaymentReversalV1(
  client: FinanceCounterpartyPaymentReversalRpcClient,
  operation: Record<string, unknown>,
  audit: Record<string, unknown>,
  actorUserId: string,
  payloadHash: string,
): Promise<FinanceCounterpartyPaymentRpcRow> {
  const response = await client.rpc(
    "persist_finance_counterparty_payment_reversal_v1",
    {
      p_operation: operation,
      p_audit: audit,
      p_actor_user_id: actorUserId,
      p_payload_hash: payloadHash,
    },
  );

  if (response.error) {
    throw new Error(
      `FINANCE_COUNTERPARTY_PAYMENT_REVERSAL_RPC_FAILED:${response.error.message}`,
    );
  }

  if (!response.data || response.data.length !== 1) {
    throw new Error(
      "FINANCE_COUNTERPARTY_PAYMENT_REVERSAL_RPC_RESULT_INVALID",
    );
  }

  return response.data[0];
}