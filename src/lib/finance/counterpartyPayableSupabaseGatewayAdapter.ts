import type {
  CounterpartyPayablePersistenceGateway,
  CounterpartyPayablePersistenceOutcome,
  CounterpartyPayablePersistencePayload
} from "@/lib/finance/counterpartyPayablePersistenceGateway";

export interface CounterpartyPayableSupabaseRpcResultRow {
  outcome:
    | "CREATED"
    | "REPLAY"
    | "CONFLICT";
  movement_id:
    string;
  reason:
    | "IDEMPOTENCY_PAYLOAD_CONFLICT"
    | "MOVEMENT_ID_CONFLICT"
    | null;
}

export interface CounterpartyPayableSupabaseRpcResponse {
  data:
    CounterpartyPayableSupabaseRpcResultRow[]
    | null;
  error:
    {
      message:
        string;
    }
    | null;
}

export interface CounterpartyPayableSupabaseRpcClient {
  rpc(
    functionName:
      "persist_counterparty_payable_movement_v1",
    parameters: {
      p_movement:
        unknown;
      p_audit:
        unknown;
    }
  ): Promise<
    CounterpartyPayableSupabaseRpcResponse
  >;
}

function mapRpcRow(
  row:
    CounterpartyPayableSupabaseRpcResultRow
): CounterpartyPayablePersistenceOutcome {
  if (
    row.outcome ===
    "CONFLICT"
  ) {
    if (!row.reason) {
      throw new Error(
        "COUNTERPARTY_PAYABLE_SUPABASE_CONFLICT_REASON_REQUIRED"
      );
    }

    return {
      outcome:
        "CONFLICT",
      movementId:
        row.movement_id,
      reason:
        row.reason
    };
  }

  if (row.reason !== null) {
    throw new Error(
      "COUNTERPARTY_PAYABLE_SUPABASE_UNEXPECTED_REASON"
    );
  }

  return {
    outcome:
      row.outcome,
    movementId:
      row.movement_id
  };
}

export class CounterpartyPayableSupabaseGatewayAdapter
implements CounterpartyPayablePersistenceGateway {
  constructor(
    private readonly client:
      CounterpartyPayableSupabaseRpcClient
  ) {}

  async persist(
    payload:
      CounterpartyPayablePersistencePayload
  ): Promise<
    CounterpartyPayablePersistenceOutcome
  > {
    const response =
      await this.client.rpc(
        "persist_counterparty_payable_movement_v1",
        {
          p_movement: {
            ...payload.movement,
            movementId:
              payload.movement.id
          },
          p_audit:
            payload.audit
        }
      );

    if (response.error) {
      throw new Error(
        `COUNTERPARTY_PAYABLE_SUPABASE_RPC_FAILED:${response.error.message}`
      );
    }

    if (
      !response.data ||
      response.data.length !== 1
    ) {
      throw new Error(
        "COUNTERPARTY_PAYABLE_SUPABASE_RPC_RESULT_INVALID"
      );
    }

    const row =
      response.data[0];

    if (
      !row.movement_id ||
      !row.movement_id.trim()
    ) {
      throw new Error(
        "COUNTERPARTY_PAYABLE_SUPABASE_MOVEMENT_ID_REQUIRED"
      );
    }

    return mapRpcRow(row);
  }
}