import type {
  OperationRecord
} from "./operationsWorkflow";
import {
  createEstimatedProviderEarning,
  type ProviderEarningsLedgerResult,
  type ProviderEarningsLedgerState
} from "./providerEarningsLedgerService";
import type {
  ProviderEarningsCurrency
} from "./providerEarningsViewService";

export type ProviderCompletionBridgeRejectReason =
  | "OPERATION_NOT_COMPLETED"
  | "UNSUPPORTED_OPERATION_KIND"
  | "PROVIDER_NOT_ASSIGNED"
  | "INVALID_ESTIMATED_AMOUNT"
  | "INVALID_COMPLETED_AT";

export interface ProviderCompletionEarningsBridgeRequest {
  state:
    ProviderEarningsLedgerState;

  operation:
    OperationRecord;

  earningsEntryId:
    string;

  currency:
    ProviderEarningsCurrency;

  estimatedAmount:
    number;
}

export type ProviderCompletionEarningsBridgeResult =
  | ProviderEarningsLedgerResult
  | {
      outcome:
        "REJECTED";

      state:
        ProviderEarningsLedgerState;

      reason:
        ProviderCompletionBridgeRejectReason;
    };

function resolveProviderType(
  operation:
    OperationRecord
):
  | "TAILOR"
  | "INSTALLER"
  | null {
  if (
    operation.kind ===
    "TAILOR"
  ) {
    return "TAILOR";
  }

  if (
    operation.kind ===
    "INSTALLATION"
  ) {
    return "INSTALLER";
  }

  return null;
}

function hasValidEstimatedAmount(
  value:
    number
): boolean {
  return (
    Number.isFinite(value) &&
    value >= 0
  );
}

function hasValidCompletedAt(
  value:
    string | undefined
): value is string {
  if (!value) {
    return false;
  }

  return !Number.isNaN(
    new Date(value).getTime()
  );
}

export function createEstimatedEarningFromCompletedOperation(
  request:
    ProviderCompletionEarningsBridgeRequest
): ProviderCompletionEarningsBridgeResult {
  const {
    state,
    operation
  } = request;

  if (
    operation.status !==
    "COMPLETED"
  ) {
    return {
      outcome:
        "REJECTED",
      state,
      reason:
        "OPERATION_NOT_COMPLETED"
    };
  }

  const providerType =
    resolveProviderType(
      operation
    );

  if (!providerType) {
    return {
      outcome:
        "REJECTED",
      state,
      reason:
        "UNSUPPORTED_OPERATION_KIND"
    };
  }

  const providerCustomerId =
    String(
      operation.party?.id ||
      ""
    ).trim();

  if (!providerCustomerId) {
    return {
      outcome:
        "REJECTED",
      state,
      reason:
        "PROVIDER_NOT_ASSIGNED"
    };
  }

  if (
    !hasValidEstimatedAmount(
      request.estimatedAmount
    )
  ) {
    return {
      outcome:
        "REJECTED",
      state,
      reason:
        "INVALID_ESTIMATED_AMOUNT"
    };
  }

  if (
    !hasValidCompletedAt(
      operation.completedAt
    )
  ) {
    return {
      outcome:
        "REJECTED",
      state,
      reason:
        "INVALID_COMPLETED_AT"
    };
  }

  return createEstimatedProviderEarning(
    state,
    {
      tenantId:
        operation.tenantId,

      companyId:
        operation.companyId,

      branchId:
        operation.branchId,

      accountingPeriodId:
        operation.accountingPeriodId,

      id:
        request.earningsEntryId,

      operationId:
        operation.id,

      providerCustomerId,

      providerType,

      title:
        operation.title,

      occurredAt:
        operation.completedAt,

      currency:
        request.currency,

      estimatedAmount:
        request.estimatedAmount,

      sourceDocumentId:
        operation.saleId ||
        operation.sourceId
    }
  );
}