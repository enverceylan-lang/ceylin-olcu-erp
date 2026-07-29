import {
  createEstimatedProviderEarning,
  type ProviderEarningsLedgerState
} from "./providerEarningsLedgerService";
import type {
  ProviderEarningsCurrency,
  ProviderEarningsEntry,
  ProviderEarningsScope
} from "./providerEarningsViewService";
import type {
  ProviderEarningsPendingDraft,
  ProviderEarningsPendingDraftState
} from "./providerEarningsPendingDraftService";

export interface ProviderEarningsAdminActor
  extends ProviderEarningsScope {
  userId: string;

  role:
    | "ADMIN"
    | "ACCOUNTING";
}

export interface SetProviderEarningsDraftAmountRequest {
  actor:
    ProviderEarningsAdminActor;

  draftId:
    string;

  providerCustomerId:
    string;

  currency:
    ProviderEarningsCurrency;

  estimatedAmount:
    number;

  occurredAt:
    string;
}

export interface ConvertProviderEarningsDraftRequest {
  actor:
    ProviderEarningsAdminActor;

  draftId:
    string;

  providerCustomerId:
    string;

  earningsEntryId:
    string;

  occurredAt:
    string;
}

export type ProviderEarningsDraftAdminRejectReason =
  | "ACTOR_NOT_ALLOWED"
  | "DRAFT_NOT_FOUND"
  | "SCOPE_MISMATCH"
  | "PROVIDER_MISMATCH"
  | "CURRENCY_MISMATCH"
  | "INVALID_AMOUNT"
  | "INVALID_OCCURRED_AT"
  | "DRAFT_CANCELLED"
  | "DRAFT_ALREADY_CONVERTED"
  | "DRAFT_AMOUNT_REQUIRED"
  | "DRAFT_NOT_READY"
  | "LEDGER_REJECTED";

export type SetProviderEarningsDraftAmountResult =
  | {
      outcome:
        "UPDATED";

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
        ProviderEarningsDraftAdminRejectReason;
    };

export type ConvertProviderEarningsDraftResult =
  | {
      outcome:
        "CONVERTED";

      draftState:
        ProviderEarningsPendingDraftState;

      ledgerState:
        ProviderEarningsLedgerState;

      draft:
        ProviderEarningsPendingDraft;

      entry:
        ProviderEarningsEntry;
    }
  | {
      outcome:
        "REPLAY";

      draftState:
        ProviderEarningsPendingDraftState;

      ledgerState:
        ProviderEarningsLedgerState;

      draft:
        ProviderEarningsPendingDraft;

      entry?:
        ProviderEarningsEntry;
    }
  | {
      outcome:
        "REJECTED";

      draftState:
        ProviderEarningsPendingDraftState;

      ledgerState:
        ProviderEarningsLedgerState;

      reason:
        ProviderEarningsDraftAdminRejectReason;
    };

function roundMoney(
  value:
    number
): number {
  return (
    Math.round(
      (value + Number.EPSILON) *
        100
    ) / 100
  );
}

function isAllowedActor(
  actor:
    ProviderEarningsAdminActor
): boolean {
  return (
    actor.role === "ADMIN" ||
    actor.role === "ACCOUNTING"
  );
}

function isValidAmount(
  value:
    number
): boolean {
  return (
    Number.isFinite(value) &&
    value >= 0
  );
}

function isValidDate(
  value:
    string
): boolean {
  return (
    Boolean(value) &&
    !Number.isNaN(
      new Date(value).getTime()
    )
  );
}

function matchesScope(
  actor:
    ProviderEarningsAdminActor,
  draft:
    ProviderEarningsPendingDraft
): boolean {
  return (
    actor.tenantId ===
      draft.tenantId &&
    actor.companyId ===
      draft.companyId &&
    actor.branchId ===
      draft.branchId &&
    actor.accountingPeriodId ===
      draft.accountingPeriodId
  );
}

