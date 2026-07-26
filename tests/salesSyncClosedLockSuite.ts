import "fake-indexeddb/auto";

import { readFileSync } from "node:fs";
import {
  isSalesSyncQueueCaptureEnabled
} from "../src/lib/salesSyncQueueBridge";
import {
  isSalesSyncFeatureEnabled
} from "../src/lib/salesSyncRoutePolicy";

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

function readProjectFile(relativePath: string): string {
  return readFileSync(
    new URL(`../${relativePath}`, import.meta.url),
    "utf8"
  );
}

async function main(): Promise<void> {
  await runTest(
    "allFeatureFlagsDefaultClosed",
    () => {
      assert(
        !isSalesSyncFeatureEnabled(undefined),
        "Missing API flag opened sales sync"
      );
      assert(
        !isSalesSyncQueueCaptureEnabled(undefined),
        "Missing queue flag opened capture"
      );
    }
  );

  await runTest(
    "routeHasNoDatabaseWritePath",
    () => {
      const source = readProjectFile(
        "src/app/api/sales-sync/route.ts"
      );

      for (
        const forbidden of [
          "createClient",
          ".from(",
          ".insert(",
          ".update(",
          ".upsert(",
          "SUPABASE_SERVICE_ROLE_KEY"
        ]
      ) {
        assert(
          !source.includes(forbidden),
          `Route contains forbidden write token: ${forbidden}`
        );
      }

      assert(
        source.includes("decideSalesSyncRoute"),
        "Route is not guarded by decision policy"
      );
    }
  );

  await runTest(
    "localQueueAndBridgeHaveNoNetworkCalls",
    () => {
      const sources = [
        readProjectFile(
          "src/lib/localSalesSyncQueueDb.ts"
        ),
        readProjectFile(
          "src/lib/salesSyncQueueBridge.ts"
        )
      ].join("\n");

      for (
        const forbidden of [
          "fetch(",
          "XMLHttpRequest",
          "WebSocket",
          "sendBeacon"
        ]
      ) {
        assert(
          !sources.includes(forbidden),
          `Local-only source contains network token: ${forbidden}`
        );
      }
    }
  );

  await runTest(
    "sqlRemainsExplicitlyUnappliedDraft",
    () => {
      const sql = readProjectFile(
        "docs/sql/20260726_sales_sync_foundation_v1.sql"
      );

      assert(
        sql.includes("DURUM: TASLAK"),
        "SQL draft marker is missing"
      );
      assert(
        sql.includes("CANLI SUPABASE'E UYGULANMAYACAKTIR"),
        "SQL live-apply warning is missing"
      );
    }
  );

  await runTest(
    "diagnosticsCardHasNoMutationControl",
    () => {
      const source = readProjectFile(
        "src/components/admin/SalesSyncDiagnosticsCard.tsx"
      );

      assert(
        !source.includes("<button"),
        "Diagnostics card contains a button"
      );
      assert(
        !source.includes("enqueueSalesSyncMutation"),
        "Diagnostics card can enqueue events"
      );
      assert(
        !source.includes("requeueSalesSyncEvent"),
        "Diagnostics card can requeue events"
      );
      assert(
        !source.includes("markSalesSyncEvent"),
        "Diagnostics card can mutate queue state"
      );
    }
  );

  if (failed) {
    console.error(
      " SALES SYNC CLOSED-LOCK TEST SUITE FAILED!"
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    " ALL SALES SYNC CLOSED-LOCK TESTS PASSED!"
  );
}

void main();
