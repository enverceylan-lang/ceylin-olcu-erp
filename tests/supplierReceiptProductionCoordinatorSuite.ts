import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import {
  useStore,
  type ProductionItem
} from "../src/store/useStore";
import {
  useSupplyChainStore
} from "../src/store/useSupplyChainStore";
import {
  useProductionMaterialStore
} from "../src/store/useProductionMaterialStore";
import {
  executeSupplierReceiptToProduction
} from "../src/lib/supplierReceiptProductionCoordinator";
import type {
  ProductionSourcePlan
} from "../src/lib/productionSourceModel";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1"
};

function productionItem():
  ProductionItem {
  return {
    id:
      "central-production-sale-1-item-1",
    orderId: "sale-1",
    saleLineId: "item-1",
    customerId: "customer-1",
    roomName: "Salon",
    openingName: "Pencere",
    productName: "Tül",
    productType: "Tül",
    width: 300,
    height: 260,
    quantity: 10,
    quantityUnit: "mt",
    productionStatus:
      "WAITING_MATERIAL",
    cutCompleted: false,
    sewingCompleted: false,
    ironingCompleted: false,
    packagingCompleted: false,
    dueDate: "2026-08-05",
    history: []
  };
}

function sourcePlan():
  ProductionSourcePlan {
  return {
    id:
      "production-source-plan:central-production-sale-1-item-1",
    productionItemId:
      "central-production-sale-1-item-1",
    requiredQuantity: 10,
    unit: "mt",
    version: 1,
    allocations: [
      {
        id:
          "supplier-allocation-1",
        productionItemId:
          "central-production-sale-1-item-1",
        sourceType:
          "SUPPLIER_ORDER",
        quantity: 10,
        unit: "mt",
        status: "ORDERED",
        supplierId:
          "supplier-1",
        supplierOrderId:
          "supplier-order-1"
      }
    ]
  };
}

function resetState() {
  useStore.setState({
    productionItems: [
      productionItem()
    ]
  });

  useSupplyChainStore.setState({
    lots: [],
    reservations: [],
    supplierOrders: [],
    supplierReceipts: [],
    purchaseDocuments: [],
    tradeOrderLinks: [],
    cutCompletions: []
  });

  useProductionMaterialStore.setState({
    plans: []
  });

  const order =
    useSupplyChainStore
      .getState()
      .createSupplierOrder({
        ...scope,
        id: "supplier-order-1",
        idempotencyKey:
          "SUPPLIER_ORDER:supplier-order-1",
        allocationId:
          "supplier-allocation-1",
        supplierId: "supplier-1",
        purchaseOrderId:
          "purchase-order-1",
        saleId: "sale-1",
        saleItemId: "item-1",
        productionOrderId:
          "production-1",
        stockItemId: "fabric-1",
        orderedQuantity: 10,
        purpose: "TAILOR_MATERIAL",
        createdByUserId: "admin-1",
        createdAt:
          "2026-08-03T00:00:00.000Z"
      });

  assert.equal(
    order.outcome,
    "CREATED"
  );

  const plan =
    useProductionMaterialStore
      .getState()
      .savePlan(
        sourcePlan()
      );

  assert.equal(
    plan.outcome,
    "CREATED"
  );
}

function receipt(
  id: string,
  idempotencyKey: string,
  quantity: number
) {
  return {
    ...scope,
    id,
    idempotencyKey,
    supplierOrderId:
      "supplier-order-1",
    receivedQuantity: quantity,
    receivedByUserId: "admin-1",
    receivedAt:
      "2026-08-03T00:05:00.000Z"
  };
}

resetState();

const partial =
  executeSupplierReceiptToProduction({
    request: receipt(
      "receipt-1",
      "RECEIPT-1",
      4
    )
  });

assert.equal(
  partial.outcome,
  "COMMITTED"
);

assert.equal(
  partial.releasedForCutting,
  false
);

assert.equal(
  useSupplyChainStore
    .getState()
    .supplierOrders[0]
    .receivedQuantity,
  4
);

assert.equal(
  useSupplyChainStore
    .getState()
    .supplierOrders[0]
    .status,
  "PARTIALLY_RECEIVED"
);

const partialPlan =
  useProductionMaterialStore
    .getState()
    .plans[0];

assert.equal(
  partialPlan.allocations
    .filter(
      allocation =>
        allocation.status ===
          "READY"
    )
    .reduce(
      (total, allocation) =>
        total + allocation.quantity,
      0
    ),
  4
);

assert.equal(
  useStore
    .getState()
    .productionItems[0]
    .productionStatus,
  "WAITING_MATERIAL"
);

console.log(
  "[PASS] partialSupplierReceiptOnlyMarksReceivedQuantityReady"
);

const full =
  executeSupplierReceiptToProduction({
    request: receipt(
      "receipt-2",
      "RECEIPT-2",
      6
    )
  });

assert.equal(
  full.outcome,
  "COMMITTED"
);

assert.equal(
  full.releasedForCutting,
  true
);

assert.equal(
  useSupplyChainStore
    .getState()
    .supplierOrders[0]
    .receivedQuantity,
  10
);

assert.equal(
  useSupplyChainStore
    .getState()
    .supplierOrders[0]
    .status,
  "READY_FOR_TAILOR"
);

assert.equal(
  useStore
    .getState()
    .productionItems[0]
    .productionStatus,
  "READY_FOR_CUTTING"
);

console.log(
  "[PASS] fullSupplierReceiptReleasesProduction"
);

const replay =
  executeSupplierReceiptToProduction({
    request: receipt(
      "receipt-2",
      "RECEIPT-2",
      6
    )
  });

assert.equal(
  replay.outcome,
  "REPLAY"
);

assert.equal(
  useSupplyChainStore
    .getState()
    .supplierOrders[0]
    .receivedQuantity,
  10
);

console.log(
  "[PASS] supplierReceiptIsIdempotent"
);

resetState();

useStore.setState({
  productionItems: []
});

const failed =
  executeSupplierReceiptToProduction({
    request: receipt(
      "receipt-fail",
      "RECEIPT-FAIL",
      10
    )
  });

assert.equal(
  failed.outcome,
  "REJECTED"
);

assert.equal(
  useSupplyChainStore
    .getState()
    .supplierOrders[0]
    .receivedQuantity,
  0
);

assert.equal(
  useSupplyChainStore
    .getState()
    .supplierReceipts.length,
  0
);

console.log(
  "[PASS] productionFailureRollsBackSupplierReceipt"
);

console.log(
  "[PASS] supplierReceiptProductionCoordinatorSuite completed"
);