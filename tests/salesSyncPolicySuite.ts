import type {
  Sale,
  SalePayment
} from "../src/store/salesStore";
import {
  mergeSaleSyncEnvelopes,
  validateSaleSyncEnvelope,
  type SaleSyncEnvelope
} from "../src/lib/salesSyncPolicy";

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

function createPayment(
  id: string,
  amount: number
): SalePayment {
  return {
    id,
    amount,
    paidAt: "2026-07-26",
    method: "NAKIT"
  };
}

function createSale(
  overrides: Partial<Sale> = {}
): Sale {
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
    updatedAt: "2026-07-26T08:00:00.000Z",
    ...overrides
  };
}

function createEnvelope(
  sale: Sale,
  version: number,
  deviceId: string
): SaleSyncEnvelope {
  return { sale, version, deviceId };
}

async function main(): Promise<void> {
  await runTest(
    "invalidEnvelopeIsRejected",
    () => {
      const sale = createSale({
        createdByUserId: "",
        updatedAt: "invalid",
        payments: [
          createPayment("payment-1", 0),
          createPayment("payment-1", 50)
        ]
      });

      const errors = validateSaleSyncEnvelope(
        createEnvelope(sale, 0, "")
      );

      assert(
        errors.includes("OWNER_USER_ID_REQUIRED"),
        "Missing owner was accepted"
      );
      assert(
        errors.includes("PAYMENT_ID_DUPLICATE"),
        "Duplicate payment was accepted"
      );
      assert(
        errors.includes("PAYMENT_AMOUNT_INVALID"),
        "Invalid amount was accepted"
      );
      assert(
        errors.includes("VERSION_INVALID"),
        "Invalid version was accepted"
      );
    }
  );

  await runTest(
    "newerSaleWinsWithoutLosingPayments",
    () => {
      const local = createEnvelope(
        createSale({
          payments: [createPayment("local-payment", 100)]
        }),
        2,
        "device-local"
      );
      const remote = createEnvelope(
        createSale({
          status: "SİPARİŞ",
          payments: [createPayment("remote-payment", 200)],
          updatedAt: "2026-07-26T09:00:00.000Z"
        }),
        3,
        "device-remote"
      );

      const result =
        mergeSaleSyncEnvelopes(local, remote);

      assert(
        result.status === "MERGED",
        "Newer record was not merged"
      );
      assert(
        result.envelope.version === 3,
        "Newer version did not win"
      );
      assert(
        result.envelope.sale.payments?.length === 2,
        "Append-only payments were lost"
      );
      assert(
        result.envelope.sale.remainingBalance === 700,
        "Remaining balance was not recalculated"
      );
    }
  );

  await runTest(
    "samePaymentReplayIsIdempotent",
    () => {
      const payment = createPayment("payment-1", 250);
      const local = createEnvelope(
        createSale({ payments: [payment] }),
        2,
        "device-local"
      );
      const remote = createEnvelope(
        createSale({ payments: [{ ...payment }] }),
        2,
        "device-remote"
      );

      const result =
        mergeSaleSyncEnvelopes(local, remote);

      assert(
        result.status === "UNCHANGED",
        "Identical replay changed the sale"
      );
      assert(
        result.envelope.sale.payments?.length === 1,
        "Identical payment was duplicated"
      );
    }
  );

  await runTest(
    "paymentIdCollisionStopsMerge",
    () => {
      const local = createEnvelope(
        createSale({
          payments: [createPayment("payment-1", 100)]
        }),
        2,
        "device-local"
      );
      const remote = createEnvelope(
        createSale({
          payments: [createPayment("payment-1", 200)]
        }),
        3,
        "device-remote"
      );

      const result =
        mergeSaleSyncEnvelopes(local, remote);

      assert(
        result.status === "CONFLICT" &&
          result.reason === "PAYMENT_ID_COLLISION",
        "Conflicting payment id was overwritten"
      );
    }
  );

  await runTest(
    "sameVersionDifferentSaleStopsMerge",
    () => {
      const local = createEnvelope(
        createSale({ status: "ONAYLANDI" }),
        4,
        "device-local"
      );
      const remote = createEnvelope(
        createSale({ status: "SİPARİŞ" }),
        4,
        "device-remote"
      );

      const result =
        mergeSaleSyncEnvelopes(local, remote);

      assert(
        result.status === "CONFLICT" &&
          result.reason ===
            "SAME_VERSION_DIFFERENT_SALE",
        "Same-version conflict was overwritten"
      );
    }
  );

  await runTest(
    "ownerMismatchStopsMerge",
    () => {
      const local = createEnvelope(
        createSale({ createdByUserId: "office-1" }),
        2,
        "device-local"
      );
      const remote = createEnvelope(
        createSale({ createdByUserId: "office-2" }),
        3,
        "device-remote"
      );

      const result =
        mergeSaleSyncEnvelopes(local, remote);

      assert(
        result.status === "CONFLICT" &&
          result.reason === "OWNER_MISMATCH",
        "Owner mismatch was accepted"
      );
    }
  );

  if (failed) {
    console.error(
      " SALES SYNC POLICY TEST SUITE FAILED!"
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    " ALL SALES SYNC POLICY TESTS PASSED!"
  );
}

void main();
