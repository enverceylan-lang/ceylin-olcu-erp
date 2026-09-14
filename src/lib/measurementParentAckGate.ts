export interface MeasurementParentGateResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export type MeasurementParentGateFetcher = (
  url: string,
  init: RequestInit,
) => Promise<MeasurementParentGateResponse>;

export type MeasurementParentGateResult =
  | {
      released: true;
      response: MeasurementParentGateResponse;
    }
  | {
      released: false;
      apiStatus: number | string;
      error: string;
    };

export function resolveMeasurementParentCustomerId(
  patch: Record<string, unknown>,
):
  | { ok: true; customerId: string }
  | { ok: false; error: string } {
  const nested =
    patch.data && typeof patch.data === "object"
      ? (patch.data as Record<string, unknown>)
      : patch;

  const customerId = String(
    nested.customerId ||
      patch.customerId ||
      "",
  ).trim();

  if (!customerId) {
    return {
      ok: false,
      error: "MEASUREMENT_PARENT_CUSTOMER_ID_MISSING",
    };
  }

  return { ok: true, customerId };
}

export async function fetchDeltaAfterCanonicalParentAck(
  fetcher: MeasurementParentGateFetcher,
  parentRequest: RequestInit,
  deltaRequest: RequestInit,
): Promise<MeasurementParentGateResult> {
  const parentResponse = await fetcher(
    "/api/sync/customers",
    parentRequest,
  );

  const parentBody = (await parentResponse
    .json()
    .catch(() => null)) as
    | { success?: boolean; error?: string }
    | null;

  if (!parentResponse.ok || parentBody?.success !== true) {
    const reason =
      parentBody?.error ||
      (parentResponse.ok
        ? "INVALID_ACK"
        : `HTTP_${parentResponse.status}`);

    return {
      released: false,
      apiStatus: parentResponse.ok
        ? "PARENT_ACK_INVALID"
        : parentResponse.status,
      error:
        `MEASUREMENT_PARENT_CANONICAL_ACK_FAILED:${reason}`,
    };
  }

  const response = await fetcher(
    "/api/delta-sync/push",
    deltaRequest,
  );

  return {
    released: true,
    response,
  };
}