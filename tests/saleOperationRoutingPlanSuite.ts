import assert from "node:assert/strict";
import type {
  Sale,
  SaleItem
} from "../src/store/salesStore";
import {
  buildSaleOperationRoutingPlan,
  decideSaleItemOperationRoute
} from "../src/lib/saleOperationRoutingPlan";

function item(
  overrides:
    Partial<SaleItem> = {}
): SaleItem {
  return {
    id: "item-1",
    roomName: "Salon",
    windowName: "Cephe",
    productType: "Tül",
    productGroup: "0001 PERDE",
    width: 300,
    height: 260,
    calcWidth: 300,
    calcHeight: 260,
    quantity: 1,
    metricSize: 7.8,
    metricUnit: "mt",
    unitPrice: 100,
    discount: 0,
    rowTotal: 780,
    ...overrides
  };
}

function sale(
  items: SaleItem[]
): Sale {
  return {
    tenantId: "tenant-1",
    companyId: "company-1",
    branchId: "branch-1",
    accountingPeriodId: "period-1",
    id: "sale-1",
    saleNo: "SAT-0001",
    customerId: "customer-1",
    status: "ONAYLANDI",
    items,
    priceSource: "MANUAL",
    totalAmount: 1000,
    cashPrice: 1000,
    installmentPrice: 1000,
    discount: 0,
    downPayment: 0,
    remainingBalance: 1000,
    createdAt:
      "2026-08-02T01:00:00.000Z",
    updatedAt:
      "2026-08-02T01:00:00.000Z"
  };
}

const curtain =
  decideSaleItemOperationRoute(
    item()
  );

assert.equal(
  curtain.route,
  "TAILOR_AND_MATERIAL_SOURCE"
);
assert.equal(
  curtain.requiresTailor,
  true
);
assert.equal(
  curtain.requiresMaterialSourceDecision,
  true
);
console.log(
  "[PASS] curtainRequiresTailorAndMaterialSource"
);

const mechanical =
  decideSaleItemOperationRoute(
    item({
      productGroup:
        "0002 MEKANİK PERDE",
      productType: "Plicell"
    })
  );

assert.equal(
  mechanical.route,
  "SUPPLIER_MECHANICAL"
);
assert.equal(
  mechanical.requiresSupplier,
  true
);
assert.equal(
  mechanical.requiresTailor,
  false
);
console.log(
  "[PASS] mechanicalSupplierNeverTailor"
);

const mechanicalLegacyName =
  decideSaleItemOperationRoute(
    item({
      productGroup:
        "Mekanik Perde",
      productType: "Stor"
    })
  );

assert.equal(
  mechanicalLegacyName.route,
  "SUPPLIER_MECHANICAL"
);
console.log(
  "[PASS] mechanicalLegacyNameSupplier"
);

const service =
  decideSaleItemOperationRoute(
    item({
      productGroup:
        "0003 HİZMET",
      productType: "Montaj Hizmeti",
      metricUnit: "adet"
    })
  );

assert.equal(
  service.route,
  "SERVICE_ONLY"
);
assert.equal(
  service.requiresSupplier,
  false
);
assert.equal(
  service.requiresTailor,
  false
);
console.log(
  "[PASS] serviceDoesNotEnterStockOrTailor"
);

const accessory =
  decideSaleItemOperationRoute(
    item({
      productGroup:
        "0004 AKSESUAR",
      productType: "Rustik"
    })
  );

assert.equal(
  accessory.route,
  "ACCESSORY_POLICY_REQUIRED"
);
assert.equal(
  accessory.requiresMaterialSourceDecision,
  true
);
console.log(
  "[PASS] accessoryRequiresInventoryPolicy"
);

const unknown =
  decideSaleItemOperationRoute(
    item({
      productGroup: "DİĞER",
      productType: "Bilinmeyen"
    })
  );

assert.equal(
  unknown.route,
  "MANUAL_REVIEW"
);
console.log(
  "[PASS] unknownFailsClosedToManualReview"
);

const mixedPlan =
  buildSaleOperationRoutingPlan(
    sale([
      item({
        id: "curtain"
      }),
      item({
        id: "mechanical",
        productGroup:
          "0002 MEKANİK PERDE",
        productType: "Zebra"
      }),
      item({
        id: "service",
        productGroup:
          "0003 HİZMET",
        productType: "Montaj"
      })
    ])
  );

assert.equal(
  mixedPlan.requiresTailor,
  true
);
assert.equal(
  mixedPlan.requiresSupplier,
  true
);
assert.equal(
  mixedPlan.requiresMaterialSourceDecision,
  true
);
assert.equal(
  mixedPlan.requiresManualReview,
  false
);

console.log(
  "[PASS] mixedSaleRoutingPlan"
);

console.log(
  "[PASS] saleOperationRoutingPlanSuite completed"
);
