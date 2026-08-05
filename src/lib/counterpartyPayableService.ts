import type {
  ErpScope
} from "@/lib/erpScope";

export type CounterpartyType =
  | "SUPPLIER"
  | "TAILOR"
  | "INSTALLER";

export type CounterpartyPayableMovementKind =
  | "ACCRUAL"
  | "PAYMENT"
  | "REVERSAL";

export interface CounterpartyPayableMovement
  extends ErpScope {
  id: string;
  idempotencyKey: string;

  counterpartyCustomerId: string;
  counterpartyType:
    CounterpartyType;

  kind:
    CounterpartyPayableMovementKind;

  amount: number;
  currency: "TRY";

  occurredAt: string;
  recordedAt: string;

  sourceDocumentId?: string;
  supplierReceiptId?: string;
  operationId?: string;
  providerEarningsEntryId?: string;
  sourcePaymentId?: string;

  reversalOfMovementId?: string;
  note?: string;
}

export interface CounterpartyPayableState {
  movements:
    CounterpartyPayableMovement[];
}

export type CounterpartyPayableResult =
  | {
      outcome:
        "CREATED" |
        "REPLAY";
      state:
        CounterpartyPayableState;
      movement:
        CounterpartyPayableMovement;
    }
  | {
      outcome:
        "REJECTED";
      state:
        CounterpartyPayableState;
      reason:
        | "INVALID_REQUEST"
        | "INVALID_AMOUNT"
        | "IDEMPOTENCY_CONFLICT"
        | "SOURCE_NOT_FOUND"
        | "ALREADY_REVERSED"
        | "PAYMENT_EXCEEDS_OPEN_AMOUNT";
    };

