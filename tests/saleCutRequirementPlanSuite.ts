import assert from "node:assert/strict";
import type { Sale, SaleItem } from "../src/store/salesStore";
import { buildSaleCutRequirementPlan } from "../src/lib/saleCutRequirementPlan";

function detail(
  id: string,
  openingName: string,
  meters: number,
  stockItemId = "stock-bambu"
): SaleItem {
  return {
    id,
    measurementId: `measurement-${id}`,
    roomName: "Salon",
    windowName: openingName,
    productType: "Bambu Tül",
    productGroup: "0001 PERDE",
    stockItemId,
    width: 300,
    height: 260,
    calcWidth: 300,
    calcHeight: 260,
    quantity: 1,
    metricSize: meters,
    metricUnit: "mt",
    fabricMeters: meters,
    unitPrice: 0,
    discount: 0,
    rowTotal: 0
  };
}

function groupedItem(
  breakdown: SaleItem[],
  totalMeters = 20,
  stockItemId = "stock-bambu"
): SaleItem {
  return {
    id: "sale-item-salon-bambu",
    measurementId: breakdown.map(item => item.measurementId).join(","),
    roomName: "Salon",
    windowName: "Oda Toplamı",
    productType: "Bambu Tül",
    productGroup: "0001 PERDE",
    stockItemId,
    width: 0,
    height: 0,
    calcWidth: 0,
    calcHeight: 0,
    quantity: 1,
    metricSize: totalMeters,
    metricUnit: "mt",
    fabricMeters: totalMeters,
    productionBreakdown: breakdown,
    unitPrice: 100,
    discount: 0,
    rowTotal: 2000
  };
}

function sale(item: SaleItem): Sale {
  return {
    tenantId: "tenant-1",
    companyId: "company-1",
    branchId: "branch-1",
    accountingPeriodId: "period-1",
    id: "sale-1",
    saleNo: "SAT-0001",
    customerId: "customer-1",
    status: "ONAYLANDI",
    items: [item],
    priceSource: "STOCK",
    totalAmount: 2000,
    cashPrice: 2000,
    installmentPrice: 2000,
    discount: 0,
    downPayment: 0,
    remainingBalance: 2000,
    createdAt: "2026-08-02T12:00:00.000Z",
    updatedAt: "2026-08-02T12:00:00.000Z"
  };
}

const correct = buildSaleCutRequirementPlan(
  sale(
    groupedItem([
      detail("cam-1", "1. Cam", 12),
      detail("cam-2", "2. Cam", 8)
    ])
  )
);

assert.equal(correct.outcome, "READY");

if (correct.outcome === "READY") {
  assert.equal(correct.requirements.length, 1);
  assert.equal(correct.requirements[0].totalMeters, 20);
  assert.deepEqual(
    correct.requirements[0].pieces.map(piece => [
      piece.openingName,
      piece.requiredMeters
    ]),
    [
      ["1. Cam", 12],
      ["2. Cam", 8]
    ]
  );
}

const missingStock = buildSaleCutRequirementPlan(
  sale(
    groupedItem(
      [detail("cam-1", "1. Cam", 12, "")],
      12,
      ""
    )
  )
);

assert.equal(missingStock.outcome, "REJECTED");

const mismatch = buildSaleCutRequirementPlan(
  sale(
    groupedItem(
      [
        detail("cam-1", "1. Cam", 12, "stock-bambu"),
        detail("cam-2", "2. Cam", 8, "stock-baska")
      ],
      20,
      "stock-bambu"
    )
  )
);

assert.equal(mismatch.outcome, "REJECTED");

const wrongTotal = buildSaleCutRequirementPlan(
  sale(
    groupedItem(
      [
        detail("cam-1", "1. Cam", 12),
        detail("cam-2", "2. Cam", 7)
      ],
      20
    )
  )
);

assert.equal(wrongTotal.outcome, "REJECTED");

console.log("[PASS] saleShows20MetersOperationsKeep12Plus8");
console.log("[PASS] sameStockIdentityGroupedForCutting");
console.log("[PASS] missingStockIdentityFailsClosed");
console.log("[PASS] breakdownStockMismatchFailsClosed");
console.log("[PASS] aggregateBreakdownMismatchFailsClosed");
console.log("[PASS] saleCutRequirementPlanSuite completed");
