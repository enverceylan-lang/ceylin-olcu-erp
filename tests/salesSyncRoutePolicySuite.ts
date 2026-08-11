import { readFileSync } from "node:fs";
import type { Sale } from "../src/store/salesStore";
import type { SaleSyncEnvelope } from "../src/lib/salesSyncPolicy";
import type {
  SalesSyncActor,
  SalesSyncMutation
} from "../src/lib/salesSyncApiContract";
import {
  decideSalesSyncRoute,
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

const office: SalesSyncActor = {
  id: "office-1",
  role: "OFFICE",
  isActive: true
};

function createSale(): Sale {
  return {
    tenantId: "tenant-1",
    companyId: "company-1",
    branchId: "branch-1",
    accountingPeriodId: "period-1",
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
    updatedAt: "2026-07-26T08:00:00.000Z"
  };
}

function createMutation(): SalesSyncMutation {
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
    envelope
  };
}

async function main(): Promise<void> {
  await runTest(
    "featureFlagDefaultsClosed",
    () => {
      assert(
        !isSalesSyncFeatureEnabled(undefined),
        "Missing flag enabled sync"
      );
      assert(
        !isSalesSyncFeatureEnabled("TRUE"),
        "Non-exact flag enabled sync"
      );
      assert(
        isSalesSyncFeatureEnabled("true"),
        "Exact flag did not enable guarded path"
      );
    }
  );

  await runTest(
    "unauthenticatedRequestIsRejected",
    () => {
      const decision =
        decideSalesSyncRoute(null, false, null);

      assert(
        decision.status === 401 &&
          decision.code === "UNAUTHORIZED",
        "Unauthenticated request was not rejected"
      );
    }
  );

  await runTest(
    "unsupportedRoleIsRejectedBeforeFeatureCheck",
    () => {
      const field: SalesSyncActor = {
        id: "field-1",
        role: "FIELD",
        isActive: true
      };
      const decision =
        decideSalesSyncRoute(field, false, null);

      assert(
        decision.status === 403 &&
          decision.code === "FORBIDDEN",
        "Unsupported role did not receive forbidden"
      );
    }
  );

  await runTest(
    "disabledFeatureStopsAuthorizedUser",
    () => {
      const decision =
        decideSalesSyncRoute(office, false, null);

      assert(
        decision.status === 503 &&
          decision.code === "FEATURE_DISABLED",
        "Disabled feature allowed request processing"
      );
    }
  );

  await runTest(
    "invalidPayloadIsRejectedWhenGuardOpened",
    () => {
      const decision =
        decideSalesSyncRoute(office, true, []);

      assert(
        decision.status === 400 &&
          decision.code === "INVALID_REQUEST",
        "Invalid payload reached write lock"
      );
    }
  );

  await runTest(
    "validPayloadStillStopsAtWriteLock",
    () => {
      const decision =
        decideSalesSyncRoute(
          office,
          true,
          [createMutation()]
        );

      assert(
        decision.status === 501 &&
          decision.code ===
            "WRITE_PATH_NOT_IMPLEMENTED",
        "Valid request passed the write lock"
      );
    }
  );

  await runTest(
    "routeContainsNoDatabaseWriteClient",
    () => {
      const routeSource = readFileSync(
        new URL(
          "../src/app/api/sales-sync/route.ts",
          import.meta.url
        ),
        "utf8"
      );

      assert(
        !routeSource.includes("createClient"),
        "Route contains a Supabase client"
      );
      assert(
        !routeSource.includes(".from("),
        "Route contains a database table call"
      );
      assert(
        !routeSource.includes("service_role"),
        "Route contains service-role material"
      );
    }
  );

  if (failed) {
    console.error(
      " SALES SYNC ROUTE POLICY TEST SUITE FAILED!"
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    " ALL SALES SYNC ROUTE POLICY TESTS PASSED!"
  );
}

void main();
