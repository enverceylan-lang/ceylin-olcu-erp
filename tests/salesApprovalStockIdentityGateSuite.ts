import assert from "node:assert/strict";
import fs from "node:fs";
import type { SaleItem } from "../src/store/salesStore";
import {
  saleItemRequiresStockIdentity,
  validateSaleApprovalStockIdentity,
} from "../src/lib/saleApprovalStockIdentityGate";
import {
  shouldSyncMainOperationForSaleStatus,
} from "../src/lib/saleOperationEligibility";

function item(
  overrides: Partial<SaleItem> = {},
): SaleItem {
  return {
    id: "item-1",
    measurementId: "measurement-1",
    roomName: "Salon",
    windowName: "Pencere 1",
    productType: "Güneşlik",
    productGroup: "0001 PERDE",
    width: 300,
    height: 260,
    calcWidth: 300,
    calcHeight: 260,
    quantity: 1,
    metricSize: 3,
    metricUnit: "mt",
    unitPrice: 100,
    discount: 0,
    rowTotal: 300,
    ...overrides,
  };
}

const physicalMissing = item();
assert.equal(
  saleItemRequiresStockIdentity(physicalMissing),
  true,
);
assert.equal(
  validateSaleApprovalStockIdentity([physicalMissing]).allowed,
  false,
);

const physicalReady = item({ stockItemId: "stock-1" });
assert.equal(
  validateSaleApprovalStockIdentity([physicalReady]).allowed,
  true,
);

const serviceWithoutStock = item({
  id: "service-1",
  measurementId: undefined,
  productType: "Montaj Hizmeti",
  productGroup: "0003 HİZMET",
  stockItemId: undefined,
  metricUnit: "adet",
});
assert.equal(
  saleItemRequiresStockIdentity(serviceWithoutStock),
  false,
);
assert.equal(
  validateSaleApprovalStockIdentity([serviceWithoutStock]).allowed,
  true,
);

const unknownWithoutStock = item({
  id: "unknown-1",
  productGroup: "BİLİNMEYEN",
  stockItemId: undefined,
});
assert.equal(
  validateSaleApprovalStockIdentity([unknownWithoutStock]).allowed,
  false,
  "Unknown non-service groups must fail closed.",
);

assert.equal(
  shouldSyncMainOperationForSaleStatus("TASLAK"),
  false,
);
assert.equal(
  shouldSyncMainOperationForSaleStatus("TEKLİF"),
  false,
);
assert.equal(
  shouldSyncMainOperationForSaleStatus("ONAYLANDI"),
  true,
);

const listPage = fs.readFileSync(
  "src/app/satis/page.tsx",
  "utf8",
);
const detailPage = fs.readFileSync(
  "src/app/satis/[id]/page.tsx",
  "utf8",
);

assert.match(
  listPage,
  /validateSaleApprovalStockIdentity\(\s*sale\.items,\s*\)[\s\S]*approveSaleServerAuthority/,
  "List approval must validate stock identity before server approval.",
);
assert.match(
  detailPage,
  /validateSaleApprovalStockIdentity\(\s*updatedSale\.items,\s*\)[\s\S]*persistDraftSaleServerAuthority[\s\S]*approveSaleServerAuthority/,
  "Detail/admin direct approval must validate stock identity before persist/approve authority calls.",
);

console.log("PAK: sales approval stock identity gate + unapproved operations lock");
