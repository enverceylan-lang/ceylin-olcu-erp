import type {
  ProviderEarningsCurrency,
  ProviderEarningsEntry,
  ProviderEarningsScope,
  ProviderEarningsStatus
} from "./providerEarningsViewService";

export interface ProviderEarningsLedgerState {
  entries:
    ProviderEarningsEntry[];

  paymentSnapshots:
    ProviderPaymentSnapshot[];
}

export interface ProviderPaymentSnapshot
  extends ProviderEarningsScope {
  id: string;

  providerCustomerId:
    string;

  providerType:
    | "TAILOR"
    | "INSTALLER";

  earningsEntryId:
    string;

  sourcePaymentId:
    string;

  currency:
    ProviderEarningsCurrency;

  amount:
    number;

  paidAt:
    string;

  recordedAt:
    string;
}

export interface CreateEstimatedEarningRequest
  extends ProviderEarningsScope {
  id: string;

  operationId:
    string;

  providerCustomerId:
    string;

  providerType:
    | "TAILOR"
    | "INSTALLER";

  title:
    string;

  occurredAt:
    string;

  currency:
    ProviderEarningsCurrency;

  estimatedAmount:
    number;

  sourceDocumentId?:
    string;
}

export interface FinalizeProviderEarningRequest
  extends ProviderEarningsScope {
  entryId:
    string;

  providerCustomerId:
    string;

  finalizedAmount:
    number;

  finalizedAt:
    string;

  finalizedByUserId:
    string;
}

export interface RegisterProviderPaymentSnapshotRequest
  extends ProviderEarningsScope {
  id: string;

  earningsEntryId:
    string;

  providerCustomerId:
    string;

  providerType:
    | "TAILOR"
    | "INSTALLER";

  sourcePaymentId:
    string;

  currency:
    ProviderEarningsCurrency;

  amount:
    number;

  paidAt:
    string;

  recordedAt:
    string;
}

export type ProviderEarningsLedgerResult =
  | {
      outcome:
        "CREATED";

      state:
        ProviderEarningsLedgerState;

      entry:
        ProviderEarningsEntry;
    }
  | {
      outcome:
        "UPDATED";

      state:
        ProviderEarningsLedgerState;

      entry:
        ProviderEarningsEntry;
    }
  | {
      outcome:
        "REPLAY";

      state:
        ProviderEarningsLedgerState;

      entry:
        ProviderEarningsEntry;
    }
  | {
      outcome:
        "NOT_FOUND";

      state:
        ProviderEarningsLedgerState;
    }
  | {
      outcome:
        "REJECTED";

      state:
        ProviderEarningsLedgerState;

      reason:
        ProviderEarningsLedgerRejectReason;
    };

export type ProviderEarningsLedgerRejectReason =
  | "INVALID_AMOUNT"
  | "SCOPE_MISMATCH"
  | "PROVIDER_MISMATCH"
  | "CURRENCY_MISMATCH"
  | "ENTRY_CANCELLED"
  | "ALREADY_FINALIZED"
  | "NOT_FINALIZED"
  | "PAYMENT_EXCEEDS_FINALIZED_AMOUNT"
  | "PAYMENT_SOURCE_CONFLICT";

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

function isValidAmount(
  value:
    number
): boolean {
  return (
    Number.isFinite(value) &&
    value >= 0
  );
}

function matchesScope(
  left:
    ProviderEarningsScope,
  right:
    ProviderEarningsScope
): boolean {
  return (
    left.tenantId ===
      right.tenantId &&
    left.companyId ===
      right.companyId &&
    left.branchId ===
      right.branchId &&
    left.accountingPeriodId ===
      right.accountingPeriodId
  );
}

function determineStatus(
  finalizedAmount:
    number,
  paidAmount:
    number
): ProviderEarningsStatus {
  if (
    finalizedAmount <= 0
  ) {
    return "ESTIMATED";
  }

  if (
    paidAmount <= 0
  ) {
    return "FINALIZED";
  }

  if (
    paidAmount <
    finalizedAmount
  ) {
    return "PARTIALLY_PAID";
  }

  return "PAID";
}

