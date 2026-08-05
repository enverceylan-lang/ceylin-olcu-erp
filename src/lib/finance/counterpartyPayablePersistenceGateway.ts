import type {
  CounterpartyPayableMovement
} from "@/lib/counterpartyPayableService";

export interface CounterpartyPayableAuditPayload {
  actorUserId: string;
  action:
    | "CREATE"
    | "REPLAY"
    | "CONFLICT";
  recordedAt: string;
  source:
    "COUNTERPARTY_PAYABLE";
}

export interface CounterpartyPayablePersistencePayload {
  movement:
    CounterpartyPayableMovement;
  audit:
    CounterpartyPayableAuditPayload;
}

export type CounterpartyPayablePersistenceOutcome =
  | {
      outcome:
        "CREATED";
      movementId:
        string;
    }
  | {
      outcome:
        "REPLAY";
      movementId:
        string;
    }
  | {
      outcome:
        "CONFLICT";
      movementId:
        string;
      reason:
        | "IDEMPOTENCY_PAYLOAD_CONFLICT"
        | "MOVEMENT_ID_CONFLICT";
    };

export interface CounterpartyPayablePersistenceGateway {
  persist(
    payload:
      CounterpartyPayablePersistencePayload
  ): Promise<
    CounterpartyPayablePersistenceOutcome
  >;
}

export async function persistCounterpartyPayableMovement(
  payload:
    CounterpartyPayablePersistencePayload,
  dependencies: {
    gateway:
      CounterpartyPayablePersistenceGateway;
  }
): Promise<
  CounterpartyPayablePersistenceOutcome
> {
  const result =
    await dependencies.gateway.persist(
      payload
    );

  if (
    result.movementId !==
    payload.movement.id
  ) {
    throw new Error(
      "COUNTERPARTY_PAYABLE_PERSISTENCE_MOVEMENT_ID_MISMATCH"
    );
  }

  return result;
}