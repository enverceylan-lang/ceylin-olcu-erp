import assert from "node:assert/strict";
import {
  decideProcurementServerContract,
} from "../src/lib/procurement/procurementServerContract";

const create = decideProcurementServerContract({
  action: "CREATE_ORDER",
  idempotencyKey: "proc:test:create:1",
  saleId: "sale:1",
  supplierId: "supplier:1",
  supplierOrderId: "order:1",
  lines: [{
    needId: "need:1",
    saleItemId: "item:1",
    stockItemId: "stock:1",
    supplierOrderLineId: "line:1",
    productionOrderId: "central-production:sale:1:item:1",
    allocationId: "supplier-allocation:sale:1:item:1:stock:1",
    purpose: "TAILOR_MATERIAL",
    requiredQuantity: 12,
    requiredUnit: "mt",
  }],
});

assert.equal(create.allowed, true, "CREATE_ORDER should be allowed.");

const missingSupplier = decideProcurementServerContract({
  action: "CREATE_ORDER",
  idempotencyKey: "proc:test:create:2",
  saleId: "sale:1",
  supplierOrderId: "order:2",
  lines: [{
    needId: "need:2",
    saleItemId: "item:2",
    stockItemId: "stock:2",
    supplierOrderLineId: "line:2",
    productionOrderId: "central-production:sale:1:item:2",
    allocationId: "supplier-allocation:sale:1:item:2:stock:2",
    purpose: "TAILOR_MATERIAL",
    requiredQuantity: 3,
    requiredUnit: "adet",
  }],
});

assert.equal(missingSupplier.allowed, false);
if (!missingSupplier.allowed) {
  assert.equal(
    missingSupplier.code,
    "PROCUREMENT_BATCH_REQUIRED_FIELDS_MISSING",
    "CREATE_ORDER must fail closed without supplier/order batch fields.",
  );
}

const missingProductionLink = decideProcurementServerContract({
  action: "CREATE_ORDER",
  idempotencyKey: "proc:test:create:3",
  saleId: "sale:1",
  supplierId: "supplier:1",
  supplierOrderId: "order:3",
  lines: [{
    needId: "need:3",
    saleItemId: "item:3",
    stockItemId: "stock:3",
    supplierOrderLineId: "line:3",
    requiredQuantity: 1,
    requiredUnit: "adet",
  }],
});

assert.equal(missingProductionLink.allowed, false);
if (!missingProductionLink.allowed) {
  assert.equal(
    missingProductionLink.code,
    "PROCUREMENT_BATCH_LINE_INVALID",
    "CREATE_ORDER must fail closed without production linkage.",
  );
}

const override = decideProcurementServerContract({
  action: "OVERRIDE_NO_ORDER",
  idempotencyKey: "proc:test:override:1",
  needId: "need:override:1",
  saleId: "sale:1",
  saleItemId: "item:1",
  stockItemId: "stock:1",
  requiredQuantity: 12,
  requiredUnit: "mt",
  reasonCode: "MANAGEMENT_DECISION",
  reasonText: "Approved exception.",
});

assert.equal(
  override.allowed,
  true,
  "OVERRIDE_NO_ORDER should allow explicit reason.",
);

const overrideWithoutReason = decideProcurementServerContract({
  action: "OVERRIDE_NO_ORDER",
  idempotencyKey: "proc:test:override:2",
  needId: "need:override:2",
  saleId: "sale:1",
  saleItemId: "item:1",
  stockItemId: "stock:1",
  requiredQuantity: 12,
  requiredUnit: "mt",
});

assert.equal(overrideWithoutReason.allowed, false);
if (!overrideWithoutReason.allowed) {
  assert.equal(
    overrideWithoutReason.code,
    "PROCUREMENT_OVERRIDE_REASON_REQUIRED",
  );
}

console.log("PAK: procurement server authority contract suite");