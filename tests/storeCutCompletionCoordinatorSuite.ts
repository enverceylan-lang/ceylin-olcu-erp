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
  executeStoreCutCompletionToProduction
} from "../src/lib/storeCutCompletionCoordinator";
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
        id: "allocation-1",
        productionItemId:
          "central-production-sale-1-item-1",
        sourceType: "STORE_CUT",
        quantity: 10,
        unit: "mt",
        status: "RESERVED",
        lotId: "lot-1",
        reservationId:
          "reservation-1"
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
    purchaseDocuments: [],
    tradeOrderLinks: [],
    cutCompletions: []
  });

  useProductionMaterialStore.setState({
    plans: []
  });

  const lot =
    useSupplyChainStore
      .getState()
      .upsertLot({
        ...scope,
        id: "lot-1",
        stockItemId: "fabric-1",
        onHandMeters: 12,
        unusableMeters: 0,
        createdAt:
          "2026-08-03T00:00:00.000Z",
        updatedAt:
          "2026-08-03T00:00:00.000Z"
      });

  assert.equal(
    lot.outcome,
    "CREATED"
  );

  const reservation =
    useSupplyChainStore
      .getState()
      .reserveStock({
        ...scope,
        id: "reservation-1",
        idempotencyKey:
          "STOCK_RESERVATION:reservation-1",
        allocationId:
          "allocation-1",
        saleId: "sale-1",
        saleItemId: "item-1",
        productionOrderId:
          "production-1",
        stockItemId: "fabric-1",
        stockLotId: "lot-1",
        quantityMeters: 10,
        createdByUserId: "admin-1",
        createdAt:
          "2026-08-03T00:01:00.000Z"
      });

  assert.equal(
    reservation.outcome,
    "CREATED"
  );

  const planSave =
    useProductionMaterialStore
      .getState()
      .savePlan(
        sourcePlan()
      );

  assert.equal(
    planSave.outcome,
    "CREATED"
  );
}

function request(
  actualCutMeters: number,
  usableOutputMeters: number
) {
  return {
    ...scope,
    id:
      "cut-completion:reservation-1",
    idempotencyKey:
      "STORE_CUT_COMPLETION:reservation-1",
    cutOrderId:
      "cut-order:reservation-1",
    reservationId: "reservation-1",
    saleId: "sale-1",
    saleItemId: "item-1",
    productionOrderId:
      "production-1",
    stockItemId: "fabric-1",
    stockLotId: "lot-1",
    reservedMeters: 10,
    plannedCutMeters: 10,
    actualCutMeters,
    usableOutputMeters,
    completedByUserId: "admin-1",
    completedAt:
      "2026-08-03T00:05:00.000Z"
  };
}

resetState();

const full =
  executeStoreCutCompletionToProduction({
    request: request(10, 10)
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
    .lots[0]
    .onHandMeters,
  2
);

assert.equal(
  useSupplyChainStore
    .getState()
    .reservations[0]
    .status,
  "CONSUMED"
);

assert.equal(
  useProductionMaterialStore
    .getState()
    .plans[0]
    .allocations[0]
    .status,
  "READY"
);

assert.equal(
  useStore
    .getState()
    .productionItems[0]
    .productionStatus,
  "READY_FOR_CUTTING"
);

console.log(
  "[PASS] fullCutConsumesReservationAndReleasesProduction"
);

const replay =
  executeStoreCutCompletionToProduction({
    request: request(10, 10)
  });

assert.equal(
  replay.outcome,
  "REPLAY"
);

assert.equal(
  useSupplyChainStore
    .getState()
    .lots[0]
    .onHandMeters,
  2
);

console.log(
  "[PASS] repeatedCompletionIsIdempotent"
);

resetState();

const partial =
  executeStoreCutCompletionToProduction({
    request: request(10, 9.5)
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
  useProductionMaterialStore
    .getState()
    .plans[0]
    .allocations[0]
    .quantity,
  9.5
);

assert.equal(
  useProductionMaterialStore
    .getState()
    .plans[0]
    .allocations[0]
    .status,
  "READY"
);

assert.equal(
  useStore
    .getState()
    .productionItems[0]
    .productionStatus,
  "WAITING_MATERIAL"
);

console.log(
  "[PASS] shortUsableOutputKeepsMaterialGateClosed"
);

resetState();

useStore.setState({
  productionItems: []
});

const failed =
  executeStoreCutCompletionToProduction({
    request: request(10, 10)
  });

assert.equal(
  failed.outcome,
  "REJECTED"
);

if(failed.outcome === "REJECTED") {
  assert.equal(
    failed.stage,
    "PRODUCTION_STORE"
  );
}

assert.equal(
  useSupplyChainStore
    .getState()
    .lots[0]
    .onHandMeters,
  12
);

assert.equal(
  useSupplyChainStore
    .getState()
    .reservations[0]
    .status,
  "ACTIVE"
);

assert.equal(
  useSupplyChainStore
    .getState()
    .cutCompletions.length,
  0
);

console.log(
  "[PASS] productionFailureRollsBackCreatedCutCompletion"
);

console.log(
  "[PASS] storeCutCompletionCoordinatorSuite completed"
);