function replaceEntry(
  entries:
    readonly ProviderEarningsEntry[],
  nextEntry:
    ProviderEarningsEntry
): ProviderEarningsEntry[] {
  return entries.map(
    entry =>
      entry.id ===
      nextEntry.id
        ? nextEntry
        : entry
  );
}

function totalEntryPayments(
  snapshots:
    readonly ProviderPaymentSnapshot[],
  entryId:
    string
): number {
  return roundMoney(
    snapshots
      .filter(
        snapshot =>
          snapshot.earningsEntryId ===
          entryId
      )
      .reduce(
        (
          total,
          snapshot
        ) =>
          total +
          snapshot.amount,
        0
      )
  );
}

export function createEstimatedProviderEarning(
  state:
    ProviderEarningsLedgerState,
  request:
    CreateEstimatedEarningRequest
): ProviderEarningsLedgerResult {
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

  const existingByOperation =
    state.entries.find(
      entry =>
        entry.operationId ===
          request.operationId &&
        entry.providerCustomerId ===
          request.providerCustomerId &&
        entry.providerType ===
          request.providerType &&
        matchesScope(
          entry,
          request
        )
    );

  if (existingByOperation) {
    return {
      outcome:
        "REPLAY",
      state,
      entry:
        existingByOperation
    };
  }

  const entry:
    ProviderEarningsEntry = {
      tenantId:
        request.tenantId,

      companyId:
        request.companyId,

      branchId:
        request.branchId,

      accountingPeriodId:
        request.accountingPeriodId,

      id:
        request.id,

      providerCustomerId:
        request.providerCustomerId,

      providerType:
        request.providerType,

      operationId:
        request.operationId,

      ...(request.sourceDocumentId
        ? {
            sourceDocumentId:
              request.sourceDocumentId
          }
        : {}),

      title:
        request.title.trim(),

      occurredAt:
        request.occurredAt,

      currency:
        request.currency,

      estimatedAmount:
        roundMoney(
          request.estimatedAmount
        ),

      finalizedAmount:
        0,

      paidAmount:
        0,

      status:
        "ESTIMATED"
    };

  return {
    outcome:
      "CREATED",

    state: {
      ...state,

      entries: [
        ...state.entries,
        entry
      ]
    },

    entry
  };
}