function replaceDraft(
  drafts:
    readonly ProviderEarningsPendingDraft[],
  nextDraft:
    ProviderEarningsPendingDraft
): ProviderEarningsPendingDraft[] {
  return drafts.map(
    draft =>
      draft.id ===
      nextDraft.id
        ? nextDraft
        : draft
  );
}

export function setProviderEarningsDraftAmount(
  state:
    ProviderEarningsPendingDraftState,
  request:
    SetProviderEarningsDraftAmountRequest
): SetProviderEarningsDraftAmountResult {
  if (
    !isAllowedActor(
      request.actor
    )
  ) {
    return {
      outcome:
        "REJECTED",
      state,
      reason:
        "ACTOR_NOT_ALLOWED"
    };
  }

  if (
    !isValidAmount(
      request.estimatedAmount
    )
  ) {
    return {
      outcome:
        "REJECTED",
      state,
      reason:
        "INVALID_AMOUNT"
    };
  }

  if (
    !isValidDate(
      request.occurredAt
    )
  ) {
    return {
      outcome:
        "REJECTED",
      state,
      reason:
        "INVALID_OCCURRED_AT"
    };
  }

  const draft =
    state.drafts.find(
      item =>
        item.id ===
        request.draftId
    );

  if (!draft) {
    return {
      outcome:
        "REJECTED",
      state,
      reason:
        "DRAFT_NOT_FOUND"
    };
  }

  if (
    !matchesScope(
      request.actor,
      draft
    )
  ) {
    return {
      outcome:
        "REJECTED",
      state,
      reason:
        "SCOPE_MISMATCH"
    };
  }

  if (
    draft.providerCustomerId !==
    request.providerCustomerId
  ) {
    return {
      outcome:
        "REJECTED",
      state,
      reason:
        "PROVIDER_MISMATCH"
    };
  }

  if (
    draft.currency !==
    request.currency
  ) {
    return {
      outcome:
        "REJECTED",
      state,
      reason:
        "CURRENCY_MISMATCH"
    };
  }

  if (
    draft.status ===
    "CANCELLED"
  ) {
    return {
      outcome:
        "REJECTED",
      state,
      reason:
        "DRAFT_CANCELLED"
    };
  }

  if (
    draft.status ===
    "CONVERTED"
  ) {
    return {
      outcome:
        "REJECTED",
      state,
      reason:
        "DRAFT_ALREADY_CONVERTED"
    };
  }

  const estimatedAmount =
    roundMoney(
      request.estimatedAmount
    );

  if (
    draft.status ===
      "READY" &&
    draft.estimatedAmount ===
      estimatedAmount
  ) {
    return {
      outcome:
        "REPLAY",
      state,
      draft
    };
  }

  const nextDraft:
    ProviderEarningsPendingDraft = {
      ...draft,

      estimatedAmount,

      status:
        "READY",

      updatedAt:
        request.occurredAt
  };

  return {
    outcome:
      "UPDATED",

    state: {
      drafts:
        replaceDraft(
          state.drafts,
          nextDraft
        )
    },

    draft:
      nextDraft
  };
}

