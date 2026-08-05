import type {
  ProviderEarningSourceTruth,
  SupplierReceiptSourceTruth
} from "./counterpartySourceTruthPersistenceGateway";

export type CounterpartySourceTruthClientRequest =
  | {
      kind:
        "SUPPLIER_RECEIPT";
      source:
        SupplierReceiptSourceTruth;
    }
  | {
      kind:
        "PROVIDER_EARNING";
      source:
        ProviderEarningSourceTruth;
    };

export type CounterpartySourceTruthClientResult =
  | {
      status:
        "CREATED"
        | "REPLAY";
      sourceId?:
        string;
    }
  | {
      status:
        "CONFLICT"
        | "REJECTED";
      sourceId?:
        string;
      reason:
        string;
    };

interface ResponseBody {
  success?:
    boolean;
  status?:
    "CREATED"
    | "REPLAY"
    | "CONFLICT"
    | "REJECTED";
  sourceId?:
    string;
  reason?:
    string;
  error?:
    string;
}

export async function persistCounterpartySourceTruthViaApi(
  request:
    CounterpartySourceTruthClientRequest
): Promise<
  CounterpartySourceTruthClientResult
> {
  const response =
    await fetch(
      "/api/finance/counterparty/source-truth/persist",
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
          JSON.stringify(
            request
          )
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
      ResponseBody
      | null;

  if (
    response.status ===
      409 &&
    body?.status ===
      "CONFLICT" &&
    body.reason
  ) {
    return {
      status:
        "CONFLICT",
      sourceId:
        body.sourceId,
      reason:
        body.reason
    };
  }

  if (
    response.status ===
      422 &&
    body?.status ===
      "REJECTED" &&
    body.reason
  ) {
    return {
      status:
        "REJECTED",
      sourceId:
        body.sourceId,
      reason:
        body.reason
    };
  }

  if (
    !response.ok ||
    !body?.success ||
    (
      body.status !==
        "CREATED" &&
      body.status !==
        "REPLAY"
    )
  ) {
    throw new Error(
      body?.error ||
      "COUNTERPARTY_SOURCE_TRUTH_API_FAILED"
    );
  }

  return {
    status:
      body.status,
    sourceId:
      body.sourceId
  };
}