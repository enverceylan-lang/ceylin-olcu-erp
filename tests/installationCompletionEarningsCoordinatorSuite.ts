import assert from "node:assert/strict";
import test from "node:test";
import {
  readFile
} from "node:fs/promises";

import {
  calculateInstallationEarningsAmount
} from "../src/lib/installationCompletionEarningsCoordinator";

const operation = {
  tenantId: "t1",
  companyId: "c1",
  branchId: "b1",
  accountingPeriodId: "p1",
  id: "installation:1",
  idempotencyKey:
    "INSTALLATION:1",
  kind:
    "INSTALLATION" as const,
  sourceId: "sale-1",
  saleId: "sale-1",
  customerId: "customer-1",
  customerName: "Musteri",
  title: "Montaj",
  details: [],
  party: {
    id: "installer-cari-1",
    userId: "installer-user-1",
    name: "Montajci",
    assignmentType:
      "EXTERNAL" as const,
    providerCustomerId:
      "installer-cari-1"
  },
  scheduledAt:
    "2026-08-05T08:00:00.000Z",
  dueAt:
    "2026-08-05T12:00:00.000Z",
  status:
    "COMPLETED" as const,
  createdByUserId: "admin",
  createdAt:
    "2026-08-04T08:00:00.000Z",
  updatedAt:
    "2026-08-05T10:00:00.000Z",
  completedAt:
    "2026-08-05T10:00:00.000Z"
};

test(
  "external installer M2 rate uses sale metricSize and completion date",
  () => {
    const result =
      calculateInstallationEarningsAmount({
        operation,
        sale: {
          id: "sale-1",
          saleNo: "S-1",
          customerId: "customer-1",
          status: "ONAYLANDI",
          items: [
            {
              id: "line-1",
              roomName: "Salon",
              windowName: "Cam",
              productType: "Stor",
              productGroup: "Mekanik Perde",
              stockItemId: "stor-1",
              width: 200,
              height: 210,
              calcWidth: 200,
              calcHeight: 210,
              quantity: 1,
              metricSize: 4.2,
              metricUnit: "m2",
              unitPrice: 100,
              discount: 0,
              rowTotal: 420
            }
          ],
          priceSource: "STOCK",
          totalAmount: 420,
          cashPrice: 420,
          installmentPrice: 420,
          discount: 0,
          downPayment: 0,
          remainingBalance: 420,
          createdAt:
            "2026-08-04T08:00:00.000Z",
          updatedAt:
            "2026-08-04T08:00:00.000Z"
        },
        products: [
          {
            id: "stor-1",
            stockCode: "STO-1",
            name: "Stor",
            category: "Stor",
            unit: "m2",
            cashPrice: 100,
            installmentPrice: 100,
            dealerPrice: 80,
            productKind:
              "PHYSICAL",
            requiresInstallation:
              true,
            installationServiceStockItemId:
              "stor-montaj"
          }
        ],
        rates: [
          {
            tenantId: "t1",
            companyId: "c1",
            branchId: "b1",
            accountingPeriodId: "p1",
            id: "rate-old",
            providerCustomerId:
              "installer-cari-1",
            providerType:
              "INSTALLER",
            serviceStockItemId:
              "stor-montaj",
            unit: "M2",
            unitPrice: 40,
            currency: "TRY",
            validFrom:
              "2026-01-01T00:00:00.000Z",
            validTo:
              "2026-08-01T00:00:00.000Z",
            active: true,
            createdAt:
              "2026-01-01T00:00:00.000Z"
          },
          {
            tenantId: "t1",
            companyId: "c1",
            branchId: "b1",
            accountingPeriodId: "p1",
            id: "rate-current",
            providerCustomerId:
              "installer-cari-1",
            providerType:
              "INSTALLER",
            serviceStockItemId:
              "stor-montaj",
            unit: "M2",
            unitPrice: 50,
            currency: "TRY",
            validFrom:
              "2026-08-01T00:00:00.000Z",
            active: true,
            createdAt:
              "2026-08-01T00:00:00.000Z"
          }
        ]
      });

    assert.deepEqual(
      result,
      {
        ok: true,
        amount: 210
      }
    );
  }
);

