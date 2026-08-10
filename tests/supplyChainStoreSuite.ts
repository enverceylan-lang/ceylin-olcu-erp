import assert from "node:assert/strict";
import {
  useSupplyChainStore
} from "../src/store/useSupplyChainStore";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1"
};

useSupplyChainStore.setState({
  lots: [],
  reservations: [],
  supplierOrders: [],
  purchaseDocuments: [],
  tradeOrderLinks: []
});

const createdLot =
  useSupplyChainStore
    .getState()
    .upsertLot({
      ...scope,
      id: "lot-20",
      stockItemId:
        "stock-bambu",
      onHandMeters: 20,
      unusableMeters: 0,
      lotCode: "L1",
      colorTone: "A",
      patternCode: "P1",
      createdAt:
        "2026-08-02T13:30:00.000Z",
      updatedAt:
        "2026-08-02T13:30:00.000Z"
    });

assert.equal(
  createdLot.outcome,
  "CREATED"
);

const reserve =
  useSupplyChainStore
    .getState()
    .reserveStock({
      ...scope,
      id: "reservation-12",
      idempotencyKey:
        "RESERVE:SALE-1:ITEM-1:LOT-20",
      allocationId:
        "allocation-12",
      saleId: "sale-1",
      saleItemId: "item-1",
      productionOrderId:
        "production-1",
      stockItemId:
        "stock-bambu",
      stockLotId:
        "lot-20",
      quantityMeters: 12,
      createdByUserId:
        "admin-1",
      createdAt:
        "2026-08-02T13:31:00.000Z"
    });

assert.equal(
  reserve.outcome,
  "CREATED"
);

const replay =
  useSupplyChainStore
    .getState()
    .reserveStock({
      ...scope,
      id: "reservation-12",
      idempotencyKey:
        "RESERVE:SALE-1:ITEM-1:LOT-20",
      allocationId:
        "allocation-12",
      saleId: "sale-1",
      saleItemId: "item-1",
      productionOrderId:
        "production-1",
      stockItemId:
        "stock-bambu",
      stockLotId:
        "lot-20",
      quantityMeters: 12,
      createdByUserId:
        "admin-1",
      createdAt:
        "2026-08-02T13:31:00.000Z"
    });

assert.equal(
  replay.outcome,
  "REPLAY"
);

const cutLots =
  useSupplyChainStore
    .getState()
    .getStoreCutLots(
      scope,
      "stock-bambu"
    );

assert.equal(
  cutLots.length,
  1
);

assert.equal(
  cutLots[0].reservedMeters,
  12
);

const supplier =
  useSupplyChainStore
    .getState()
    .createSupplierOrder({
      ...scope,
      id: "supplier-order-8",
      idempotencyKey:
        "SUPPLIER:SALE-1:ITEM-2:8",
      allocationId:
        "supplier-allocation-8",
      supplierId:
        "supplier-1",
      purchaseOrderId:
        "po-1",
      saleId:
        "sale-1",
      saleItemId:
        "item-2",
      productionOrderId:
        "production-1",
      stockItemId:
        "stock-bambu",
      orderedQuantity: 8,
      purpose: "TAILOR_MATERIAL",
      createdByUserId:
        "admin-1",
      createdAt:
        "2026-08-02T13:32:00.000Z"
    });

assert.equal(
  supplier.outcome,
  "CREATED"
);

const purchase =
  useSupplyChainStore
    .getState()
    .createPurchaseDocument({
      ...scope,
      id: "purchase-1",
      idempotencyKey:
        "PURCHASE:SUPPLIER-1:PO-1",
      documentNo:
        "PO-1",
      supplierId:
        "supplier-1",
      supplierName:
        "Tedarikçi A",
      documentDate:
        "2026-08-02T13:32:00.000Z",
      lines: [
        {
          id: "purchase-line-1",
          kind: "GOODS",
          stockItemId:
            "stock-bambu",
          description:
            "Bambu Tül",
          quantity: 8,
          unit: "mt",
          unitPrice: 0,
          taxRate: 20
        }
      ],
      supplierOrderId:
        "supplier-order-8",
      createdByUserId:
        "admin-1",
      now:
        "2026-08-02T13:32:00.000Z"
    });

assert.equal(
  purchase.outcome,
  "CREATED"
);

const foreignScopeLots =
  useSupplyChainStore
    .getState()
    .getStoreCutLots(
      {
        ...scope,
        companyId:
          "company-2"
      },
      "stock-bambu"
    );

assert.equal(
  foreignScopeLots.length,
  0
);

console.log(
  "[PASS] lotPersistenceFoundation"
);
console.log(
  "[PASS] reservationUsesExistingGuard"
);
console.log(
  "[PASS] reservedMetersDerivedFromReservations"
);
console.log(
  "[PASS] supplierOrderUsesExistingFlow"
);
console.log(
  "[PASS] purchaseDocumentUsesExistingService"
);
console.log(
  "[PASS] scopeIsolationInSelectors"
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

assert.ok(
  baselineReservations.length > 0
);

assert.ok(
  baselineSupplierOrders.length > 0
);

const tempReservation = {
  ...baselineReservations[0],
  id: "temporary-rollback-reservation",
  idempotencyKey:
    "TEMP:ROLLBACK:RESERVATION",
  allocationId:
    "temporary-rollback-reservation"
};

const tempSupplierOrder = {
  ...baselineSupplierOrders[0],
  id: "temporary-rollback-supplier-order",
  idempotencyKey:
    "TEMP:ROLLBACK:SUPPLIER",
  allocationId:
    "temporary-rollback-supplier-order"
};

useSupplyChainStore
  .setState({
    reservations: [
      ...baselineReservations,
      tempReservation
    ],
    supplierOrders: [
      ...baselineSupplierOrders,
      tempSupplierOrder
    ]
  });

useSupplyChainStore
  .getState()
  .rollbackFulfillmentCreated({
    scope,
    reservationIds: [
      tempReservation.id
    ],
    supplierOrderIds: [
      tempSupplierOrder.id
    ]
  });

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
  "[PASS] selectiveRollbackPreservesPreExistingSupplyState"
);
console.log(
  "[PASS] supplyChainStoreSuite completed"
);