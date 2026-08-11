import assert from "node:assert/strict";
import {
  buildProductionSourcePlansFromFulfillment
} from "../src/lib/supplyFulfillmentProductionSourceBridge";
import type {
  SaleOperationWorkPackage
} from "../src/lib/saleOperationWorkPackages";

const workPackage:
  SaleOperationWorkPackage = {
    id:
      "sale-work-package:sale-1:TAILOR_MATERIAL",
    saleId: "sale-1",
    kind: "TAILOR_MATERIAL",
    route:
      "TAILOR_AND_MATERIAL_SOURCE",
    itemIds: [
      "parent-item-1"
    ],
    items: [],
    requiresTailor: true,
    requiresSupplier: false,
    requiresMaterialSourceDecision:
      true
  };

const result =
  buildProductionSourcePlansFromFulfillment(
    workPackage,
    {
      outcome: "PARTIAL",
      reservationIds: [
        "reservation-12"
      ],
      supplierOrderIds: [
        "supplier-order-8"
      ],
      supplierOrder: null,
      reservedMeters: 12,
      supplierMeters: 8,
      errors: [],
      materialAllocations: [
        {
          id: "allocation-12",
          saleItemId:
            "detail-item-12",
          parentSaleItemId:
            "parent-item-1",
          stockItemId:
            "stock-bambu",
          sourceType:
            "STORE_CUT",
          quantity: 12,
          status: "RESERVED",
          lotId: "lot-12",
          reservationId:
            "reservation-12"
        },
        {
          id:
            "supplier-allocation-8",
          saleItemId:
            "detail-item-8",
          parentSaleItemId:
            "parent-item-1",
          stockItemId:
            "stock-bambu",
          sourceType:
            "SUPPLIER_ORDER",
          quantity: 8,
          status: "ORDERED",
          supplierId:
            "supplier-1",
          supplierOrderId:
            "supplier-order-8"
        }
      ]
    }
  );

assert.equal(
  result.outcome,
  "READY"
);

if (result.outcome !== "READY") {
  throw new Error(
    "Bridge plan üretemedi."
  );
}

assert.equal(
  result.plans.length,
  2
);

assert.equal(
  result.plans[0]
    .productionItemId,
  "central-production-sale-1-detail-item-12"
);

assert.equal(
  result.plans[1]
    .productionItemId,
  "central-production-sale-1-detail-item-8"
);

assert.equal(
  result.plans[0]
    .allocations[0]
    .status,
  "RESERVED"
);

assert.equal(
  result.plans[1]
    .allocations[0]
    .status,
  "ORDERED"
);

console.log(
  "[PASS] groupedSaleParentAuthorizesDetailProductionItems"
);
console.log(
  "[PASS] stockReservationMapsToStoreCutAllocation"
);
console.log(
  "[PASS] supplierOrderMapsToSupplierAllocation"
);
console.log(
  "[PASS] plansRemainWaitingUntilSourceTurnsReady"
);
console.log(
  "[PASS] supplyFulfillmentProductionSourceBridgeSuite completed"
);