function sameScope(
  left: ErpScope,
  right: ErpScope
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

function money(
  value: number
): number {
  return (
    Math.round(
      (
        value +
        Number.EPSILON
      ) *
      100
    ) / 100
  );
}

function validPositiveAmount(
  value: number
): boolean {
  return (
    Number.isFinite(value) &&
    value > 0
  );
}

function sameMovementIdentity(
  movement:
    CounterpartyPayableMovement,
  request:
    CounterpartyPayableMovement
): boolean {
  return (
    movement.id === request.id &&
    movement.idempotencyKey ===
      request.idempotencyKey &&
    movement.counterpartyCustomerId ===
      request.counterpartyCustomerId &&
    movement.counterpartyType ===
      request.counterpartyType &&
    movement.kind ===
      request.kind &&
    movement.amount ===
      request.amount &&
    movement.currency ===
      request.currency &&
    movement.occurredAt ===
      request.occurredAt &&
    movement.sourceDocumentId ===
      request.sourceDocumentId &&
    movement.operationId ===
      request.operationId &&
    movement.providerEarningsEntryId ===
      request.providerEarningsEntryId &&
    movement.sourcePaymentId ===
      request.sourcePaymentId &&
    movement.reversalOfMovementId ===
      request.reversalOfMovementId &&
    sameScope(
      movement,
      request
    )
  );
}

export function createCounterpartyPayableMovement(
  state:
    CounterpartyPayableState,
  request:
    CounterpartyPayableMovement
): CounterpartyPayableResult {
  if (
    !request.id.trim() ||
    !request.idempotencyKey.trim() ||
    !request.counterpartyCustomerId.trim() ||
    !request.occurredAt.trim() ||
    !request.recordedAt.trim()
  ) {
    return {
      outcome:
        "REJECTED",
      state,
      reason:
        "INVALID_REQUEST"
    };
  }

  if (
    !validPositiveAmount(
      request.amount
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

  const normalized:
    CounterpartyPayableMovement = {
    ...request,
    amount:
      money(request.amount)
  };

  const existing =
    state.movements.find(
      movement =>
        movement.idempotencyKey ===
          normalized.idempotencyKey &&
        sameScope(
          movement,
          normalized
        )
    );

  if (existing) {
    if (
      sameMovementIdentity(
        existing,
        normalized
      )
    ) {
      return {
        outcome:
          "REPLAY",
        state,
        movement:
          existing
      };
    }

    return {
      outcome:
        "REJECTED",
      state,
      reason:
        "IDEMPOTENCY_CONFLICT"
    };
  }

  return {
    outcome:
      "CREATED",
    state: {
      movements: [
        ...state.movements,
        normalized
      ]
    },
    movement:
      normalized
  };
}

export function calculateCounterpartyPayableBalance(
  movements:
    readonly CounterpartyPayableMovement[],
  scope:
    ErpScope,
  counterpartyCustomerId:
    string
): number {
  return money(
    movements
      .filter(
        movement =>
          movement.counterpartyCustomerId ===
            counterpartyCustomerId &&
          sameScope(
            movement,
            scope
          )
      )
      .reduce(
        (
          total,
          movement
        ) => {
          if (
            movement.kind ===
            "ACCRUAL"
          ) {
            return (
              total +
              movement.amount
            );
          }

          if (
            movement.kind ===
            "PAYMENT"
          ) {
            return (
              total -
              movement.amount
            );
          }

          const source =
            movements.find(
              candidate =>
                candidate.id ===
                movement.reversalOfMovementId &&
              sameScope(
                candidate,
                movement
              )
            );

          if (
            source?.kind ===
            "ACCRUAL"
          ) {
            return (
              total -
              movement.amount
            );
          }

          if (
            source?.kind ===
            "PAYMENT"
          ) {
            return (
              total +
              movement.amount
            );
          }

          return total;
        },
        0
      )
  );
}

export function registerCounterpartyPayment(
  state:
    CounterpartyPayableState,
  request:
    Omit<
      CounterpartyPayableMovement,
      "kind"
    >
): CounterpartyPayableResult {
  const openAmount =
    calculateCounterpartyPayableBalance(
      state.movements,
      request,
      request.counterpartyCustomerId
    );

  if (
    request.amount >
    openAmount
  ) {
    return {
      outcome:
        "REJECTED",
      state,
      reason:
        "PAYMENT_EXCEEDS_OPEN_AMOUNT"
    };
  }

  return createCounterpartyPayableMovement(
    state,
    {
      ...request,
      kind:
        "PAYMENT"
    }
  );
}

export function reverseCounterpartyPayableMovement(
  state:
    CounterpartyPayableState,
  request: {
    scope:
      ErpScope;
    sourceMovementId:
      string;
    reversalMovementId:
      string;
    idempotencyKey:
      string;
    occurredAt:
      string;
    recordedAt:
      string;
    note?: string;
  }
): CounterpartyPayableResult {
  const source =
    state.movements.find(
      movement =>
        movement.id ===
          request.sourceMovementId &&
        sameScope(
          movement,
          request.scope
        )
    );

  if (!source) {
    return {
      outcome:
        "REJECTED",
      state,
      reason:
        "SOURCE_NOT_FOUND"
    };
  }

  const alreadyReversed =
    state.movements.find(
      movement =>
        movement.kind ===
          "REVERSAL" &&
        movement.reversalOfMovementId ===
          source.id &&
        sameScope(
          movement,
          source
        )
    );

  if (alreadyReversed) {
    if (
      alreadyReversed.idempotencyKey ===
      request.idempotencyKey
    ) {
      return {
        outcome:
          "REPLAY",
        state,
        movement:
          alreadyReversed
      };
    }

    return {
      outcome:
        "REJECTED",
      state,
      reason:
        "ALREADY_REVERSED"
    };
  }

  return createCounterpartyPayableMovement(
    state,
    {
      ...request.scope,
      id:
        request.reversalMovementId,
      idempotencyKey:
        request.idempotencyKey,
      counterpartyCustomerId:
        source.counterpartyCustomerId,
      counterpartyType:
        source.counterpartyType,
      kind:
        "REVERSAL",
      amount:
        source.amount,
      currency:
        source.currency,
      occurredAt:
        request.occurredAt,
      recordedAt:
        request.recordedAt,
      sourceDocumentId:
        source.sourceDocumentId,
      operationId:
        source.operationId,
      providerEarningsEntryId:
        source.providerEarningsEntryId,
      reversalOfMovementId:
        source.id,
      note:
        request.note
    }
  );
}