export function finalizeProviderEarning(
  state:
    ProviderEarningsLedgerState,
  request:
    FinalizeProviderEarningRequest
): ProviderEarningsLedgerResult {
  if (
    !isValidAmount(
      request.finalizedAmount
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

  const entry =
    state.entries.find(
      item =>
        item.id ===
        request.entryId
    );

  if (!entry) {
    return {
      outcome:
        "NOT_FOUND",
      state
    };
  }

  if (
    !matchesScope(
      entry,
      request
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
    entry.providerCustomerId !==
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
    entry.status ===
    "CANCELLED"
  ) {
    return {
      outcome:
        "REJECTED",
      state,
      reason:
        "ENTRY_CANCELLED"
    };
  }

  if (
    entry.finalizedAmount > 0
  ) {
    if (
      entry.finalizedAmount ===
      roundMoney(
        request.finalizedAmount
      )
    ) {
      return {
        outcome:
          "REPLAY",
        state,
        entry
      };
    }

    return {
      outcome:
        "REJECTED",
      state,
      reason:
        "ALREADY_FINALIZED"
    };
  }

  const paidAmount =
    totalEntryPayments(
      state.paymentSnapshots,
      entry.id
    );

  const finalizedAmount =
    roundMoney(
      request.finalizedAmount
    );

  if (
    paidAmount >
    finalizedAmount
  ) {
    return {
      outcome:
        "REJECTED",
      state,
      reason:
        "PAYMENT_EXCEEDS_FINALIZED_AMOUNT"
    };
  }

  const nextEntry:
    ProviderEarningsEntry = {
      ...entry,

      finalizedAmount,

      paidAmount,

      status:
        determineStatus(
          finalizedAmount,
          paidAmount
        )
    };

  return {
    outcome:
      "UPDATED",

    state: {
      ...state,

      entries:
        replaceEntry(
          state.entries,
          nextEntry
        )
    },

    entry:
      nextEntry
  };
}

export function registerProviderPaymentSnapshot(
  state:
    ProviderEarningsLedgerState,
  request:
    RegisterProviderPaymentSnapshotRequest
): ProviderEarningsLedgerResult {
  if (
    !isValidAmount(
      request.amount
    ) ||
    request.amount <= 0
  ) {
    return {
      outcome:
        "REJECTED",
      state,
      reason:
        "INVALID_AMOUNT"
    };
  }

  const entry =
    state.entries.find(
      item =>
        item.id ===
        request.earningsEntryId
    );

  if (!entry) {
    return {
      outcome:
        "NOT_FOUND",
      state
    };
  }

  if (
    !matchesScope(
      entry,
      request
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
    entry.providerCustomerId !==
      request.providerCustomerId ||
    entry.providerType !==
      request.providerType
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
    entry.currency !==
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
    entry.status ===
    "CANCELLED"
  ) {
    return {
      outcome:
        "REJECTED",
      state,
      reason:
        "ENTRY_CANCELLED"
    };
  }

  if (
    entry.finalizedAmount <= 0
  ) {
    return {
      outcome:
        "REJECTED",
      state,
      reason:
        "NOT_FINALIZED"
    };
  }

  const existingSource =
    state.paymentSnapshots.find(
      snapshot =>
        snapshot.sourcePaymentId ===
        request.sourcePaymentId
    );

  if (existingSource) {
    const sameSnapshot =
      existingSource.earningsEntryId ===
        request.earningsEntryId &&
      existingSource.providerCustomerId ===
        request.providerCustomerId &&
      existingSource.currency ===
        request.currency &&
      existingSource.amount ===
        roundMoney(
          request.amount
        ) &&
      matchesScope(
        existingSource,
        request
      );

    if (sameSnapshot) {
      return {
        outcome:
          "REPLAY",
        state,
        entry
      };
    }

    return {
      outcome:
        "REJECTED",
      state,
      reason:
        "PAYMENT_SOURCE_CONFLICT"
    };
  }

  const snapshot:
    ProviderPaymentSnapshot = {
      tenantId:
        request.tenantId,

      companyId:
        request.companyId,

      branchId:
        request.branchId,

      accountingPeriodId:
        request.accountingPeriodId,

      id:
        request.id,

      earningsEntryId:
        request.earningsEntryId,

      providerCustomerId:
        request.providerCustomerId,

      providerType:
        request.providerType,

      sourcePaymentId:
        request.sourcePaymentId,

      currency:
        request.currency,

      amount:
        roundMoney(
          request.amount
        ),

      paidAt:
        request.paidAt,

      recordedAt:
        request.recordedAt
    };

  const nextSnapshots = [
    ...state.paymentSnapshots,
    snapshot
  ];

  const paidAmount =
    totalEntryPayments(
      nextSnapshots,
      entry.id
    );

  if (
    paidAmount >
    entry.finalizedAmount
  ) {
    return {
      outcome:
        "REJECTED",
      state,
      reason:
        "PAYMENT_EXCEEDS_FINALIZED_AMOUNT"
    };
  }

  const nextEntry:
    ProviderEarningsEntry = {
      ...entry,

      paidAmount,

      status:
        determineStatus(
          entry.finalizedAmount,
          paidAmount
        )
    };

  return {
    outcome:
      "UPDATED",

    state: {
      entries:
        replaceEntry(
          state.entries,
          nextEntry
        ),

      paymentSnapshots:
        nextSnapshots
    },

    entry:
      nextEntry
  };
}