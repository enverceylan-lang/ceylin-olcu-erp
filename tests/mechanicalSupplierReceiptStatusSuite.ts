import assert from "node:assert/strict";
import test from "node:test";

import {
  decideSupplierReceipt,
  type SupplierOrder,
  type SupplierReceiptRequest
} from "../src/lib/supplierSupplyFlow";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1"
};

function order(
  purpose:
    | "TAILOR_MATERIAL"
    | "MECHANICAL_PRODUCT"
): SupplierOrder {
  return {
    ...scope,
    id: `order-${purpose}`,
    idempotencyKey:
      `idem-${purpose}`,
    allocationId:
      `allocation-${purpose}`,
    supplierId: "supplier-1",
    purchaseOrderId:
      `purchase-${purpose}`,
    saleId: "sale-1",
    saleItemId:
      `sale-item-${purpose}`,
    productionOrderId:
      `production-${purpose}`,
    stockItemId:
      `stock-${purpose}`,
    orderedQuantity: 4,
    orderedUnit:
      purpose === "MECHANICAL_PRODUCT"
        ? "m2"
        : "mt",
    purpose,
    createdByUserId: "admin",
    createdAt:
      "2026-08-04T20:00:00.000Z",
    status: "WAITING_SUPPLIER",
    receivedQuantity: 0
  };
}

function receipt(
  supplierOrderId: string,
  quantity: number
): SupplierReceiptRequest {
  return {
    ...scope,
    id:
      `receipt-${supplierOrderId}-${quantity}`,
    idempotencyKey:
      `receipt-idem-${supplierOrderId}-${quantity}`,
    supplierOrderId,
    receivedQuantity: quantity,
    receivedByUserId: "admin",
    receivedAt:
      "2026-08-04T21:00:00.000Z"
  };
}

test(
  "tailor material full receipt stays READY_FOR_TAILOR",
  () => {
    const source = order(
      "TAILOR_MATERIAL"
    );

    const result =
      decideSupplierReceipt(
        receipt(source.id, 4),
        [],
        source
      );

    assert.equal(
      result.outcome,
      "CREATE"
    );

    if (result.outcome !== "CREATE") {
      throw new Error(
        "Expected CREATE"
      );
    }

    assert.equal(
      result.order.status,
      "READY_FOR_TAILOR"
    );

    assert.equal(
      result.receipt.orderStatus,
      "READY_FOR_TAILOR"
    );
  }
);

test(
  "mechanical product full receipt becomes READY_FOR_OPERATION",
  () => {
    const source = order(
      "MECHANICAL_PRODUCT"
    );

    const result =
      decideSupplierReceipt(
        receipt(source.id, 4),
        [],
        source
      );

    assert.equal(
      result.outcome,
      "CREATE"
    );

    if (result.outcome !== "CREATE") {
      throw new Error(
        "Expected CREATE"
      );
    }

    assert.equal(
      result.order.status,
      "READY_FOR_OPERATION"
    );

    assert.equal(
      result.receipt.orderStatus,
      "READY_FOR_OPERATION"
    );
  }
);

test(
  "mechanical partial receipt stays PARTIALLY_RECEIVED",
  () => {
    const source = order(
      "MECHANICAL_PRODUCT"
    );

    const result =
      decideSupplierReceipt(
        receipt(source.id, 2),
        [],
        source
      );

    assert.equal(
      result.outcome,
      "CREATE"
    );

    if (result.outcome !== "CREATE") {
      throw new Error(
        "Expected CREATE"
      );
    }

    assert.equal(
      result.order.status,
      "PARTIALLY_RECEIVED"
    );
  }
);

test(
  "ready mechanical order rejects another receipt",
  () => {
    const source: SupplierOrder = {
      ...order("MECHANICAL_PRODUCT"),
      status:
        "READY_FOR_OPERATION",
      receivedQuantity: 4
    };

    const result =
      decideSupplierReceipt(
        receipt(source.id, 1),
        [],
        source
      );

    assert.deepEqual(
      result,
      {
        outcome: "REJECT",
        reason:
          "ORDER_ALREADY_READY"
      }
    );
  }
);