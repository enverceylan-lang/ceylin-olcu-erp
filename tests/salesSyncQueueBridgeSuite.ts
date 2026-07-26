import "fake-indexeddb/auto";

import type { Sale } from "../src/store/salesStore";
import {
  captureSaleDeleteForSync,
  captureSaleSaveForSync,
  isSalesSyncQueueCaptureEnabled
} from "../src/lib/salesSyncQueueBridge";
import {
  localSalesSyncQueueDb
} from "../src/lib/localSalesSyncQueueDb";

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
    await localSalesSyncQueueDb.events.clear();
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

function createSale(
  overrides: Partial<Sale> = {}
): Sale {
  return {
    id: "sale-1",
    saleNo: "SAT-0001",
    customerId: "customer-1",
    createdByUserId: "office-1",
    createdByUsername: "office",
    status: "ONAYLANDI",
    items: [],
    priceSource: "MANUAL",
    totalAmount: 1000,
    cashPrice: 1000,
    installmentPrice: 1000,
    discount: 0,
    downPayment: 0,
    remainingBalance: 1000,
    payments: [],
    createdAt: "2026-07-26T08:00:00.000Z",
    updatedAt: "2026-07-26T08:00:00.000Z",
    ...overrides
  };
}

async function main(): Promise<void> {
  await runTest(
    "featureFlagDefaultsClosed",
    async () => {
      assert(
        !isSalesSyncQueueCaptureEnabled(undefined),
        "Missing flag enabled capture"
      );

      const result = await captureSaleSaveForSync(
        createSale(),
        undefined,
        undefined
      );

      assert(
        !result.enabled && result.queuedCount === 0,
        "Disabled bridge reported capture"
      );
      assert(
        await localSalesSyncQueueDb.events.count() === 0,
        "Disabled bridge wrote to queue"
      );
    }
  );

  await runTest(
    "enabledSaveCreatesLocalSnapshotOnly",
    async () => {
      const result = await captureSaleSaveForSync(
        createSale(),
        undefined,
        "true"
      );
      const events =
        await localSalesSyncQueueDb.events.toArray();

      assert(
        result.enabled && result.queuedCount === 1,
        "Enabled save did not create snapshot"
      );
      assert(
        events.length === 1 &&
          events[0].operation === "UPSERT",
        "Unexpected queue event was created"
      );
      assert(
        events[0].mutation.envelope?.sale
          .payments?.length === 0,
        "Payments leaked into sale snapshot"
      );
    }
  );

  await runTest(
    "sameSaveReplayDoesNotDuplicate",
    async () => {
      const sale = createSale();

      await captureSaleSaveForSync(
        sale,
        undefined,
        "true"
      );
      const replay = await captureSaleSaveForSync(
        sale,
        undefined,
        "true"
      );

      assert(
        replay.queuedCount === 0,
        "Replay created another event"
      );
      assert(
        await localSalesSyncQueueDb.events.count() === 1,
        "Replay increased queue size"
      );
    }
  );

  await runTest(
    "newPaymentUsesAppendOnlyEvent",
    async () => {
      const previous = createSale();
      const updated = createSale({
        updatedAt: "2026-07-26T09:00:00.000Z",
        payments: [{
          id: "payment-1",
          amount: 200,
          paidAt: "2026-07-26",
          method: "NAKIT"
        }]
      });

      const result = await captureSaleSaveForSync(
        updated,
        previous,
        "true"
      );
      const events =
        await localSalesSyncQueueDb.events.toArray();

      assert(
        result.queuedCount === 2,
        "Snapshot and payment were not both queued"
      );
      assert(
        events.some(
          event =>
            event.operation === "APPEND_PAYMENT" &&
            event.mutation.payment?.id === "payment-1"
        ),
        "Payment append event was not created"
      );
    }
  );

  await runTest(
    "deleteCreatesTombstoneEvent",
    async () => {
      await captureSaleDeleteForSync(
        createSale(),
        "office",
        "true"
      );
      const events =
        await localSalesSyncQueueDb.events.toArray();
      const tombstone = events.find(
        event => event.operation === "SOFT_DELETE"
      );

      assert(
        !!tombstone,
        "Delete tombstone was not queued"
      );
      assert(
        tombstone.mutation.envelope?.sale.isDeleted ===
          true,
        "Tombstone is not marked deleted"
      );
      assert(
        !!tombstone.mutation.envelope?.sale.deletedAt,
        "Tombstone has no deletion time"
      );
    }
  );

  await runTest(
    "missingOwnerIsSafelySkipped",
    async () => {
      const result = await captureSaleSaveForSync(
        createSale({
          createdByUserId: undefined
        }),
        undefined,
        "true"
      );

      assert(
        result.skippedReason === "OWNER_REQUIRED",
        "Ownerless sale was not safely skipped"
      );
      assert(
        await localSalesSyncQueueDb.events.count() === 0,
        "Ownerless sale was queued"
      );
    }
  );

  await localSalesSyncQueueDb.events.clear();

  if (failed) {
    console.error(
      " SALES SYNC QUEUE BRIDGE TEST SUITE FAILED!"
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    " ALL SALES SYNC QUEUE BRIDGE TESTS PASSED!"
  );
}

void main();
