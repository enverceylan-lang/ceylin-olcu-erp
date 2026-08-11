import assert from "node:assert/strict";
import {
  useSupplyChainStore
} from "../src/store/useSupplyChainStore";
import {
  executeSaleSupplyFulfillment
} from "../src/lib/saleSupplyFulfillmentOrchestrator";
import type {
  SaleCutOptimizationResult
} from "../src/lib/saleCutOptimizerAdapter";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1"
};

useSupplyChainStore.setState({
  lots: [
    {
      ...scope,
      id: "lot-12",
      stockItemId:
        "stock-bambu",
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
            openingName:
              "1. Cam",
            productType:
              "Bambu Tül",
            requiredMeters: 12,
            requirement: {
              id:
                "requirement-12",
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
                id:
                  "suggestion-12",
                score: 1000,
                cuts: [
                  {
                    id: "cut-12",
                    requirementId:
                      "requirement-12",
                    lotId:
                      "lot-12",
                    lengthMeters: 12
                  }
                ],
                lotIds:
                  ["lot-12"],
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
            openingName:
              "2. Cam",
            productType:
              "Bambu Tül",
            requiredMeters: 8,
            requirement: {
              id:
                "requirement-8",
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

const result =
  executeSaleSupplyFulfillment({
    ...scope,
    saleId: "sale-1",
    productionOrderId:
      "production-1",
    purchaseOrderId:
      "PO-1",
    supplierId:
      "supplier-1",
    supplierName:
      "Tedarikçi A",
    createdByUserId:
      "admin-1",
    now:
      "2026-08-02T14:10:00.000Z",
    optimization
  });

assert.equal(
  result.outcome,
  "PARTIAL"
);

assert.equal(
  result.reservedMeters,
  12
);

assert.equal(
  result.supplierMeters,
  8
);

assert.equal(
  result.reservationIds.length,
  1
);

assert.equal(
  result.supplierOrder
    ?.instructions.length,
  1
);

assert.equal(
  result.supplierOrderIds.length,
  1
);

assert.equal(
  result.materialAllocations.length,
  2
);

assert.equal(
  result.supplierOrder
    ?.instructions[0]
    .kind,
  "CUT_LENGTH"
);

if (
  result.supplierOrder
    ?.instructions[0]
    .kind === "CUT_LENGTH"
) {
  assert.equal(
    result.supplierOrder
      .instructions[0]
      .lengthMeters,
    8
  );

  assert.equal(
    result.supplierOrder
      .instructions[0]
      .splitAllowed,
    true
  );
}

const persisted =
  useSupplyChainStore
    .getState()
    .reservations;

assert.equal(
  persisted.length,
  1
);

assert.equal(
  persisted[0]
    .quantityMeters,
  12
);

console.log(
  "[PASS] bestLotSuggestionBecomesReservation"
);
console.log(
  "[PASS] uncoveredPieceBecomesSupplierInstruction"
);
console.log(
  "[PASS] supplierReceives8MeterPieceNotInternalLotData"
);
console.log(
  "[PASS] reservationPersistsInSupplyChainStore"
);
const baselineReservations =
  [
    ...useSupplyChainStore
      .getState()
      .reservations
  ];

const baselineSupplierOrders =
  [
    ...useSupplyChainStore
      .getState()
      .supplierOrders
  ];

const failingOptimization:
  SaleCutOptimizationResult = {
    outcome: "READY",
    saleId: "sale-rollback",
    totalMeters: 24,
    missingMeters: 0,
    stockRequirements: [
      {
        stockItemId:
          "stock-bambu",
        productType:
          "Bambu Tul",
        totalMeters: 24,
        fullyCovered: true,
        missingMeters: 0,
        pieces: [
          {
            parentSaleItemId:
              "rollback-parent",
            roomName: "Salon",
            openingName: "1. Cam",
            productType: "Bambu Tul",
            requiredMeters: 4,
            requirement: {
              id: "rollback-1",
              saleItemId:
                "rollback-item-1",
              stockItemId:
                "stock-bambu",
              pieceLengthMeters: 4,
              pieceCount: 1,
              continuity:
                "SINGLE_PIECE_REQUIRED"
            },
            suggestions: [
              {
                id: "rollback-suggestion-1",
                score: 1,
                cuts: [
                  {
                    id: "rollback-cut-1",
                    requirementId:
                      "rollback-1",
                    lotId: "lot-12",
                    lengthMeters: 4
                  }
                ],
                lotIds: ["lot-12"],
                totalWasteMeters: 0,
                remainingMeters: 8,
                exhaustedLotCount: 0,
                warnings: [],
                evaluation: {
                  valid: true,
                  requiredMeters: 4,
                  plannedCutMeters: 4,
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
              "rollback-parent",
            roomName: "Salon",
            openingName: "2. Cam",
            productType: "Bambu Tul",
            requiredMeters: 20,
            requirement: {
              id: "rollback-2",
              saleItemId:
                "rollback-item-2",
              stockItemId:
                "stock-bambu",
              pieceLengthMeters: 20,
              pieceCount: 1,
              continuity:
                "SINGLE_PIECE_REQUIRED"
            },
            suggestions: [
              {
                id: "rollback-suggestion-2",
                score: 1,
                cuts: [
                  {
                    id: "rollback-cut-2",
                    requirementId:
                      "rollback-2",
                    lotId: "lot-12",
                    lengthMeters: 20
                  }
                ],
                lotIds: ["lot-12"],
                totalWasteMeters: 0,
                remainingMeters: 0,
                exhaustedLotCount: 1,
                warnings: [],
                evaluation: {
                  valid: true,
                  requiredMeters: 20,
                  plannedCutMeters: 20,
                  planWasteMeters: 0,
                  lotResults: [],
                  requirementResults: [],
                  errors: []
                }
              }
            ]
          }
        ]
      }
    ]
  };

const rollbackResult =
  executeSaleSupplyFulfillment({
    ...scope,
    saleId: "sale-rollback",
    productionOrderId:
      "production-rollback",
    purchaseOrderId:
      "PO-rollback",
    supplierId:
      "supplier-rollback",
    supplierName:
      "Rollback Supplier",
    createdByUserId:
      "admin-1",
    now:
      "2026-08-02T14:20:00.000Z",
    optimization:
      failingOptimization
  });

assert.equal(
  rollbackResult.outcome,
  "REJECTED"
);

assert.deepEqual(
  useSupplyChainStore
    .getState()
    .reservations,
  baselineReservations
);

assert.deepEqual(
  useSupplyChainStore
    .getState()
    .supplierOrders,
  baselineSupplierOrders
);

console.log(
  "[PASS] fulfillmentFailureRollsBackReservationsAndSupplierOrders"
);
console.log(
  "[PASS] saleSupplyFulfillmentOrchestratorSuite completed"
);
/*
 * Yeni regression blokları önceki suite state'ini paylaşmaz.
 * Önceki testlerde lot-12 üzerinde rezervasyon oluştuğu için
 * bağımsız temiz lot/store kurulmadan "stok yeterli" testi
 * yanlış REJECTED verebilir.
 */
useSupplyChainStore.setState({
  lots: [
    {
      ...scope,
      id: "lot-no-supplier",
      stockItemId: "stock-bambu",
      onHandMeters: 12,
      unusableMeters: 0,
      lotCode: "L-NO-SUPPLIER",
      createdAt:
        "2026-08-02T14:25:00.000Z",
      updatedAt:
        "2026-08-02T14:25:00.000Z"
    }
  ],
  reservations: [],
  supplierOrders: [],
  purchaseDocuments: [],
  tradeOrderLinks: []
});

const noSupplierFullStockOptimization:
  SaleCutOptimizationResult = {
    outcome: "READY",
    saleId: "sale-no-supplier-needed",
    totalMeters: 4,
    missingMeters: 0,
    stockRequirements: [
      {
        stockItemId: "stock-bambu",
        productType: "Bambu Tul",
        totalMeters: 4,
        fullyCovered: true,
        missingMeters: 0,
        pieces: [
          {
            parentSaleItemId:
              "no-supplier-parent",
            roomName: "Salon",
            openingName: "3. Cam",
            productType: "Bambu Tul",
            requiredMeters: 4,
            requirement: {
              id:
                "no-supplier-requirement",
              saleItemId:
                "no-supplier-item",
              stockItemId:
                "stock-bambu",
              pieceLengthMeters: 4,
              pieceCount: 1,
              continuity:
                "SINGLE_PIECE_REQUIRED"
            },
            suggestions: [
              {
                id:
                  "no-supplier-suggestion",
                score: 1,
                cuts: [
                  {
                    id:
                      "no-supplier-cut",
                    requirementId:
                      "no-supplier-requirement",
                    lotId: "lot-no-supplier",
                    lengthMeters: 4
                  }
                ],
                lotIds: ["lot-no-supplier"],
                totalWasteMeters: 0,
                remainingMeters: 8,
                exhaustedLotCount: 0,
                warnings: [],
                evaluation: {
                  valid: true,
                  requiredMeters: 4,
                  plannedCutMeters: 4,
                  planWasteMeters: 0,
                  lotResults: [],
                  requirementResults: [],
                  errors: []
                }
              }
            ]
          }
        ]
      }
    ]
  };

const noSupplierNeededResult =
  executeSaleSupplyFulfillment({
    ...scope,
    saleId:
      "sale-no-supplier-needed",
    productionOrderId:
      "production-no-supplier-needed",
    purchaseOrderId:
      "PO-no-supplier-needed",
    createdByUserId: "admin-1",
    now:
      "2026-08-02T14:30:00.000Z",
    optimization:
      noSupplierFullStockOptimization
  });

assert.equal(
  noSupplierNeededResult.outcome,
  "READY"
);

assert.equal(
  noSupplierNeededResult.supplierMeters,
  0
);

assert.equal(
  noSupplierNeededResult.supplierOrder,
  null
);

console.log(
  "[PASS] fullyStockedFulfillmentDoesNotRequireSupplier"
);

/*
 * Missing-supplier rollback testi de bağımsız state ile başlar.
 * İlk parça rezervasyon oluşturur, ikinci parça supplier ister;
 * supplier yoksa ilk rezervasyon selective rollback ile silinmelidir.
 */
useSupplyChainStore.setState({
  lots: [
    {
      ...scope,
      id: "lot-missing-supplier",
      stockItemId: "stock-bambu",
      onHandMeters: 4,
      unusableMeters: 0,
      lotCode: "L-MISSING-SUPPLIER",
      createdAt:
        "2026-08-02T14:32:00.000Z",
      updatedAt:
        "2026-08-02T14:32:00.000Z"
    }
  ],
  reservations: [],
  supplierOrders: [],
  purchaseDocuments: [],
  tradeOrderLinks: []
});

const baselineBeforeMissingSupplier =
  {
    reservations: [
      ...useSupplyChainStore
        .getState()
        .reservations
    ],
    supplierOrders: [
      ...useSupplyChainStore
        .getState()
        .supplierOrders
    ]
  };

const missingSupplierOptimization:
  SaleCutOptimizationResult = {
    outcome: "READY",
    saleId: "sale-missing-supplier",
    totalMeters: 10,
    missingMeters: 6,
    stockRequirements: [
      {
        stockItemId: "stock-bambu",
        productType: "Bambu Tul",
        totalMeters: 10,
        fullyCovered: false,
        missingMeters: 6,
        pieces: [
          {
            parentSaleItemId:
              "missing-supplier-parent",
            roomName: "Salon",
            openingName: "4. Cam",
            productType: "Bambu Tul",
            requiredMeters: 4,
            requirement: {
              id:
                "missing-supplier-stock-piece",
              saleItemId:
                "missing-supplier-item-1",
              stockItemId:
                "stock-bambu",
              pieceLengthMeters: 4,
              pieceCount: 1,
              continuity:
                "SINGLE_PIECE_REQUIRED"
            },
            suggestions: [
              {
                id:
                  "missing-supplier-stock-suggestion",
                score: 1,
                cuts: [
                  {
                    id:
                      "missing-supplier-stock-cut",
                    requirementId:
                      "missing-supplier-stock-piece",
                    lotId: "lot-missing-supplier",
                    lengthMeters: 4
                  }
                ],
                lotIds: ["lot-missing-supplier"],
                totalWasteMeters: 0,
                remainingMeters: 8,
                exhaustedLotCount: 0,
                warnings: [],
                evaluation: {
                  valid: true,
                  requiredMeters: 4,
                  plannedCutMeters: 4,
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
              "missing-supplier-parent",
            roomName: "Salon",
            openingName: "5. Cam",
            productType: "Bambu Tul",
            requiredMeters: 6,
            requirement: {
              id:
                "missing-supplier-fallback-piece",
              saleItemId:
                "missing-supplier-item-2",
              stockItemId:
                "stock-bambu",
              pieceLengthMeters: 6,
              pieceCount: 1,
              continuity:
                "SINGLE_PIECE_REQUIRED"
            },
            suggestions: []
          }
        ]
      }
    ]
  };

const missingSupplierResult =
  executeSaleSupplyFulfillment({
    ...scope,
    saleId:
      "sale-missing-supplier",
    productionOrderId:
      "production-missing-supplier",
    purchaseOrderId:
      "PO-missing-supplier",
    createdByUserId: "admin-1",
    now:
      "2026-08-02T14:35:00.000Z",
    optimization:
      missingSupplierOptimization
  });

assert.equal(
  missingSupplierResult.outcome,
  "REJECTED"
);

assert.match(
  missingSupplierResult.errors[0] ?? "",
  /gerçek tedarikçi cari/i
);

assert.deepEqual(
  useSupplyChainStore
    .getState()
    .reservations,
  baselineBeforeMissingSupplier
    .reservations
);

assert.deepEqual(
  useSupplyChainStore
    .getState()
    .supplierOrders,
  baselineBeforeMissingSupplier
    .supplierOrders
);

console.log(
  "[PASS] supplierFallbackRequiresCanonicalSupplierAndRollsBack"
);