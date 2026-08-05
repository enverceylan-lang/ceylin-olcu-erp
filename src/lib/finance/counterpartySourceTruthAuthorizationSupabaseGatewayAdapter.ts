import type {
  ProviderEarningSourceTruth,
  SupplierReceiptSourceTruth
} from "./counterpartySourceTruthPersistenceGateway";

import type {
  CounterpartySourceTruthAuthorizationGateway
} from "./counterpartySourceTruthAuthorizationGateway";

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

export interface CounterpartySourceTruthAuthorizationSupabaseRpcClient {
  rpc(
    name:
      | "read_counterparty_supplier_receipt_source_v1"
      | "read_counterparty_provider_earning_source_v1",
    args: Record<string, unknown>
  ): PromiseLike<RpcResponse>;
}

function asRecordOrNull<T>(
  response: RpcResponse,
  errorCode: string
): T | null {
  if (response.error) {
    throw new Error(
      response.error.message ||
      errorCode
    );
  }

  if (response.data === null) {
    return null;
  }

  if (
    typeof response.data !== "object" ||
    Array.isArray(response.data)
  ) {
    throw new Error(
      "COUNTERPARTY_SOURCE_TRUTH_READ_INVALID_RESPONSE"
    );
  }

  return response.data as T;
}

export function createCounterpartySourceTruthAuthorizationSupabaseGatewayAdapter(
  client:
    CounterpartySourceTruthAuthorizationSupabaseRpcClient
): CounterpartySourceTruthAuthorizationGateway {
  return {
    async readSupplierReceiptSource(
      input
    ) {
      const response =
        await client.rpc(
          "read_counterparty_supplier_receipt_source_v1",
          {
            p_scope: {
              tenantId: input.tenantId,
              companyId: input.companyId,
              branchId: input.branchId,
              accountingPeriodId:
                input.accountingPeriodId
            },
            p_receipt_id:
              input.receiptId
          }
        );

      return asRecordOrNull<
        SupplierReceiptSourceTruth
      >(
        response,
        "COUNTERPARTY_SUPPLIER_SOURCE_READ_FAILED"
      );
    },

    async readProviderEarningSource(
      input
    ) {
      const response =
        await client.rpc(
          "read_counterparty_provider_earning_source_v1",
          {
            p_scope: {
              tenantId: input.tenantId,
              companyId: input.companyId,
              branchId: input.branchId,
              accountingPeriodId:
                input.accountingPeriodId
            },
            p_earnings_entry_id:
              input.earningsEntryId
          }
        );

      return asRecordOrNull<
        ProviderEarningSourceTruth
      >(
        response,
        "COUNTERPARTY_PROVIDER_SOURCE_READ_FAILED"
      );
    }
  };
}