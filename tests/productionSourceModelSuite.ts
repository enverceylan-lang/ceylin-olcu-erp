import assert from "node:assert/strict";
import {
  analyzeProductionSourcePlan,
  canManageProductionSource,
  validateProductionSourcePlan,
  type ProductionSourcePlan,
} from "../src/lib/productionSourceModel";

function createPlan(): ProductionSourcePlan {
  return {
    id: "plan-1",
    productionItemId: "item-1",
    requiredQuantity: 12,
    unit: "mt",
    version: 1,
    allocations: [
      {
        id: "allocation-1",
        productionItemId: "item-1",
        sourceType: "STORE_CUT",
        quantity: 7,
        unit: "mt",
        status: "RESERVED",
        lotId: "lot-1",
        reservationId: "reservation-1",
      },
      {
        id: "allocation-2",
        productionItemId: "item-1",
        sourceType: "SUPPLIER_ORDER",
        quantity: 5,
        unit: "mt",
        status: "ORDERED",
        supplierId: "supplier-1",
        supplierOrderId: "order-1",
      },
    ],
  };
}

const mixedPlan = createPlan();
assert.deepEqual(validateProductionSourcePlan(mixedPlan), []);
assert.deepEqual(analyzeProductionSourcePlan(mixedPlan), {
  allocatedQuantity: 12,
  missingQuantity: 0,
  excessQuantity: 0,
  isFullyAllocated: true,
  isMixedSource: true,
});

const partialPlan = createPlan();
partialPlan.allocations.pop();
assert.equal(analyzeProductionSourcePlan(partialPlan).missingQuantity, 5);
assert.equal(analyzeProductionSourcePlan(partialPlan).isFullyAllocated, false);
assert.deepEqual(validateProductionSourcePlan(partialPlan), []);

const excessivePlan = createPlan();
excessivePlan.allocations[1].quantity = 6;
assert.match(
  validateProductionSourcePlan(excessivePlan).join("\n"),
  /gerekli üretim miktarını aşamaz/
);

const invalidStoreCut = createPlan();
delete invalidStoreCut.allocations[0].lotId;
delete invalidStoreCut.allocations[0].reservationId;
assert.match(
  validateProductionSourcePlan(invalidStoreCut).join("\n"),
  /top\/lot zorunludur/
);
assert.match(
  validateProductionSourcePlan(invalidStoreCut).join("\n"),
  /rezervasyon zorunludur/
);

const wrongUnit = createPlan();
wrongUnit.allocations[0].unit = "adet";
assert.match(
  validateProductionSourcePlan(wrongUnit).join("\n"),
  /miktar birimi plan ile eşleşmiyor/
);

const duplicateAllocation = createPlan();
duplicateAllocation.allocations[1].id = "allocation-1";
assert.match(
  validateProductionSourcePlan(duplicateAllocation).join("\n"),
  /mükerrer kaynak kimliği/
);

assert.equal(canManageProductionSource("admin"), true);
assert.equal(canManageProductionSource("OFFICE"), true);
assert.equal(canManageProductionSource("tailor"), false);
assert.equal(canManageProductionSource("field"), false);

console.log("[PASS] production source model");
