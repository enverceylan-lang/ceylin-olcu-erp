import type { CollectionAllocation, CollectionResult } from "@/lib/finance/collectionContracts";

interface CollectionRpcRow {
  outcome: CollectionResult["outcome"];
  operation_id: string | null;
  transaction_ids: string[] | null;
  instrument_id: string | null;
  allocations: CollectionAllocation[] | null;
  reason: string | null;
  occurred_at: string | null;
}

export interface CollectionRpcClient {
  rpc(
    functionName: "persist_finance_collection_v1",
    parameters: {
      p_command: Record<string, unknown>;
      p_actor_user_id: string;
      p_payload_hash: string;
    }
  ): Promise<{ data: CollectionRpcRow[] | null; error: { message: string } | null }>;
}

interface MutationRpcRow {
  outcome: CollectionResult["outcome"];
  operation_id: string | null;
  transaction_ids: string[] | null;
  instrument_id?: string | null;
  reason: string | null;
  occurred_at: string | null;
}

export interface CollectionMutationRpcClient {
  rpc(
    functionName: "reverse_finance_collection_v1" | "transition_finance_receivable_instrument_v1",
    parameters: {
      p_command: Record<string, unknown>;
      p_actor_user_id: string;
      p_payload_hash: string;
    }
  ): Promise<{ data: MutationRpcRow[] | null; error: { message: string } | null }>;
}

export async function persistFinanceCollectionV1(
  client: CollectionRpcClient,
  command: Record<string, unknown>,
  actorUserId: string,
  payloadHash: string
): Promise<CollectionResult> {
  const response = await client.rpc("persist_finance_collection_v1", {
    p_command: command,
    p_actor_user_id: actorUserId,
    p_payload_hash: payloadHash
  });
  if (response.error) throw new Error("FINANCE_COLLECTION_RPC_FAILED");
  if (!response.data || response.data.length !== 1) {
    throw new Error("FINANCE_COLLECTION_RPC_RESULT_INVALID");
  }
  const row = response.data[0];
  return {
    outcome: row.outcome,
    operationId: row.operation_id,
    transactionIds: row.transaction_ids || [],
    instrumentId: row.instrument_id,
    allocations: row.allocations || [],
    reason: row.reason,
    occurredAt: row.occurred_at
  };
}

export async function persistCollectionMutationV1(
  client: CollectionMutationRpcClient,
  functionName: "reverse_finance_collection_v1" | "transition_finance_receivable_instrument_v1",
  command: Record<string, unknown>,
  actorUserId: string,
  payloadHash: string
): Promise<MutationRpcRow> {
  const response = await client.rpc(functionName, {
    p_command: command,
    p_actor_user_id: actorUserId,
    p_payload_hash: payloadHash
  });
  if (response.error) throw new Error("FINANCE_COLLECTION_MUTATION_RPC_FAILED");
  if (!response.data || response.data.length !== 1) {
    throw new Error("FINANCE_COLLECTION_MUTATION_RPC_RESULT_INVALID");
  }
  return response.data[0];
}
