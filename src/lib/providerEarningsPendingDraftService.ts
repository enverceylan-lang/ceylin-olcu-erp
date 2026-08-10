import type {
  OperationRecord
} from "./operationsWorkflow";
import type {
  ProviderEarningsCurrency
} from "./providerEarningsViewService";

export type ProviderEarningsPendingDraftStatus =
  | "PENDING_AMOUNT"
  | "READY"
  | "CONVERTED"
  | "CANCELLED";

export interface ProviderEarningsPendingDraft {
  id: string;

  tenantId: string;
  companyId: string;
  branchId: string;
  accountingPeriodId: string;

  operationId: string;

  providerCustomerId:
    string;

  providerType:
    | "TAILOR"
    | "INSTALLER";

  title:
    string;

  currency:
    ProviderEarningsCurrency;

  estimatedAmount:
    number | null;

  status:
    ProviderEarningsPendingDraftStatus;

  completedAt:
    string;

  createdAt:
    string;

  updatedAt:
    string;

  sourceDocumentId?:
    string;
}

export interface ProviderEarningsPendingDraftState {
  drafts:
    ProviderEarningsPendingDraft[];
}

export interface CreateProviderEarningsPendingDraftRequest {
  state:
    ProviderEarningsPendingDraftState;

  operation:
    OperationRecord;

  draftId:
    string;

  currency:
    ProviderEarningsCurrency;

  occurredAt:
    string;

  estimatedAmount?:
    number | null;
}

export type CreateProviderEarningsPendingDraftResult =
  | {
      outcome:
        "CREATED";

      state:
        ProviderEarningsPendingDraftState;

      draft:
        ProviderEarningsPendingDraft;
    }
  | {
      outcome:
        "REPLAY";

      state:
        ProviderEarningsPendingDraftState;

      draft:
        ProviderEarningsPendingDraft;
    }
  | {
      outcome:
        "REJECTED";

      state:
        ProviderEarningsPendingDraftState;

      reason:
        | "OPERATION_NOT_COMPLETED"
        | "UNSUPPORTED_OPERATION_KIND"
        | "PROVIDER_NOT_ASSIGNED"
        | "INVALID_COMPLETED_AT"
        | "INVALID_ESTIMATED_AMOUNT";
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

function isValidDate(
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

function normalizeAmount(
  value:
    number | null | undefined
): number | null {
  if (
    value === null ||
    typeof value ===
      "undefined"
  ) {
    return null;
  }

  if (
    !Number.isFinite(value) ||
    value < 0
  ) {
    return Number.NaN;
  }

  return (
    Math.round(
      (value + Number.EPSILON) *
        100
    ) / 100
  );
}

export function createProviderEarningsPendingDraft(
  request:
    CreateProviderEarningsPendingDraftRequest
): CreateProviderEarningsPendingDraftResult {
  const {
    operation,
    state
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
    operation.party
      ?.providerCustomerId
      ?.trim();

  if (
    operation.party
      ?.assignmentType !==
      "EXTERNAL" ||
    !providerCustomerId
  ) {
    return {
      outcome:
        "REJECTED",
      state,
      reason:
        "PROVIDER_NOT_ASSIGNED"
    };
  }

  if (
    !isValidDate(
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

  const estimatedAmount =
    normalizeAmount(
      request.estimatedAmount
    );

  if (
    typeof estimatedAmount ===
      "number" &&
    Number.isNaN(
      estimatedAmount
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

  const existing =
    state.drafts.find(
      draft =>
        draft.operationId ===
          operation.id &&
        draft.providerCustomerId ===
          providerCustomerId &&
        draft.providerType ===
          providerType &&
        draft.tenantId ===
          operation.tenantId &&
        draft.companyId ===
          operation.companyId &&
        draft.branchId ===
          operation.branchId &&
        draft.accountingPeriodId ===
          operation.accountingPeriodId
    );

  if (existing) {
    return {
      outcome:
        "REPLAY",
      state,
      draft:
        existing
    };
  }

  const draft:
    ProviderEarningsPendingDraft = {
      id:
        request.draftId,

      tenantId:
        operation.tenantId,

      companyId:
        operation.companyId,

      branchId:
        operation.branchId,

      accountingPeriodId:
        operation.accountingPeriodId,

      operationId:
        operation.id,

      providerCustomerId,

      providerType,

      title:
        operation.title,

      currency:
        request.currency,

      estimatedAmount,

      status:
        estimatedAmount === null
          ? "PENDING_AMOUNT"
          : "READY",

      completedAt:
        operation.completedAt,

      createdAt:
        request.occurredAt,

      updatedAt:
        request.occurredAt,

      ...(operation.saleId ||
      operation.sourceId
        ? {
            sourceDocumentId:
              operation.saleId ||
              operation.sourceId
          }
        : {})
    };

  return {
    outcome:
      "CREATED",

    state: {
      drafts: [
        ...state.drafts,
        draft
      ]
    },

    draft
  };
}