import assert from "node:assert/strict";
import fs from "node:fs";
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

  const deltaClientSource = fs.readFileSync(
    "src/lib/deltaSyncClient.ts",
    "utf8",
  );
  const topbarSource = fs.readFileSync(
    "src/components/Topbar.tsx",
    "utf8",
  );
  const fieldTasksSource = fs.readFileSync(
    "src/app/gorevler/page.tsx",
    "utf8",
  );
  const syncServiceSource = fs.readFileSync(
    "src/lib/syncService.ts",
    "utf8",
  );
  const customerSyncRouteSource = fs.readFileSync(
    "src/app/api/sync/customers/route.ts",
    "utf8",
  );

  const pushStart = deltaClientSource.indexOf(
    "export async function pushDeltaSyncEvents",
  );
  const pullStart = deltaClientSource.indexOf(
    "export async function pullInboundMeasurements",
  );

  assert.ok(pushStart >= 0);
  assert.ok(pullStart > pushStart);

  const realPushSource = deltaClientSource.slice(
    pushStart,
    pullStart,
  );

  assert.doesNotMatch(
    realPushSource,
    /fetchDeltaAfterCanonicalParentAck/,
  );
  assert.doesNotMatch(
    realPushSource,
    /customers:\s*parentCustomers/,
  );
  assert.doesNotMatch(
    realPushSource,
    /pendingDeletes:\s*\[\]/,
  );
  assert.match(
    realPushSource,
    /resolveMeasurementParentCustomerId/,
  );
  assert.match(
    realPushSource,
    /parentPackage/,
  );
  assert.match(
    realPushSource,
    /customerAddressId/,
  );
  assert.match(
    realPushSource,
    /events:\s*deltaPushEvents/,
  );
  assert.match(
    realPushSource,
    /"\/api\/delta-sync\/push"/,
  );
  assert.match(
    realPushSource,
    /markSyncEventsBlocked/,
  );
  assert.match(
    realPushSource,
    /PARENT_ROOM_MISSING/,
  );
  assert.match(
    realPushSource,
    /PARENT_OPENING_MISSING/,
  );
  assert.doesNotMatch(
    realPushSource,
    /MEASUREMENT_PARENT_ROOM_LOCAL_MISSING/,
  );
  assert.doesNotMatch(
    realPushSource,
    /MEASUREMENT_PARENT_OPENING_LOCAL_MISSING/,
  );
  assert.match(
    realPushSource,
    /if \(!room\) \{[\s\S]*?isolatedEvents\.push\([\s\S]*?PARENT_ROOM_MISSING[\s\S]*?continue;/,
  );
  assert.match(
    realPushSource,
    /if \(!opening\) \{[\s\S]*?isolatedEvents\.push\([\s\S]*?PARENT_OPENING_MISSING[\s\S]*?continue;/,
  );
  assert.match(
    realPushSource,
    /if \(deltaPushEvents\.length === 0\)/,
  );

  const blockIndex = realPushSource.indexOf("await markSyncEventsBlocked");
  const deltaFetchIndex = realPushSource.indexOf('fetch("/api/delta-sync/push"');
  assert.ok(blockIndex >= 0 && deltaFetchIndex > blockIndex);

  assert.doesNotMatch(
    topbarSource,
    /İnternet bağlantısını kontrol edip tekrar deneyin/,
  );
  assert.match(
    topbarSource,
    /result\.errors\.length/,
  );
  assert.match(
    topbarSource,
    /result\.isolatedCount/,
  );
  assert.match(
    topbarSource,
    /tarihsel kayıt incelemeye alındı/,
  );
  assert.match(
    fieldTasksSource,
    /result\.isolatedCount/,
  );
  assert.match(
    fieldTasksSource,
    /tarihsel kayıt incelemeye alındı/,
  );

  assert.match(
    syncServiceSource,
    /const autoSyncCustomers:\s*Customer\[\]/,
  );
  assert.match(
    syncServiceSource,
    /rooms:\s*\[\]/,
  );

  assert.match(
    customerSyncRouteSource,
    /SYNC_CUSTOMER_UPSERT_FAILED/,
  );
  assert.match(
    customerSyncRouteSource,
    /SYNC_CUSTOMER_ADDRESS_AUTHORITY_FAILED/,
  );
  assert.doesNotMatch(
    customerSyncRouteSource,
    /SYNC_ROOM_UPSERT_FAILED/,
  );
  assert.doesNotMatch(
    customerSyncRouteSource,
    /SYNC_OPENING_UPSERT_FAILED/,
  );
  assert.match(
    customerSyncRouteSource,
    /SYNC_CUSTOMERS_INTERNAL_ERROR/,
  );

  console.log("PAK customerMeasurementParentAckContractSuite");
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
