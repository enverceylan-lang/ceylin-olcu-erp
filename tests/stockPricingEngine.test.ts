import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateCurrentStockAveragePurchasePrice,
  calculateSalePriceSummary,
  calculateSuggestedSalePrice,
} from "../src/lib/stockPricingEngine";

test(
  "elde kalan stok miktarina gore agirlikli ortalama alis hesaplar",
  () => {
    const result =
      calculateCurrentStockAveragePurchasePrice(
        [
          {
            stockItemId: "BAMBU",
            onHandMeters: 50,
            purchaseUnitCost: 120,
            receivedAt: "2026-01-01T00:00:00.000Z",
          },
          {
            stockItemId: "BAMBU",
            onHandMeters: 100,
            purchaseUnitCost: 180,
            receivedAt: "2026-02-01T00:00:00.000Z",
          },
        ],
        "BAMBU",
      );

    assert.equal(result.quantity, 150);
    assert.equal(
      result.averageUnitCost,
      160,
    );
    assert.equal(result.lastUnitCost, 180);
  },
);

test(
  "tukenmis eski lot bugunku ortalama alisi bozmaz",
  () => {
    const result =
      calculateCurrentStockAveragePurchasePrice(
        [
          {
            stockItemId: "BAMBU",
            onHandMeters: 0,
            purchaseUnitCost: 10,
          },
          {
            stockItemId: "BAMBU",
            onHandMeters: 100,
            purchaseUnitCost: 180,
            receivedAt: "2026-02-01T00:00:00.000Z",
          },
        ],
        "BAMBU",
      );

    assert.equal(result.quantity, 100);
    assert.equal(
      result.averageUnitCost,
      180,
    );
  },
);

test(
  "elde maliyeti bilinmeyen stok varsa sahte ortalama uretmez",
  () => {
    const result =
      calculateCurrentStockAveragePurchasePrice(
        [
          {
            stockItemId: "BAMBU",
            onHandMeters: 50,
            purchaseUnitCost: 120,
            receivedAt: "2026-01-01T00:00:00.000Z",
          },
          {
            stockItemId: "BAMBU",
            onHandMeters: 100,
          },
        ],
        "BAMBU",
      );

    assert.equal(
      result.averageUnitCost,
      null,
    );
  },
);

test(
  "satis ortalamasi miktar agirlikli ve son satis tarih bazlidir",
  () => {
    const result =
      calculateSalePriceSummary(
        [
          {
            stockItemId: "BAMBU",
            quantity: 10,
            unitPrice: 250,
            occurredAt:
              "2026-01-01T10:00:00.000Z",
          },
          {
            stockItemId: "BAMBU",
            quantity: 30,
            unitPrice: 300,
            occurredAt:
              "2026-02-01T10:00:00.000Z",
          },
        ],
        "BAMBU",
      );

    assert.equal(result.quantity, 40);
    assert.equal(
      result.averageUnitPrice,
      287.5,
    );
    assert.equal(
      result.lastUnitPrice,
      300,
    );
  },
);

test(
  "100 alis + 70 hizmet + 70 gider ve yuzde 30 kar = 312 satis",
  () => {
    const result =
      calculateSuggestedSalePrice({
        averagePurchaseCost: 100,
        serviceCost: 70,
        overheadAmount: 70,
        targetProfitRate: 30,
      });

    assert.equal(result.baseCost, 240);
    assert.equal(
      result.suggestedSalePrice,
      312,
    );
  },
);