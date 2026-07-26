import type {
  ProductionItem
} from "../src/store/useStore";
import {
  getProductionTransition
} from "../src/lib/productionWorkflow";

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

function createItem(
  overrides: Partial<ProductionItem> = {}
): ProductionItem {
  return {
    id: "item-1",
    orderId: "sale-1",
    saleLineId: "line-1",
    customerId: "customer-1",
    roomName: "Salon",
    openingName: "Pencere",
    productName: "Tül",
    productType: "Tül",
    width: 300,
    height: 260,
    quantity: 7.8,
    quantityUnit: "mt",
    productionStatus: "READY_FOR_CUTTING",
    cutCompleted: false,
    sewingCompleted: false,
    ironingCompleted: false,
    packagingCompleted: false,
    dueDate: "2026-07-30",
    history: [],
    ...overrides
  };
}

async function main(): Promise<void> {
  await runTest(
    "workflowCannotSkipCut",
    () => {
      const result = getProductionTransition(
        createItem(),
        "SEWN"
      );

      assert(
        !result.allowed &&
          result.reason === "CUT_REQUIRED",
        "Sewing skipped cutting"
      );
    }
  );

  await runTest(
    "workflowCannotSkipPackaging",
    () => {
      const result = getProductionTransition(
        createItem({
          cutCompleted: true,
          sewingCompleted: true,
          ironingCompleted: true
        }),
        "READY"
      );

      assert(
        !result.allowed &&
          result.reason === "PACKAGING_REQUIRED",
        "Ready status skipped packaging"
      );
    }
  );

  await runTest(
    "orderedWorkflowCompletesSafely",
    () => {
      let item = createItem();

      for (
        const status of [
          "CUT",
          "SEWN",
          "IRONING",
          "PACKAGING",
          "READY"
        ]
      ) {
        const result =
          getProductionTransition(item, status);

        assert(
          result.allowed,
          `Ordered transition failed at ${status}`
        );

        item = {
          ...item,
          ...result.changes
        };
      }

      assert(
        item.productionStatus === "READY" &&
          item.cutCompleted &&
          item.sewingCompleted &&
          item.ironingCompleted &&
          item.packagingCompleted,
        "Ordered workflow did not complete flags"
      );
    }
  );

  await runTest(
    "exceptionPreservesCompletedWork",
    () => {
      const item = createItem({
        productionStatus: "SEWN",
        cutCompleted: true,
        sewingCompleted: true
      });
      const problem =
        getProductionTransition(item, "PROBLEM");

      assert(problem.allowed, "Problem was rejected");

      const updated = {
        ...item,
        ...problem.changes
      };

      assert(
        updated.cutCompleted &&
          updated.sewingCompleted,
        "Problem erased completed work"
      );
    }
  );

  await runTest(
    "completedStepCannotMoveStatusBackward",
    () => {
      const result = getProductionTransition(
        createItem({
          productionStatus: "IRONING",
          cutCompleted: true,
          sewingCompleted: true,
          ironingCompleted: true
        }),
        "CUT"
      );

      assert(
        !result.allowed &&
          result.reason === "ALREADY_COMPLETED",
        "Completed cut moved status backward"
      );
    }
  );

  await runTest(
    "cancelledItemIsLocked",
    () => {
      const result = getProductionTransition(
        createItem({
          productionStatus: "CANCELLED"
        }),
        "CUT"
      );

      assert(
        !result.allowed &&
          result.reason ===
            "CANCELLED_ITEM_LOCKED",
        "Cancelled item was changed"
      );
    }
  );

  if (failed) {
    console.error(
      " PRODUCTION WORKFLOW TEST SUITE FAILED!"
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    " ALL PRODUCTION WORKFLOW TESTS PASSED!"
  );
}

void main();
