import assert from "node:assert/strict";
import {
  buildMixedSupplySummary,
  decideSupplierOrder,
  summarizeSupplierReceipt,
  type SupplierOrder,
  type SupplierOrderRequest,
} from "../src/lib/supplierSupplyFlow";
import type { ProductionSourcePlan } from "../src/lib/productionSourceModel";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1",
};

function request(
  overrides: Partial<SupplierOrderRequest> = {}
): SupplierOrderRequest {
  return {
    ...scope,
    id: "supplier-order-1",
    idempotencyKey: "supplier:sale-item-1:allocation-1",
    allocationId: "allocation-1",
    supplierId: "supplier-1",
    purchaseOrderId: "purchase-1",
    saleId: "sale-1",
    saleItemId: "sale-item-1",
    productionOrderId: "production-1",
    stockItemId: "fabric-1",
    orderedQuantity: 5,
    createdByUserId: "office-1",
    createdAt: "2026-07-26T03:30:00.000Z",
    ...overrides,
  };
}

const create = decideSupplierOrder(request(), []);
assert.equal(create.outcome, "CREATE");
const saved = (create as { order: SupplierOrder }).order;
assert.equal(decideSupplierOrder(request(), [saved]).outcome, "REPLAY");
assert.equal(
  decideSupplierOrder(request({ orderedQuantity: 6 }), [saved]).outcome,
  "REJECT"
);
const duplicate = decideSupplierOrder(
  request({ id: "other", idempotencyKey: "other-key" }),
  [saved]
);
assert.equal(duplicate.outcome, "REJECT");
if (duplicate.outcome === "REJECT") {
  assert.equal(duplicate.reason, "DUPLICATE_ALLOCATION");
}

assert.equal(summarizeSupplierReceipt(5, 0).status, "WAITING");
assert.equal(summarizeSupplierReceipt(5, 3).status, "PARTIAL");
assert.equal(summarizeSupplierReceipt(5, 5).status, "READY");
const excess = summarizeSupplierReceipt(5, 6);
assert.equal(excess.status, "OVER_RECEIVED");
assert.equal(excess.excessQuantity, 1);

const storePlan: ProductionSourcePlan = {
  id: "plan-store",
  productionItemId: "item-store",
  requiredQuantity: 5,
  unit: "mt",
  version: 1,
  allocations: [
    {
      id: "store-allocation",
      productionItemId: "item-store",
      sourceType: "STORE_CUT",
      quantity: 5,
      unit: "mt",
      status: "READY",
      lotId: "lot-1",
      reservationId: "reservation-1",
    },
  ],
};
const supplierPlan: ProductionSourcePlan = {
  id: "plan-supplier",
  productionItemId: "item-supplier",
  requiredQuantity: 4,
  unit: "mt",
  version: 1,
  allocations: [
    {
      id: "supplier-allocation",
      productionItemId: "item-supplier",
      sourceType: "SUPPLIER_ORDER",
      quantity: 4,
      unit: "mt",
      status: "ORDERED",
      supplierId: "supplier-1",
      supplierOrderId: "purchase-1",
    },
  ],
};

const partialMixed = buildMixedSupplySummary([storePlan, supplierPlan]);
assert.equal(partialMixed.isMixedSource, true);
assert.equal(partialMixed.status, "PARTIALLY_READY");
assert.equal(partialMixed.readyQuantity, 5);

supplierPlan.allocations[0].status = "READY";
assert.equal(
  buildMixedSupplySummary([storePlan, supplierPlan]).status,
  "READY"
);

console.log("[PASS] supplier and mixed supply flow");
