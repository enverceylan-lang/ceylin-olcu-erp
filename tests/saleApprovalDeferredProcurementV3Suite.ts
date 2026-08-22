import {
  executeSaleSupplyFulfillment,
} from "../src/lib/saleSupplyFulfillmentOrchestrator";

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const result =
  executeSaleSupplyFulfillment({
    tenantId: "tenant-1",
    companyId: "company-1",
    branchId: "branch-1",
    accountingPeriodId: "period-1",
    saleId: "sale-1",
    productionOrderId: "production-1",
    purchaseOrderId: "purchase-1",
    createdByUserId: "admin-1",
    now: "2026-08-21T10:00:00.000Z",
    deferSupplierOrders: true,
    optimization: {
      outcome: "READY",
      saleId: "sale-1",
      stockRequirements: [
        {
          stockItemId: "stock-1",
          totalMeters: 12,
          missingMeters: 12,
          pieces: [
            {
              parentSaleItemId: "sale-item-parent-1",
              productType: "TUL",
              requiredMeters: 12,
              requirement: {
                id: "requirement-1",
                saleItemId: "sale-item-1",
                stockItemId: "stock-1",
                continuity: "SINGLE_PIECE_REQUIRED",
              },
              suggestions: [],
            },
          ],
        },
      ],
      totalMeters: 12,
      missingMeters: 12,
    } as never,
  });

assert(
  result.outcome === "READY",
  "Deferred missing-stock fulfillment should remain READY for planning.",
);

assert(
  result.supplierOrderIds.length === 0,
  "Sale approval must not create supplier orders.",
);

assert(
  result.materialAllocations.length === 0,
  "Deferred supplier need must not fabricate a supplier allocation.",
);

assert(
  result.supplierMeters === 12,
  "Missing business quantity must remain truthful.",
);

console.log(
  "PAK: sale approval deferred procurement V3 runtime suite",
);
