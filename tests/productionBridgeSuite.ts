import type {
  Sale,
  SaleItem
} from "../src/store/salesStore";
import {
  syncCentralSaleToTailorProduction
} from "../src/lib/productionBridge";
import { useStore } from "../src/store/useStore";

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
  overrides: Partial<SaleItem> = {}
): SaleItem {
  return {
    id: "line-1",
    roomName: "Salon",
    windowName: "Pencere",
    productType: "Tül",
    productGroup: "0001-TUL",
    width: 300,
    height: 260,
    calcWidth: 300,
    calcHeight: 260,
    quantity: 1,
    metricSize: 7.8,
    metricUnit: "m2",
    productionWidthCm: 300,
    productionHeightCm: 260,
    fabricMeters: 7.8,
    pleatDetails: "1/3 Sık Pile",
    wingQuantity: 2,
    fonPlacement: "BOTH",
    unitPrice: 100,
    discount: 0,
    rowTotal: 780,
    ...overrides
  };
}

function createSale(
  overrides: Partial<Sale> = {}
): Sale {
  return {
    id: "central-sale-1",
    saleNo: "SAT-0001",
    customerId: "customer-1",
    createdByUserId: "office-1",
    createdByUsername: "office",
    status: "ÜRETİME_GÖNDERİLDİ",
    items: [createItem()],
    priceSource: "MANUAL",
    totalAmount: 780,
    cashPrice: 780,
    installmentPrice: 780,
    discount: 0,
    downPayment: 0,
    remainingBalance: 780,
    createdAt: "2026-07-26T08:00:00.000Z",
    updatedAt: "2026-07-26T08:00:00.000Z",
    ...overrides
  };
}

async function main(): Promise<void> {
  const originalState = useStore.getState();

  useStore.setState({
    customers: [{
      id: "customer-1",
      name: "Test",
      phone: "",
      address: "",
      mapLocation: "",
      notes: "",
      rooms: [],
      assignedTailorId: "tailor-1",
      assignedTailorName: "Terzi 1"
    }],
    sales: [],
    productionItems: [],
    productionTasks: []
  });

  await runTest(
    "assignedTailorReceivesCentralProductionItem",
    async () => {
      await syncCentralSaleToTailorProduction(
        createSale()
      );

      const state = useStore.getState();

      assert(
        state.productionItems.length === 1,
        "Production item was not created"
      );
      assert(
        state.productionItems[0].assignedEmployeeId ===
          "tailor-1",
        "Customer tailor was not assigned"
      );
      assert(
        state.productionItems[0].width === 300 &&
          state.productionItems[0].height === 260,
        "Central production dimensions were changed"
      );
      assert(
        state.productionItems[0].quantity === 7.8 &&
          state.productionItems[0].quantityUnit === "mt",
        "Fabric meter quantity was not transferred"
      );
      assert(
        state.productionItems[0].pleatType ===
          "1/3 Sık Pile",
        "Pleat detail was not transferred"
      );
      assert(
        state.productionItems[0].wingQuantity === 2 &&
          state.productionItems[0].fonPlacement === "BOTH",
        "Wing or placement detail was not transferred"
      );
      assert(
        state.productionTasks.length === 1,
        "Production task was not created"
      );
    }
  );

  await runTest(
    "replayDoesNotDuplicateItemOrTask",
    async () => {
      await syncCentralSaleToTailorProduction(
        createSale()
      );

      const state = useStore.getState();

      assert(
        state.productionItems.length === 1,
        "Replay duplicated production item"
      );
      assert(
        state.productionTasks.length === 1,
        "Replay duplicated production task"
      );
    }
  );

  await runTest(
    "manualAssignmentIsNeverOverwritten",
    async () => {
      const current = useStore.getState();

      useStore.setState({
        productionItems:
          current.productionItems.map(item => ({
            ...item,
            assignedEmployeeId: "tailor-2"
          }))
      });

      await syncCentralSaleToTailorProduction(
        createSale({
          updatedAt: "2026-07-26T09:00:00.000Z"
        })
      );

      assert(
        useStore.getState()
          .productionItems[0]
          .assignedEmployeeId === "tailor-2",
        "Manual tailor assignment was overwritten"
      );
    }
  );

  await runTest(
    "unassignedLegacyItemGetsCustomerTailor",
    async () => {
      const current = useStore.getState();

      useStore.setState({
        productionItems:
          current.productionItems.map(item => ({
            ...item,
            assignedEmployeeId: undefined,
            quantityUnit: undefined,
            pleatType: undefined,
            wingQuantity: undefined,
            fonPlacement: undefined
          }))
      });

      await syncCentralSaleToTailorProduction(
        createSale({
          updatedAt: "2026-07-26T10:00:00.000Z"
        })
      );

      assert(
        useStore.getState()
          .productionItems[0]
          .assignedEmployeeId === "tailor-1",
        "Unassigned legacy item was not repaired"
      );
      assert(
        useStore.getState()
          .productionItems[0]
          .quantityUnit === "mt",
        "Legacy quantity unit was not repaired"
      );
      assert(
        useStore.getState()
          .productionItems[0]
          .pleatType === "1/3 Sık Pile",
        "Legacy pleat metadata was not repaired"
      );
    }
  );

  await runTest(
    "mechanicalItemDoesNotCreateTailorWork",
    async () => {
      await syncCentralSaleToTailorProduction(
        createSale({
          id: "central-sale-mechanical",
          saleNo: "SAT-0002",
          items: [
            createItem({
              id: "line-mechanical",
              productType: "Stor",
              productGroup: "0002-MEKANIK"
            })
          ]
        })
      );

      const state = useStore.getState();

      assert(
        !state.productionItems.some(
          item =>
            item.orderId ===
              "central-sale-mechanical"
        ),
        "Mechanical item was sent to tailor"
      );
      assert(
        !state.productionTasks.some(
          task =>
            task.saleId ===
              "central-sale-mechanical"
        ),
        "Mechanical sale created tailor task"
      );
    }
  );

  useStore.setState({
    customers: originalState.customers,
    sales: originalState.sales,
    productionItems: originalState.productionItems,
    productionTasks: originalState.productionTasks
  });

  if (failed) {
    console.error(
      " PRODUCTION BRIDGE TEST SUITE FAILED!"
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    " ALL PRODUCTION BRIDGE TESTS PASSED!"
  );
}

void main();
