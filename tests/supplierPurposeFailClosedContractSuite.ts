import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  decideSupplierOrder,
  decideSupplierReceipt,
  type SupplierOrder,
  type SupplierOrderRequest,
  type SupplierReceiptRequest
} from "../src/lib/supplierSupplyFlow";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1"
};

function validOrderRequest(): SupplierOrderRequest {
  return {
    ...scope,
    id: "supplier-order-purpose-1",
    idempotencyKey: "SUPPLIER_ORDER_PURPOSE:1",
    allocationId: "allocation-purpose-1",
    supplierId: "supplier-1",
    purchaseOrderId: "purchase-1",
    saleId: "sale-1",
    saleItemId: "sale-item-1",
    productionOrderId: "production-1",
    stockItemId: "stock-1",
    orderedQuantity: 4,
    purpose: "TAILOR_MATERIAL",
    createdByUserId: "admin-1",
    createdAt: "2026-08-10T13:00:00.000Z"
  };
}

test("supplier order creation rejects missing business purpose at runtime", () => {
  const legacy = {
    ...validOrderRequest(),
    purpose: undefined
  } as unknown as SupplierOrderRequest;

  assert.deepEqual(
    decideSupplierOrder(legacy, []),
    {
      outcome: "REJECT",
      reason: "INVALID_REQUEST"
    }
  );
});

test("supplier receipt rejects legacy order with missing business purpose", () => {
  const legacyOrder = {
    ...validOrderRequest(),
    status: "WAITING_SUPPLIER",
    receivedQuantity: 0,
    purpose: undefined
  } as unknown as SupplierOrder;

  const receipt: SupplierReceiptRequest = {
    ...scope,
    id: "receipt-purpose-1",
    idempotencyKey: "RECEIPT_PURPOSE:1",
    supplierOrderId: legacyOrder.id,
    receivedQuantity: 4,
    receivedByUserId: "admin-1",
    receivedAt: "2026-08-10T13:05:00.000Z"
  };

  assert.deepEqual(
    decideSupplierReceipt(
      receipt,
      [],
      legacyOrder
    ),
    {
      outcome: "REJECT",
      reason: "INVALID_REQUEST"
    }
  );
});

test("supplier purpose boundaries contain no TAILOR_MATERIAL fallback", async () => {
  const paths = [
    "src/lib/supplierSupplyFlow.ts",
    "src/lib/supplierReceiptProductionCoordinator.ts",
    "src/lib/mechanicalSupplierReceiptInstallationCoordinator.ts",
    "src/components/operations/MaterialCutDecisionPanel.tsx"
  ];

  for (const path of paths) {
    const source = await readFile(path, "utf8");
    assert.doesNotMatch(
      source,
      /purpose\s*(?:\?\?|\|\|)\s*"TAILOR_MATERIAL"/
    );
  }
});