export function convertProviderEarningsDraft(
  draftState:
    ProviderEarningsPendingDraftState,
  ledgerState:
    ProviderEarningsLedgerState,
  request:
    ConvertProviderEarningsDraftRequest
): ConvertProviderEarningsDraftResult {
  if (
    !isAllowedActor(
      request.actor
    )
  ) {
    return {
      outcome:
        "REJECTED",
      draftState,
      ledgerState,
      reason:
        "ACTOR_NOT_ALLOWED"
    };
  }

  if (
    !isValidDate(
      request.occurredAt
    )
  ) {
    return {
      outcome:
        "REJECTED",
      draftState,
      ledgerState,
      reason:
        "INVALID_OCCURRED_AT"
    };
  }

  const draft =
    draftState.drafts.find(
      item =>
        item.id ===
        request.draftId
    );

  if (!draft) {
    return {
      outcome:
        "REJECTED",
      draftState,
      ledgerState,
      reason:
        "DRAFT_NOT_FOUND"
    };
  }

  if (
    !matchesScope(
      request.actor,
      draft
    )
  ) {
    return {
      outcome:
        "REJECTED",
      draftState,
      ledgerState,
      reason:
        "SCOPE_MISMATCH"
    };
  }

  if (
    draft.providerCustomerId !==
    request.providerCustomerId
  ) {
    return {
      outcome:
        "REJECTED",
      draftState,
      ledgerState,
      reason:
        "PROVIDER_MISMATCH"
    };
  }

  if (
    draft.status ===
    "CANCELLED"
  ) {
    return {
      outcome:
        "REJECTED",
      draftState,
      ledgerState,
      reason:
        "DRAFT_CANCELLED"
    };
  }

  const existingEntry =
    ledgerState.entries.find(
      entry =>
        entry.operationId ===
          draft.operationId &&
        entry.providerCustomerId ===
          draft.providerCustomerId &&
        entry.providerType ===
          draft.providerType &&
        entry.tenantId ===
          draft.tenantId &&
        entry.companyId ===
          draft.companyId &&
        entry.branchId ===
          draft.branchId &&
        entry.accountingPeriodId ===
          draft.accountingPeriodId
    );

  if (
    draft.status ===
    "CONVERTED"
  ) {
    return {
      outcome:
        "REPLAY",
      draftState,
      ledgerState,
      draft,
      ...(existingEntry
        ? {
            entry:
              existingEntry
          }
        : {})
    };
  }

  if (
    draft.status !==
    "READY"
  ) {
    return {
      outcome:
        "REJECTED",
      draftState,
      ledgerState,
      reason:
        draft.estimatedAmount ===
          null
          ? "DRAFT_AMOUNT_REQUIRED"
          : "DRAFT_NOT_READY"
    };
  }

  if (
    draft.estimatedAmount ===
    null
  ) {
    return {
      outcome:
        "REJECTED",
      draftState,
      ledgerState,
      reason:
        "DRAFT_AMOUNT_REQUIRED"
    };
  }

  const ledgerResult =
    createEstimatedProviderEarning(
      ledgerState,
      {
        tenantId:
          draft.tenantId,

        companyId:
          draft.companyId,

        branchId:
          draft.branchId,

        accountingPeriodId:
          draft.accountingPeriodId,

        id:
          request.earningsEntryId,

        operationId:
          draft.operationId,

        providerCustomerId:
          draft.providerCustomerId,

        providerType:
          draft.providerType,

        title:
          draft.title,

        occurredAt:
          draft.completedAt,

        currency:
          draft.currency,

        estimatedAmount:
          draft.estimatedAmount,

        ...(draft.sourceDocumentId
          ? {
              sourceDocumentId:
                draft.sourceDocumentId
            }
          : {})
      }
    );

  if (
    ledgerResult.outcome ===
    "REJECTED" ||
    ledgerResult.outcome ===
    "NOT_FOUND"
  ) {
    return {
      outcome:
        "REJECTED",
      draftState,
      ledgerState,
      reason:
        "LEDGER_REJECTED"
    };
  }

  const convertedDraft:
    ProviderEarningsPendingDraft = {
      ...draft,

      status:
        "CONVERTED",

      updatedAt:
        request.occurredAt
  };

  const nextDraftState = {
    drafts:
      replaceDraft(
        draftState.drafts,
        convertedDraft
      )
  };

  if (
    ledgerResult.outcome ===
    "REPLAY"
  ) {
    return {
      outcome:
        "REPLAY",

      draftState:
        nextDraftState,

      ledgerState:
        ledgerResult.state,

      draft:
        convertedDraft,

      entry:
        ledgerResult.entry
    };
  }

  return {
    outcome:
      "CONVERTED",

    draftState:
      nextDraftState,

    ledgerState:
      ledgerResult.state,

    draft:
      convertedDraft,

    entry:
      ledgerResult.entry
  };
}