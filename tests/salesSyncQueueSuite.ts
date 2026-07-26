import "fake-indexeddb/auto";

import type { Sale } from "../src/store/salesStore";
import type { SaleSyncEnvelope } from "../src/lib/salesSyncPolicy";
import type { SalesSyncMutation } from "../src/lib/salesSyncApiContract";
import {
  enqueueSalesSyncMutation,
  listPendingSalesSyncEvents,
  localSalesSyncQueueDb,
  markSalesSyncEventError,
  markSalesSyncEventSynced,
  requeueSalesSyncEvent
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

function createMutation(
  overrides: Partial<SalesSyncMutation> = {}
): SalesSyncMutation {
  const sale = createSale();
  const envelope: SaleSyncEnvelope = {
    sale,
    version: 1,
    deviceId: "device-1"
  };

  return {
    changeId: "change-1",
    deviceId: "device-1",
    saleId: sale.id,
    ownerUserId: "office-1",
    operation: "UPSERT",
    baseVersion: 0,
    envelope,
    ...overrides
  };
}

async function main(): Promise<void> {
  await runTest(
    "identicalReplayIsIdempotent",
    async () => {
      const mutation = createMutation();
      const first =
        await enqueueSalesSyncMutation(mutation);
      const replay =
        await enqueueSalesSyncMutation({
          ...mutation
        });

      assert(first.queued, "First event was not queued");
      assert(
        !replay.queued,
        "Identical replay created another event"
      );
      assert(
        await localSalesSyncQueueDb.events.count() === 1,
        "Replay increased queue size"
      );
    }
  );

  await runTest(
    "sameIdDifferentPayloadIsRejected",
    async () => {
      await enqueueSalesSyncMutation(
        createMutation()
      );

      let collision = false;

      try {
        await enqueueSalesSyncMutation(
          createMutation({
            baseVersion: 2
          })
        );
      } catch (error) {
        collision =
          error instanceof Error &&
          error.message ===
            "CHANGE_ID_PAYLOAD_COLLISION";
      }

      assert(
        collision,
        "Payload collision was not rejected"
      );
      assert(
        await localSalesSyncQueueDb.events.count() === 1,
        "Collision changed queue size"
      );
    }
  );

  await runTest(
    "sensitivePayloadIsNotPersisted",
    async () => {
      const mutation = createMutation() as
        SalesSyncMutation & {
          password?: string;
          nested?: {
            token?: string;
            videos?: string[];
            note?: string;
          };
        };

      mutation.password = "secret";
      mutation.nested = {
        token: "token",
        videos: ["data:video/mp4;base64,secret"],
        note: "safe"
      };

      await enqueueSalesSyncMutation(mutation);

      const stored =
        await localSalesSyncQueueDb.events.get(
          mutation.changeId
        );
      const storedMutation = stored?.mutation as
        SalesSyncMutation & {
          password?: string;
          nested?: {
            token?: string;
            videos?: string[];
            note?: string;
          };
        };

      assert(
        storedMutation.password === undefined,
        "Password was persisted"
      );
      assert(
        storedMutation.nested?.token === undefined,
        "Token was persisted"
      );
      assert(
        storedMutation.nested?.videos === undefined,
        "Video was persisted"
      );
      assert(
        storedMutation.nested?.note === "safe",
        "Safe note was removed"
      );
    }
  );

  await runTest(
    "errorCanBeSafelyRequeued",
    async () => {
      const mutation = createMutation();
      await enqueueSalesSyncMutation(mutation);
      await markSalesSyncEventError(
        mutation.changeId,
        "NETWORK_ERROR"
      );

      const errored =
        await localSalesSyncQueueDb.events.get(
          mutation.changeId
        );

      assert(
        errored?.status === "ERROR",
        "Event was not marked error"
      );
      assert(
        errored.retryCount === 1,
        "Retry count was not increased"
      );

      assert(
        await requeueSalesSyncEvent(
          mutation.changeId
        ),
        "Error event was not requeued"
      );

      const pending =
        await listPendingSalesSyncEvents();

      assert(
        pending.length === 1 &&
          pending[0].status === "PENDING",
        "Requeued event is not pending"
      );
    }
  );

  await runTest(
    "syncedEventLeavesPendingQueue",
    async () => {
      const mutation = createMutation();
      await enqueueSalesSyncMutation(mutation);
      await markSalesSyncEventSynced(
        mutation.changeId
      );

      const pending =
        await listPendingSalesSyncEvents();
      const stored =
        await localSalesSyncQueueDb.events.get(
          mutation.changeId
        );

      assert(
        pending.length === 0,
        "Synced event remained pending"
      );
      assert(
        stored?.status === "SYNCED" &&
          !!stored.syncedAt,
        "Synced audit record was not retained"
      );
    }
  );

  await localSalesSyncQueueDb.events.clear();

  if (failed) {
    console.error(
      " SALES SYNC QUEUE TEST SUITE FAILED!"
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    " ALL SALES SYNC QUEUE TESTS PASSED!"
  );
}

void main();
