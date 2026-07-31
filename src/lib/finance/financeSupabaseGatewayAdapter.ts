import type {
  FinancePersistenceGateway,
  FinancePersistenceOutcome
} from "@/lib/finance/financePersistenceGateway";

import type {
  FinanceSupabasePersistencePayload
} from "@/lib/finance/financeSupabasePayload";

export interface FinanceSupabaseRpcResultRow {
  outcome:
    | "CREATED"
    | "REPLAY"
    | "CONFLICT";
  transaction_id:
    string;
  reason:
    | "IDEMPOTENCY_PAYLOAD_CONFLICT"
    | "TRANSACTION_ID_CONFLICT"
    | "SOURCE_DOCUMENT_CONFLICT"
    | null;
}

export interface FinanceSupabaseRpcResponse {
  data:
    FinanceSupabaseRpcResultRow[] | null;
  error:
    {
      message:
        string;
      code?:
        string;
    } | null;
}

export interface FinanceSupabaseRpcClient {
  rpc(
    functionName:
      "persist_finance_transaction_v1",
    parameters: {
      p_transaction:
        FinanceSupabasePersistencePayload["transaction"];
      p_audit:
        FinanceSupabasePersistencePayload["audit"];
    }
  ): Promise<FinanceSupabaseRpcResponse>;
}

function mapRpcRow(
  row:
    FinanceSupabaseRpcResultRow
): FinancePersistenceOutcome {
  if (
    row.outcome ===
      "CONFLICT"
  ) {
    if (!row.reason) {
      throw new Error(
        "FINANCE_SUPABASE_CONFLICT_REASON_REQUIRED"
      );
    }

    return {
      outcome:
        "CONFLICT",
      transactionId:
        row.transaction_id,
      reason:
        row.reason
    };
  }

  if (row.reason !== null) {
    throw new Error(
      "FINANCE_SUPABASE_UNEXPECTED_REASON"
    );
  }

  return {
    outcome:
      row.outcome,
    transactionId:
      row.transaction_id
  };
}

export class FinanceSupabaseGatewayAdapter
implements FinancePersistenceGateway {
  constructor(
    private readonly client:
      FinanceSupabaseRpcClient
  ) {}

  async persist(
    payload:
      FinanceSupabasePersistencePayload
  ): Promise<FinancePersistenceOutcome> {
    const response =
      await this.client.rpc(
        "persist_finance_transaction_v1",
        {
          p_transaction:
            payload.transaction,
          p_audit:
            payload.audit
        }
      );

    if (response.error) {
      throw new Error(
        `FINANCE_SUPABASE_RPC_FAILED:${response.error.message}`
      );
    }

    if (
      !response.data ||
      response.data.length !== 1
    ) {
      throw new Error(
        "FINANCE_SUPABASE_RPC_RESULT_INVALID"
      );
    }

    const row =
      response.data[0];

    if (
      !row.transaction_id ||
      !row.transaction_id.trim()
    ) {
      throw new Error(
        "FINANCE_SUPABASE_TRANSACTION_ID_REQUIRED"
      );
    }

    return mapRpcRow(row);
  }
}