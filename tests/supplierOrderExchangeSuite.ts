import assert from "node:assert/strict";
import {
  formatSupplierOrderForWhatsApp,
  validateSupplierOrderExchange,
  type SupplierOrderExchange
} from "../src/lib/supplierOrderExchange";

const order:
  SupplierOrderExchange = {
    id: "supplier-exchange:PO-1",
    idempotencyKey:
      "SUPPLIER_EXCHANGE:PO-1",
    sourceTenantId:
      "tenant-ceylin",
    sourceCompanyId:
      "company-ceylin",
    supplierId:
      "supplier-1",
    sourcePurchaseOrderId:
      "PO-1",
    sourceSaleId:
      "SALE-1",
    status: "DRAFT",
    instructions: [
      {
        kind: "CUT_LENGTH",
        id: "cut-1",
        stockItemId:
          "stock-bambu",
        productType:
          "Bambu Tül",
        saleItemId:
          "detail-cut-1",
        parentSaleItemId:
          "parent-cut",
        supplierOrderId:
          "supplier-order-cut-1",
        lengthMeters: 12,
        splitAllowed: false,
        sequence: 1
      },
      {
        kind: "CUT_LENGTH",
        id: "cut-2",
        stockItemId:
          "stock-bambu",
        productType:
          "Bambu Tül",
        saleItemId:
          "detail-cut-2",
        parentSaleItemId:
          "parent-cut",
        supplierOrderId:
          "supplier-order-cut-2",
        lengthMeters: 8,
        splitAllowed: true,
        sequence: 2
      },
      {
        kind:
          "MANUFACTURE_SIZE",
        id: "mechanical-1",
        stockItemId:
          "stock-stor",
        productType:
          "Stor Perde",
        widthCm: 180,
        heightCm: 250,
        quantity: 2,
        sequence: 3
      }
    ],
    createdAt:
      "2026-08-02T14:00:00.000Z",
    updatedAt:
      "2026-08-02T14:00:00.000Z"
  };

assert.deepEqual(
  validateSupplierOrderExchange(
    order
  ),
  []
);

const whatsapp =
  formatSupplierOrderForWhatsApp(
    order,
    "Örnek Tedarikçi"
  );

assert.match(
  whatsapp,
  /12 mt — tek parça/
);

assert.match(
  whatsapp,
  /8 mt — parçalı olabilir/
);

assert.match(
  whatsapp,
  /180x250 cm — 2 adet/
);

const linkedOrder = {
  ...order,
  targetTenantId:
    "tenant-supplier",
  targetCompanyId:
    "company-supplier"
};

assert.deepEqual(
  validateSupplierOrderExchange(
    linkedOrder
  ),
  []
);

console.log(
  "[PASS] whatsappSupplierOrderCarriesCutPieces"
);
console.log(
  "[PASS] mechanicalManufactureInstructionSupported"
);
console.log(
  "[PASS] integratedSupplierIdentityOptional"
);
console.log(
  "[PASS] supplierOrderExchangeSuite completed"
);