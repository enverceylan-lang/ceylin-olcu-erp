import assert from "node:assert/strict";
import type {
  SaleOperationWorkPackage
} from "../src/lib/saleOperationWorkPackages";
import {
  buildTailorMaterialSourcePlan,
  canReleaseTailorWork,
  getCentralProductionItemId
} from "../src/lib/tailorMaterialSourcePlanner";

const tailorPackage:
  SaleOperationWorkPackage = {
    id:
      "sale-work-package:sale-1:TAILOR_MATERIAL",
    saleId: "sale-1",
    kind: "TAILOR_MATERIAL",
    route:
      "TAILOR_AND_MATERIAL_SOURCE",
    itemIds: ["item-1"],
    items: [],
    requiresTailor: true,
    requiresSupplier: false,
    requiresMaterialSourceDecision: true
  };

assert.equal(
  getCentralProductionItemId(
    "sale-1",
    "item-1"
  ),
  "central-production-sale-1-item-1"
);

const storeCutReady =
  buildTailorMaterialSourcePlan({
    workPackage: tailorPackage,
    saleItemId: "item-1",
    requiredQuantity: 6.5,
    unit: "mt",
    allocations: [
      {
        id: "alloc-store-cut",
        sourceType: "STORE_CUT",
        quantity: 6.5,
        status: "READY",
        lotId: "lot-1",
        reservationId:
          "reservation-1"
      }
    ]
  });

assert.equal(
  storeCutReady.outcome,
  "READY"
);
assert.equal(
  canReleaseTailorWork(
    storeCutReady
  ),
  true
);

const readyStockReady =
  buildTailorMaterialSourcePlan({
    workPackage: tailorPackage,
    saleItemId: "item-1",
    requiredQuantity: 6.5,
    unit: "mt",
    allocations: [
      {
        id: "alloc-ready-stock",
        sourceType: "READY_STOCK",
        quantity: 6.5,
        status: "READY",
        reservationId:
          "reservation-ready-1"
      }
    ]
  });

assert.equal(
  readyStockReady.outcome,
  "READY"
);

const supplierWaiting =
  buildTailorMaterialSourcePlan({
    workPackage: tailorPackage,
    saleItemId: "item-1",
    requiredQuantity: 6.5,
    unit: "mt",
    allocations: [
      {
        id: "alloc-supplier",
        sourceType:
          "SUPPLIER_ORDER",
        quantity: 6.5,
        status: "ORDERED",
        supplierId:
          "supplier-1",
        supplierOrderId:
          "supplier-order-1"
      }
    ]
  });

assert.equal(
  supplierWaiting.outcome,
  "WAITING"
);
assert.equal(
  canReleaseTailorWork(
    supplierWaiting
  ),
  false
);

const supplierReady =
  buildTailorMaterialSourcePlan({
    workPackage: tailorPackage,
    saleItemId: "item-1",
    requiredQuantity: 6.5,
    unit: "mt",
    allocations: [
      {
        id: "alloc-supplier",
        sourceType:
          "SUPPLIER_ORDER",
        quantity: 6.5,
        status: "READY",
        supplierId:
          "supplier-1",
        supplierOrderId:
          "supplier-order-1"
      }
    ]
  });

assert.equal(
  supplierReady.outcome,
  "READY"
);
assert.equal(
  canReleaseTailorWork(
    supplierReady
  ),
  true
);

const mixedReady =
  buildTailorMaterialSourcePlan({
    workPackage: tailorPackage,
    saleItemId: "item-1",
    requiredQuantity: 10,
    unit: "mt",
    allocations: [
      {
        id: "alloc-store",
        sourceType: "STORE_CUT",
        quantity: 4,
        status: "READY",
        lotId: "lot-1",
        reservationId: "res-1"
      },
      {
        id: "alloc-supplier",
        sourceType:
          "SUPPLIER_ORDER",
        quantity: 6,
        status: "READY",
        supplierId:
          "supplier-1",
        supplierOrderId:
          "order-1"
      }
    ]
  });

assert.equal(
  mixedReady.outcome,
  "READY"
);
assert.equal(
  mixedReady.outcome === "READY"
    ? mixedReady.readiness
        .completionPercent
    : 0,
  100
);

const partial =
  buildTailorMaterialSourcePlan({
    workPackage: tailorPackage,
    saleItemId: "item-1",
    requiredQuantity: 10,
    unit: "mt",
    allocations: [
      {
        id: "alloc-store",
        sourceType: "STORE_CUT",
        quantity: 4,
        status: "READY",
        lotId: "lot-1",
        reservationId: "res-1"
      },
      {
        id: "alloc-supplier",
        sourceType:
          "SUPPLIER_ORDER",
        quantity: 6,
        status: "ORDERED",
        supplierId:
          "supplier-1",
        supplierOrderId:
          "order-1"
      }
    ]
  });

assert.equal(
  partial.outcome,
  "WAITING"
);
assert.equal(
  partial.outcome === "WAITING"
    ? partial.readiness.status
    : "",
  "PARTIALLY_READY"
);

const invalidStoreCut =
  buildTailorMaterialSourcePlan({
    workPackage: tailorPackage,
    saleItemId: "item-1",
    requiredQuantity: 5,
    unit: "mt",
    allocations: [
      {
        id: "alloc-invalid",
        sourceType: "STORE_CUT",
        quantity: 5,
        status: "RESERVED"
      }
    ]
  });

assert.equal(
  invalidStoreCut.outcome,
  "REJECT"
);

const wrongPackage:
  SaleOperationWorkPackage = {
    ...tailorPackage,
    kind:
      "SUPPLIER_MECHANICAL",
    route:
      "SUPPLIER_MECHANICAL"
  };

const wrongPackageResult =
  buildTailorMaterialSourcePlan({
    workPackage: wrongPackage,
    saleItemId: "item-1",
    requiredQuantity: 5,
    unit: "mt",
    allocations: []
  });

assert.equal(
  wrongPackageResult.outcome,
  "REJECT"
);

console.log(
  "[PASS] storeCutReadyReleasesTailor"
);
console.log(
  "[PASS] readyStockReadyReleasesTailor"
);
console.log(
  "[PASS] supplierOrderedWaits"
);
console.log(
  "[PASS] supplierReadyReleasesTailor"
);
console.log(
  "[PASS] mixedSourcesRequireFullReadiness"
);
console.log(
  "[PASS] invalidSourcePlanFailsClosed"
);
console.log(
  "[PASS] nonTailorPackageRejected"
);
console.log(
  "[PASS] tailorMaterialSourcePlannerSuite completed"
);