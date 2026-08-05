import type {
  CounterpartySourceTruthActor,
  CounterpartySourceTruthPersistenceGateway,
  CounterpartySourceTruthPersistResult,
  ProviderEarningSourceTruth,
  SupplierReceiptSourceTruth
} from "./counterpartySourceTruthPersistenceGateway";

interface RpcResponse {
  data:
    | unknown
    | null;
  error:
    | {
        message?: string;
      }
    | null;
}

export interface SupabaseRpcClient {
  rpc(
    name: string,
    args: Record<string, unknown>
  ): PromiseLike<RpcResponse>;
}

function asResult(
  value: unknown
): CounterpartySourceTruthPersistResult {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    throw new Error(
      "COUNTERPARTY_SOURCE_TRUTH_INVALID_RPC_RESPONSE"
    );
  }

  const record =
    value as Record<string, unknown>;

  const status =
    String(
      record.status ||
      ""
    );

  if (
    status !== "CREATED" &&
    status !== "REPLAY" &&
    status !== "CONFLICT" &&
    status !== "REJECTED"
  ) {
    throw new Error(
      "COUNTERPARTY_SOURCE_TRUTH_INVALID_RPC_STATUS"
    );
  }

  return {
    status,
    sourceId:
      typeof record.sourceId === "string"
        ? record.sourceId
        : undefined,
    reason:
      typeof record.reason === "string"
        ? record.reason
        : undefined
  };
}

async function invoke(
  client: SupabaseRpcClient,
  rpcName: string,
  source: unknown,
  actor: CounterpartySourceTruthActor
): Promise<CounterpartySourceTruthPersistResult> {
  const response =
    await client.rpc(
      rpcName,
      {
        p_source:
          source,
        p_actor:
          actor
      }
    );

  if (response.error) {
    throw new Error(
      response.error.message ||
      "COUNTERPARTY_SOURCE_TRUTH_RPC_FAILED"
    );
  }

  return asResult(
    response.data
  );
}

export function createCounterpartySourceTruthSupabaseGatewayAdapter(
  client: SupabaseRpcClient
): CounterpartySourceTruthPersistenceGateway {
  return {
    async persistSupplierReceiptSource(
      source:
        SupplierReceiptSourceTruth,
      actor:
        CounterpartySourceTruthActor
    ) {
      return invoke(
        client,
        "persist_counterparty_supplier_receipt_source_v1",
        source,
        actor
      );
    },

    async persistProviderEarningSource(
      source:
        ProviderEarningSourceTruth,
      actor:
        CounterpartySourceTruthActor
    ) {
      return invoke(
        client,
        "persist_counterparty_provider_earning_source_v1",
        source,
        actor
      );
    }
  };
}