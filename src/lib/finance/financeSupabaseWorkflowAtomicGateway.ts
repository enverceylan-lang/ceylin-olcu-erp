import type {
  FinancePersistenceGateway,
  FinancePersistenceOutcome
} from "@/lib/finance/financePersistenceGateway";
import type {
  FinanceSupabasePersistencePayload
} from "@/lib/finance/financeSupabasePayload";
import type {
  FinanceSaleReturnWorkflowSourceRow,
  FinanceSaleWorkflowSourceRow
} from "@/lib/finance/financeWorkflowSourcePayload";

export type FinanceWorkflowAtomicSourceRow =
  | FinanceSaleWorkflowSourceRow
  | FinanceSaleReturnWorkflowSourceRow;

export interface FinanceWorkflowAtomicRpcResultRow {
  outcome: "CREATED" | "REPLAY" | "CONFLICT";
  transaction_id: string;
  reason:
    | "IDEMPOTENCY_PAYLOAD_CONFLICT"
    | "TRANSACTION_ID_CONFLICT"
    | "SOURCE_DOCUMENT_CONFLICT"
    | null;
}

export interface FinanceWorkflowAtomicRpcClient {
  rpc(
    functionName: "persist_finance_system_workflow_v1",
    parameters: {
      p_workflow: "SALE_APPROVAL" | "SALE_RETURN_APPROVAL";
      p_source: FinanceWorkflowAtomicSourceRow;
      p_transaction: FinanceSupabasePersistencePayload["transaction"];
      p_audit: FinanceSupabasePersistencePayload["audit"];
    }
  ): Promise<{
    data: FinanceWorkflowAtomicRpcResultRow[] | null;
    error: { message: string; code?: string } | null;
  }>;
}

function mapRow(
  row: FinanceWorkflowAtomicRpcResultRow
): FinancePersistenceOutcome {
  if (row.outcome === "CONFLICT") {
    if (!row.reason) {
      throw new Error("FINANCE_WORKFLOW_ATOMIC_CONFLICT_REASON_REQUIRED");
    }

    return {
      outcome: "CONFLICT",
      transactionId: row.transaction_id,
      reason: row.reason
    };
  }

  if (row.reason !== null) {
    throw new Error("FINANCE_WORKFLOW_ATOMIC_UNEXPECTED_REASON");
  }

  return {
    outcome: row.outcome,
    transactionId: row.transaction_id
  };
}

export class FinanceSupabaseWorkflowAtomicGateway
  implements FinancePersistenceGateway {
  constructor(
    private readonly client: FinanceWorkflowAtomicRpcClient,
    private readonly workflow: "SALE_APPROVAL" | "SALE_RETURN_APPROVAL",
    private readonly source: FinanceWorkflowAtomicSourceRow
  ) {}

  async persist(
    payload: FinanceSupabasePersistencePayload
  ): Promise<FinancePersistenceOutcome> {
    const response = await this.client.rpc(
      "persist_finance_system_workflow_v1",
      {
        p_workflow: this.workflow,
        p_source: this.source,
        p_transaction: payload.transaction,
        p_audit: payload.audit
      }
    );

    if (response.error) {
      throw new Error(
        `FINANCE_WORKFLOW_ATOMIC_RPC_FAILED:${response.error.message}`
      );
    }

    if (!response.data || response.data.length !== 1) {
      throw new Error("FINANCE_WORKFLOW_ATOMIC_RPC_RESULT_INVALID");
    }

    const row = response.data[0];

    if (!row.transaction_id || !row.transaction_id.trim()) {
      throw new Error("FINANCE_WORKFLOW_ATOMIC_TRANSACTION_ID_REQUIRED");
    }

    return mapRow(row);
  }
}