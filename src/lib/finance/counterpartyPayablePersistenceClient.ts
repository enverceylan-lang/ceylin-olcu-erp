import type {
  CounterpartyPayableMovement
} from "@/lib/counterpartyPayableService";

export type CounterpartyPayableClientResult =
  | {
      outcome:
        "CREATED"
        | "REPLAY";
      movementId:
        string;
    }
  | {
      outcome:
        "CONFLICT";
      movementId:
        string;
      reason:
        string;
    };

interface PersistResponseBody {
  success?:
    boolean;
  outcome?:
    "CREATED"
    | "REPLAY"
    | "CONFLICT";
  movementId?:
    string;
  reason?:
    string;
  error?:
    string;
}

export async function persistCounterpartyPayableMovementViaApi(
  movement:
    CounterpartyPayableMovement
): Promise<
  CounterpartyPayableClientResult
> {
  const response =
    await fetch(
      "/api/finance/counterparty/persist",
      {
        method:
          "POST",
        credentials:
          "same-origin",
        headers: {
          "Content-Type":
            "application/json"
        },
        body:
          JSON.stringify({
            movement
          })
      }
    );

  const body =
    (
      await response
        .json()
        .catch(
          () =>
            null
        )
    ) as
      PersistResponseBody
      | null;

  if (
    response.status ===
      409 &&
    body?.outcome ===
      "CONFLICT" &&
    body.movementId &&
    body.reason
  ) {
    return {
      outcome:
        "CONFLICT",
      movementId:
        body.movementId,
      reason:
        body.reason
    };
  }

  if (
    !response.ok ||
    !body?.success ||
    (
      body.outcome !==
        "CREATED" &&
      body.outcome !==
        "REPLAY"
    ) ||
    !body.movementId
  ) {
    throw new Error(
      body?.error ||
      "COUNTERPARTY_PAYABLE_API_FAILED"
    );
  }

  return {
    outcome:
      body.outcome,
    movementId:
      body.movementId
  };
}