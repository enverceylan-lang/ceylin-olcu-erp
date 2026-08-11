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
import type {
  SaleOperationWorkPackage
} from "../src/lib/saleOperationWorkPackages";
import type {
  SaleCutOptimizationResult
} from "../src/lib/saleCutOptimizerAdapter";
import {
  executeTailorFulfillmentToProduction
} from "../src/lib/tailorFulfillmentProductionCoordinator";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1"
};

function productionItem(
  saleLineId: string
): ProductionItem {
  return {
    id:
      `central-production-sale-1-${saleLineId}`,
    orderId: "sale-1",
    saleLineId,
    customerId: "customer-1",
    roomName: "Salon",
    openingName: "Pencere",
    productName: "Bambu Tül",
    productType: "Bambu Tül",
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

const workPackage:
  SaleOperationWorkPackage = {
    id:
      "sale-work-package:sale-1:TAILOR_MATERIAL",
    saleId: "sale-1",
    kind: "TAILOR_MATERIAL",
    route:
      "TAILOR_AND_MATERIAL_SOURCE",
    itemIds: ["parent-item-1"],
    items: [],
    requiresTailor: true,
    requiresSupplier: false,
    requiresMaterialSourceDecision:
      true
  };

const optimization:
  SaleCutOptimizationResult = {
    outcome: "READY",
    saleId: "sale-1",
    totalMeters: 20,
    missingMeters: 8,
    stockRequirements: [
      {
        stockItemId:
          "stock-bambu",
        productType:
          "Bambu Tül",
        totalMeters: 20,
        fullyCovered: false,
        missingMeters: 8,
        pieces: [
          {
            parentSaleItemId:
              "parent-item-1",
            roomName: "Salon",
            openingName: "1. Cam",
            productType:
              "Bambu Tül",
            requiredMeters: 12,
            requirement: {
              id: "requirement-12",
              saleItemId:
                "sale-item-12",
              stockItemId:
                "stock-bambu",
              pieceLengthMeters: 12,
              pieceCount: 1,
              continuity:
                "SINGLE_PIECE_REQUIRED"
            },
            suggestions: [
              {
                id: "suggestion-12",
                score: 1000,
                cuts: [
                  {
                    id: "cut-12",
                    requirementId:
                      "requirement-12",
                    lotId: "lot-12",
                    lengthMeters: 12
                  }
                ],
                lotIds: ["lot-12"],
                totalWasteMeters: 0,
                remainingMeters: 0,
                exhaustedLotCount: 1,
                warnings: [],
                evaluation: {
                  valid: true,
                  requiredMeters: 12,
                  plannedCutMeters: 12,
                  planWasteMeters: 0,
                  lotResults: [],
                  requirementResults: [],
                  errors: []
                }
              }
            ]
          },
          {
            parentSaleItemId:
              "parent-item-1",
            roomName: "Salon",
            openingName: "2. Cam",
            productType:
              "Bambu Tül",
            requiredMeters: 8,
            requirement: {
              id: "requirement-8",
              saleItemId:
                "sale-item-8",
              stockItemId:
                "stock-bambu",
              pieceLengthMeters: 8,
              pieceCount: 1,
              continuity:
                "MULTI_PIECE_ALLOWED"
            },
            suggestions: []
          }
        ]
      }
    ]
  };

const originalProductionItems =
  useStore.getState()
    .productionItems;

useSupplyChainStore.setState({
  lots: [
    {
      ...scope,
      id: "lot-12",
      stockItemId: "stock-bambu",
      onHandMeters: 12,
      unusableMeters: 0,
      lotCode: "L1",
      createdAt:
        "2026-08-02T14:00:00.000Z",
      updatedAt:
        "2026-08-02T14:00:00.000Z"
    }
  ],
  reservations: [],
  supplierOrders: [],
  purchaseDocuments: [],
  tradeOrderLinks: []
});

useProductionMaterialStore.setState({
  plans: []
});

/*
 * İlk production item var, ikinci yok.
 * Böylece batch'in ilk write'ı başarılı olup ikinci write'ta
 * fail etmesi ve selective rollback çalışması zorlanır.
 */
useStore.setState({
  productionItems: [
    productionItem(
      "sale-item-12"
    )
  ]
});

const failed =
  executeTailorFulfillmentToProduction({
    workPackage,
    fulfillmentInput: {
      ...scope,
      saleId: "sale-1",
      productionOrderId:
        "production-1",
      purchaseOrderId: "PO-1",
      supplierId: "supplier-1",
      supplierName: "Tedarikçi A",
      createdByUserId: "admin-1",
      now:
        "2026-08-02T14:10:00.000Z",
      optimization
    }
  });

assert.equal(
  failed.outcome,
  "REJECTED"
);

if(failed.outcome === "REJECTED"){
  assert.equal(
    failed.stage,
    "PRODUCTION_STORE"
  );
}

assert.equal(
  useProductionMaterialStore
    .getState()
    .plans.length,
  0
);

assert.equal(
  useSupplyChainStore
    .getState()
    .reservations.length,
  0
);

assert.equal(
  useSupplyChainStore
    .getState()
    .supplierOrders.length,
  0
);

console.log(
  "[PASS] downstreamProductionFailureRollsBackCreatedSupplyAndPartialPlans"
);

/*
 * Eksik production item tamamlanınca aynı idempotent işlem
 * temiz şekilde yeniden yürüyebilmelidir.
 */
useStore.setState({
  productionItems: [
    productionItem(
      "sale-item-12"
    ),
    productionItem(
      "sale-item-8"
    )
  ]
});

const committed =
  executeTailorFulfillmentToProduction({
    workPackage,
    fulfillmentInput: {
      ...scope,
      saleId: "sale-1",
      productionOrderId:
        "production-1",
      purchaseOrderId: "PO-1",
      supplierId: "supplier-1",
      supplierName: "Tedarikçi A",
      createdByUserId: "admin-1",
      now:
        "2026-08-02T14:10:00.000Z",
      optimization
    }
  });

assert.equal(
  committed.outcome,
  "COMMITTED"
);

assert.equal(
  useSupplyChainStore
    .getState()
    .reservations.length,
  1
);

assert.equal(
  useSupplyChainStore
    .getState()
    .supplierOrders.length,
  1
);

assert.equal(
  useProductionMaterialStore
    .getState()
    .plans.length,
  2
);

assert.deepEqual(
  useStore
    .getState()
    .productionItems
    .map(item =>
      item.productionStatus
    ),
  [
    "WAITING_MATERIAL",
    "WAITING_MATERIAL"
  ]
);

console.log(
  "[PASS] fulfillmentBridgePlansPersistAndRemainMaterialGated"
);

if(
  committed.outcome ===
  "COMMITTED"
){
  assert.deepEqual(
    committed.fulfillment
      .createdReservationIds,
    [
      "reservation:sale-1:requirement-12:lot-12:1"
    ]
  );

  assert.deepEqual(
    committed.fulfillment
      .createdSupplierOrderIds,
    [
      "supplier-order:PO-1:requirement-8"
    ]
  );
}

console.log(
  "[PASS] rollbackTokenContainsCreatedRecordsOnly"
);

useStore.setState({
  productionItems:
    originalProductionItems
});

useProductionMaterialStore.setState({
  plans: []
});

useSupplyChainStore.setState({
  lots: [],
  reservations: [],
  supplierOrders: [],
  purchaseDocuments: [],
  tradeOrderLinks: []
});

console.log(
  "[PASS] tailorFulfillmentProductionCoordinatorSuite completed"
);