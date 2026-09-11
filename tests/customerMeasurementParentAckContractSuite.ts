import assert from "node:assert/strict";
import {
  fetchDeltaAfterCanonicalParentAck,
  resolveMeasurementParentCustomerId,
  type MeasurementParentGateFetcher,
  type MeasurementParentGateResponse,
} from "../src/lib/measurementParentAckGate";

type BodyMode =
  | { kind: "json"; value: unknown }
  | { kind: "malformed" };

function makeResponse(
  status: number,
  body: BodyMode,
): MeasurementParentGateResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      if (body.kind === "malformed") {
        throw new Error("malformed json");
      }
      return body.value;
    },
    async text() {
      return "";
    },
  };
}

async function runGateCase(
  parentResponse: MeasurementParentGateResponse,
) {
  const calls: string[] = [];

  const fetcher: MeasurementParentGateFetcher = async (url) => {
    calls.push(url);

    if (url === "/api/sync/customers") {
      return parentResponse;
    }

    return makeResponse(
      200,
      { kind: "json", value: { success: true } },
    );
  };

  const result = await fetchDeltaAfterCanonicalParentAck(
    fetcher,
    { method: "POST" },
    { method: "POST" },
  );

  return { result, calls };
}

async function main() {
  const nestedIdentity = resolveMeasurementParentCustomerId({
    data: { customerId: "customer-1" },
  });

  assert.deepEqual(nestedIdentity, {
    ok: true,
    customerId: "customer-1",
  });

  const missingIdentity = resolveMeasurementParentCustomerId({});
  assert.equal(missingIdentity.ok, false);

  if (!missingIdentity.ok) {
    assert.equal(
      missingIdentity.error,
      "MEASUREMENT_PARENT_CUSTOMER_ID_MISSING",
    );
  }

  for (const status of [400, 401, 403, 409, 500]) {
    const { result, calls } = await runGateCase(
      makeResponse(
        status,
        {
          kind: "json",
          value: { error: `HTTP_${status}` },
        },
      ),
    );

    assert.equal(result.released, false);
    assert.deepEqual(calls, ["/api/sync/customers"]);

    if (!result.released) {
      assert.equal(result.apiStatus, status);
    }
  }

  {
    const { result, calls } = await runGateCase(
      makeResponse(200, { kind: "malformed" }),
    );
    assert.equal(result.released, false);
    assert.deepEqual(calls, ["/api/sync/customers"]);
    if (!result.released) {
      assert.equal(result.apiStatus, "PARENT_ACK_INVALID");
    }
  }

  {
    const { result, calls } = await runGateCase(
      makeResponse(200, { kind: "json", value: {} }),
    );
    assert.equal(result.released, false);
    assert.deepEqual(calls, ["/api/sync/customers"]);
  }

  {
    const { result, calls } = await runGateCase(
      makeResponse(
        200,
        { kind: "json", value: { success: false } },
      ),
    );
    assert.equal(result.released, false);
    assert.deepEqual(calls, ["/api/sync/customers"]);
  }

  {
    const { result, calls } = await runGateCase(
      makeResponse(
        200,
        { kind: "json", value: { success: true } },
      ),
    );
    assert.equal(result.released, true);
    assert.deepEqual(calls, [
      "/api/sync/customers",
      "/api/delta-sync/push",
    ]);
  }

  console.log("PAK customerMeasurementParentAckContractSuite");
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});