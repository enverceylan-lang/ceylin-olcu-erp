import type {
  SalesSyncQueueEvent
} from "../src/lib/localSalesSyncQueueDb";
import {
  summarizeSalesSyncQueue
} from "../src/lib/salesSyncDiagnostics";

let failed = false;

function assert(
  condition: unknown,
  message: string
): asserts condition {
  if (!condition) throw new Error(message);
}

async function runTest(
  name: string,
  fn: () => void | Promise<void>
): Promise<void> {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
  } catch (error) {
    failed = true;
    console.error(
      `[FAIL] ${name} -> ${
        error instanceof Error
          ? error.message
          : String(error)
      }`
    );
  }
}

function createEvent(
  status: SalesSyncQueueEvent["status"],
  retryCount: number
): SalesSyncQueueEvent {
  return {
    changeId: crypto.randomUUID(),
    saleId: "private-sale-id",
    operation: "UPSERT",
    mutation: {
      changeId: crypto.randomUUID(),
      deviceId: "private-device-id",
      saleId: "private-sale-id",
      ownerUserId: "private-user-id",
      operation: "UPSERT",
      baseVersion: 0
    },
    signature: "private-signature",
    status,
    retryCount,
    lastErrorCode: "PRIVATE_ERROR_DETAIL",
    createdAt: "2026-07-26T08:00:00.000Z",
    updatedAt: "2026-07-26T08:00:00.000Z"
  };
}

async function main(): Promise<void> {
  await runTest(
    "summaryCountsStatusesAndRetries",
    () => {
      const summary = summarizeSalesSyncQueue([
        createEvent("PENDING", 0),
        createEvent("ERROR", 2),
        createEvent("SYNCED", 1),
        createEvent("PENDING", 0)
      ]);

      assert(summary.total === 4, "Total is wrong");
      assert(summary.pending === 2, "Pending count is wrong");
      assert(summary.error === 1, "Error count is wrong");
      assert(summary.synced === 1, "Synced count is wrong");
      assert(
        summary.totalRetryCount === 3,
        "Retry total is wrong"
      );
    }
  );

  await runTest(
    "summaryContainsNoRecordIdentityOrPayload",
    () => {
      const summary = summarizeSalesSyncQueue([
        createEvent("ERROR", 1)
      ]);
      const serialized = JSON.stringify(summary);

      assert(
        !serialized.includes("private-sale-id"),
        "Sale identity leaked into summary"
      );
      assert(
        !serialized.includes("private-user-id"),
        "User identity leaked into summary"
      );
      assert(
        !serialized.includes("PRIVATE_ERROR_DETAIL"),
        "Error detail leaked into summary"
      );
      assert(
        Object.keys(summary).sort().join(",") ===
          [
            "error",
            "pending",
            "synced",
            "total",
            "totalRetryCount"
          ].sort().join(","),
        "Unexpected diagnostic field was exposed"
      );
    }
  );

  if (failed) {
    console.error(
      " SALES SYNC DIAGNOSTICS TEST SUITE FAILED!"
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    " ALL SALES SYNC DIAGNOSTICS TESTS PASSED!"
  );
}

void main();