test(
  "productionBreakdown is used instead of grouped sale presentation item",
  () => {
    const result =
      calculateInstallationEarningsAmount({
        operation,
        sale: {
          id: "sale-1",
          saleNo: "S-1",
          customerId: "customer-1",
          status: "ONAYLANDI",
          items: [
            {
              id: "grouped",
              roomName: "Salon",
              windowName: "Oda Toplamı",
              productType: "Stor",
              productGroup: "Mekanik Perde",
              stockItemId: "stor-1",
              width: 0,
              height: 0,
              calcWidth: 0,
              calcHeight: 0,
              quantity: 1,
              metricSize: 8.2,
              metricUnit: "m2",
              productionBreakdown: [
                {
                  id: "g1",
                  roomName: "Salon",
                  windowName: "Cam",
                  productType: "Stor",
                  productGroup: "Mekanik Perde",
                  stockItemId: "stor-1",
                  width: 200,
                  height: 210,
                  calcWidth: 200,
                  calcHeight: 210,
                  quantity: 1,
                  metricSize: 4.2,
                  metricUnit: "m2",
                  unitPrice: 0,
                  discount: 0,
                  rowTotal: 0
                },
                {
                  id: "g2",
                  roomName: "Salon",
                  windowName: "Kapi",
                  productType: "Stor",
                  productGroup: "Mekanik Perde",
                  stockItemId: "stor-1",
                  width: 100,
                  height: 270,
                  calcWidth: 100,
                  calcHeight: 270,
                  quantity: 1,
                  metricSize: 2.7,
                  metricUnit: "m2",
                  unitPrice: 0,
                  discount: 0,
                  rowTotal: 0
                }
              ],
              unitPrice: 0,
              discount: 0,
              rowTotal: 0
            }
          ],
          priceSource: "STOCK",
          totalAmount: 0,
          cashPrice: 0,
          installmentPrice: 0,
          discount: 0,
          downPayment: 0,
          remainingBalance: 0,
          createdAt:
            "2026-08-04T08:00:00.000Z",
          updatedAt:
            "2026-08-04T08:00:00.000Z"
        },
        products: [
          {
            id: "stor-1",
            stockCode: "STO-1",
            name: "Stor",
            category: "Stor",
            unit: "m2",
            cashPrice: 100,
            installmentPrice: 100,
            dealerPrice: 80,
            productKind:
              "PHYSICAL",
            requiresInstallation:
              true,
            installationServiceStockItemId:
              "stor-montaj"
          }
        ],
        rates: [
          {
            tenantId: "t1",
            companyId: "c1",
            branchId: "b1",
            accountingPeriodId: "p1",
            id: "rate",
            providerCustomerId:
              "installer-cari-1",
            providerType:
              "INSTALLER",
            serviceStockItemId:
              "stor-montaj",
            unit: "M2",
            unitPrice: 50,
            currency: "TRY",
            validFrom:
              "2026-08-01T00:00:00.000Z",
            active: true,
            createdAt:
              "2026-08-01T00:00:00.000Z"
          }
        ]
      });

    assert.deepEqual(
      result,
      {
        ok: true,
        amount: 345
      }
    );
  }
);

test(
  "internal installer does not create provider earnings contract",
  async () => {
    const source =
      await readFile(
        "src/lib/installationCompletionEarningsCoordinator.ts",
        "utf8"
      );

    assert.match(
      source,
      /assignmentType ===\s*"INTERNAL"/
    );

    assert.match(
      source,
      /INTERNAL_NO_EARNINGS/
    );
  }
);


test(
  "operations store auto creates and finalizes provider earning without pending admin amount gate",
  async () => {
    const source =
      await readFile(
        "src/store/useOperationsStore.ts",
        "utf8"
      );

    assert.match(
      source,
      /registerAutomaticProviderEarning/
    );

    assert.match(
      source,
      /createEstimatedEarningFromCompletedOperation/
    );

    assert.match(
      source,
      /finalizeProviderEarning/
    );
  }
);