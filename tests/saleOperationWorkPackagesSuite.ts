import assert from "node:assert/strict";
import type {
  Sale,
  SaleItem
} from "../src/store/salesStore";
import {
  buildSaleOperationWorkPackages,
  getSaleOperationWorkPackage
} from "../src/lib/saleOperationWorkPackages";

function item(
  id: string,
  productGroup: string,
  productType: string
): SaleItem {
  return {
    id,
    roomName: "Salon",
    windowName: "Cephe",
    productType,
    productGroup,
    width: 300,
    height: 260,
    calcWidth: 300,
    calcHeight: 260,
    quantity: 1,
    metricSize: 3,
    metricUnit: "mt",
    unitPrice: 100,
    discount: 0,
    rowTotal: 300
  };
}

function sale(
  items: SaleItem[]
): Sale {
  return {
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

const mixed =
  buildSaleOperationWorkPackages(
    sale([
      item(
        "curtain",
        "0001 PERDE",
        "Tül"
      ),
      item(
        "mechanical",
        "0002 MEKANİK PERDE",
        "Plicell"
      ),
      item(
        "service",
        "0003 HİZMET",
        "Montaj Hizmeti"
      )
    ])
  );

assert.equal(
  mixed.hasMixedOperationalRoutes,
  true
);

assert.deepEqual(
  getSaleOperationWorkPackage(
    sale([
      item(
        "curtain",
        "0001 PERDE",
        "Tül"
      ),
      item(
        "mechanical",
        "0002 MEKANİK PERDE",
        "Plicell"
      )
    ]),
    "TAILOR_MATERIAL"
  )?.itemIds,
  ["curtain"]
);

assert.deepEqual(
  getSaleOperationWorkPackage(
    sale([
      item(
        "curtain",
        "0001 PERDE",
        "Tül"
      ),
      item(
        "mechanical",
        "0002 MEKANİK PERDE",
        "Plicell"
      )
    ]),
    "SUPPLIER_MECHANICAL"
  )?.itemIds,
  ["mechanical"]
);

assert.equal(
  getSaleOperationWorkPackage(
    sale([
      item(
        "curtain",
        "0001 PERDE",
        "Tül"
      )
    ]),
    "TAILOR_MATERIAL"
  )?.requiresMaterialSourceDecision,
  true
);

const serviceOnly =
  buildSaleOperationWorkPackages(
    sale([
      item(
        "service",
        "0003 HİZMET",
        "Montaj"
      )
    ])
  );

assert.equal(
  serviceOnly.hasMixedOperationalRoutes,
  false
);

assert.deepEqual(
  serviceOnly.packages.map(
    workPackage =>
      workPackage.kind
  ),
  ["SERVICE"]
);

const blocked =
  buildSaleOperationWorkPackages(
    sale([
      item(
        "accessory",
        "0004 AKSESUAR",
        "Rustik"
      ),
      item(
        "unknown",
        "DİĞER",
        "Bilinmeyen"
      )
    ])
  );

assert.equal(
  blocked.hasBlockingReview,
  true
);

console.log(
  "[PASS] mixedSaleItemsSplitByOperationalRoute"
);
console.log(
  "[PASS] tailorPackageRequiresMaterialSource"
);
console.log(
  "[PASS] serviceDoesNotPolluteOperationalPackage"
);
console.log(
  "[PASS] accessoryAndUnknownFailClosed"
);
console.log(
  "[PASS] saleOperationWorkPackagesSuite completed"
);