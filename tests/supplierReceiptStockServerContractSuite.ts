import assert from "node:assert/strict";

import {
  decideSupplierReceiptStockServerContract
} from "../src/lib/supplierReceiptStockServerContract";

function valid() {
  return {
    action: "RECEIVE_SUPPLIER_ORDER",
    receiptId: "receipt-1",
    idempotencyKey: "receipt-idem-1",
    supplierOrderId: "order-1",
    supplierOrderLineId: "order-line-1",
    allocationId: "allocation-1",
    stockItemId: "stock-1",
    receivedQuantity: 2.5,
    receivedUnit: "mt",
    receivedAt: "2026-08-25T00:00:00.000Z"
  };
}

function main() {
  const accepted =
    decideSupplierReceiptStockServerContract(
      valid()
    );

  assert.equal(
    accepted.allowed,
    true
  );

  for (
    const unit of
      ["mt","m2","adet"] as const
  ) {
    const result =
      decideSupplierReceiptStockServerContract({
        ...valid(),
        receivedUnit: unit
      });

    assert.equal(
      result.allowed,
      true
    );
  }

  assert.equal(
    decideSupplierReceiptStockServerContract({
      ...valid(),
      receivedQuantity: 0
    }).allowed,
    false
  );

  assert.equal(
    decideSupplierReceiptStockServerContract({
      ...valid(),
      receivedUnit: "kg"
    }).allowed,
    false
  );

  assert.equal(
    decideSupplierReceiptStockServerContract({
      ...valid(),
      action: "CREATE_ORDER"
    }).allowed,
    false
  );

  console.log(
    "supplierReceiptStockServerContractSuite: PASS"
  );
}

main();