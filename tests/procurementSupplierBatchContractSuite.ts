import assert from "node:assert/strict";
import {
  decideProcurementServerContract,
} from "../src/lib/procurement/procurementServerContract";

function line(
  needId: string,
  saleItemId: string,
  stockItemId: string,
  supplierOrderLineId: string,
  requiredQuantity: number,
  requiredUnit: "mt" | "m2" | "adet",
) {
  return {
    needId,
    saleItemId,
    stockItemId,
    supplierOrderLineId,
    productionOrderId: `central-production:sale-1:${saleItemId}`,
    allocationId: `supplier-allocation:sale-1:${saleItemId}:${stockItemId}`,
    purpose: "TAILOR_MATERIAL" as const,
    requiredQuantity,
    requiredUnit,
  };
}

const valid = decideProcurementServerContract({
  action: "CREATE_ORDER",
  idempotencyKey: "supplier-order:sale-1:supplier-1",
  saleId: "sale-1",
  supplierId: "supplier-1",
  supplierOrderId: "order:sale-1:supplier-1",
  lines: [
    line("need-1", "item-1", "stock-1", "line-1", 12, "mt"),
    line("need-2", "item-2", "stock-2", "line-2", 3, "adet"),
  ],
});

assert.equal(valid.allowed, true);
if (valid.allowed) {
  assert.equal(valid.command.action, "CREATE_ORDER");
  if (valid.command.action === "CREATE_ORDER") {
    assert.equal(valid.command.lines.length, 2);
    assert.equal(
      valid.command.lines[0].productionOrderId,
      "central-production:sale-1:item-1",
    );
    assert.equal(
      valid.command.lines[0].purpose,
      "TAILOR_MATERIAL",
    );
  }
}

const duplicateNeed = decideProcurementServerContract({
  action: "CREATE_ORDER",
  idempotencyKey: "x",
  saleId: "sale-1",
  supplierId: "supplier-1",
  supplierOrderId: "order-1",
  lines: [
    line("need-1", "item-1", "stock-1", "line-1", 1, "adet"),
    line("need-1", "item-2", "stock-2", "line-2", 1, "adet"),
  ],
});

assert.equal(duplicateNeed.allowed, false);
if (!duplicateNeed.allowed) {
  assert.equal(
    duplicateNeed.code,
    "PROCUREMENT_BATCH_DUPLICATE_LINE",
  );
}

const empty = decideProcurementServerContract({
  action: "CREATE_ORDER",
  idempotencyKey: "x",
  saleId: "sale-1",
  supplierId: "supplier-1",
  supplierOrderId: "order-1",
  lines: [],
});
assert.equal(empty.allowed, false);

const override = decideProcurementServerContract({
  action: "OVERRIDE_NO_ORDER",
  idempotencyKey: "override-1",
  needId: "need-1",
  saleId: "sale-1",
  saleItemId: "item-1",
  stockItemId: "stock-1",
  requiredQuantity: 12,
  requiredUnit: "mt",
  reasonCode: "ADMIN_DECISION",
  reasonText: "Proceed without procurement.",
});
assert.equal(override.allowed, true);

console.log("PAK: procurement supplier batch contract suite");