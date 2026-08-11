import type { Sale } from "../src/store/salesStore";
import type { SaleSyncEnvelope } from "../src/lib/salesSyncPolicy";
import {
  MAX_SALES_SYNC_CHANGES,
  canActorMutateSale,
  sanitizeSalesSyncMutation,
  validateSalesSyncBatch,
  type SalesSyncActor,
  type SalesSyncMutation
} from "../src/lib/salesSyncApiContract";

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

const admin: SalesSyncActor = {
  id: "admin-1",
  role: "ADMIN",
  isActive: true
};

const office: SalesSyncActor = {
  id: "office-1",
  role: "OFFICE",
  isActive: true
};

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
    "ownerAndAdminAuthorization",
    () => {
      assert(
        canActorMutateSale(
          office,
          "office-1",
          "UPSERT"
        ),
        "Owner could not update own sale"
      );
      assert(
        !canActorMutateSale(
          office,
          "office-2",
          "UPSERT"
        ),
        "Office user could update another owner sale"
      );
      assert(
        canActorMutateSale(
          admin,
          "office-2",
          "UPSERT"
        ),
        "Admin could not update sale"
      );
      assert(
        !canActorMutateSale(
          office,
          "office-1",
          "RESTORE"
        ),
        "Non-admin could restore deleted sale"
      );
    }
  );

  await runTest(
    "inactiveAndUnsupportedRoleAreRejected",
    () => {
      const inactive = {
        ...office,
        isActive: false
      };
      const field: SalesSyncActor = {
        id: "field-1",
        role: "FIELD",
        isActive: true
      };

      assert(
        !canActorMutateSale(
          inactive,
          "office-1",
          "UPSERT"
        ),
        "Inactive user was authorized"
      );
      assert(
        !canActorMutateSale(
          field,
          "field-1",
          "UPSERT"
        ),
        "Field role was authorized"
      );
    }
  );

  await runTest(
    "batchLimitsAndDuplicateIdsAreRejected",
    () => {
      const oversized = Array.from(
        { length: MAX_SALES_SYNC_CHANGES + 1 },
        (_, index) =>
          createMutation({
            changeId: `change-${index}`
          })
      );
      const oversizedResult =
        validateSalesSyncBatch(office, oversized);

      assert(
        oversizedResult[0].errors.includes(
          "BATCH_SIZE_INVALID"
        ),
        "Oversized batch was accepted"
      );

      const duplicateResult =
        validateSalesSyncBatch(office, [
          createMutation(),
          createMutation()
        ]);

      assert(
        duplicateResult[1].errors.includes(
          "CHANGE_ID_DUPLICATE"
        ),
        "Duplicate change id was accepted"
      );
    }
  );

  await runTest(
    "ownerAndSaleMismatchAreRejected",
    () => {
      const mutation = createMutation({
        ownerUserId: "office-2"
      });
      const result =
        validateSalesSyncBatch(office, [mutation])[0];

      assert(
        result.errors.includes("FORBIDDEN"),
        "Different owner was authorized"
      );
      assert(
        result.errors.includes("OWNER_MISMATCH"),
        "Envelope owner mismatch was accepted"
      );
    }
  );

  await runTest(
    "paymentAppendRequiresValidPayment",
    () => {
      const invalid = createMutation({
        operation: "APPEND_PAYMENT",
        envelope: undefined,
        payment: {
          id: "",
          amount: 0,
          paidAt: "2026-07-26",
          method: "NAKIT"
        }
      });
      const result =
        validateSalesSyncBatch(office, [invalid])[0];

      assert(
        result.errors.includes("PAYMENT_ID_REQUIRED"),
        "Payment without id was accepted"
      );
      assert(
        result.errors.includes(
          "PAYMENT_AMOUNT_INVALID"
        ),
        "Invalid payment amount was accepted"
      );
    }
  );

  await runTest(
    "sensitiveAndMediaFieldsAreRemoved",
    () => {
      const unsafe = createMutation() as
        SalesSyncMutation & {
          password?: string;
          nested?: {
            token?: string;
            photos?: string[];
            note?: string;
          };
        };

      unsafe.password = "secret";
      unsafe.nested = {
        token: "token",
        photos: ["data:image/png;base64,secret"],
        note: "safe"
      };

      const sanitized =
        sanitizeSalesSyncMutation(unsafe) as
          SalesSyncMutation & {
            password?: string;
            nested?: {
              token?: string;
              photos?: string[];
              note?: string;
            };
          };

      assert(
        sanitized.password === undefined,
        "Password was retained"
      );
      assert(
        sanitized.nested?.token === undefined,
        "Token was retained"
      );
      assert(
        sanitized.nested?.photos === undefined,
        "Media was retained"
      );
      assert(
        sanitized.nested?.note === "safe",
        "Safe field was removed"
      );
    }
  );

  if (failed) {
    console.error(
      " SALES SYNC API CONTRACT TEST SUITE FAILED!"
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    " ALL SALES SYNC API CONTRACT TESTS PASSED!"
  );
}

void main();
