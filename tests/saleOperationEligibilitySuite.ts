import assert from "node:assert/strict";
import {
  shouldSyncMainOperationForSaleStatus
} from "../src/lib/saleOperationEligibility";

assert.equal(
  shouldSyncMainOperationForSaleStatus("TASLAK"),
  false,
  "Taslak satış operasyona çıkmamalı"
);

assert.equal(
  shouldSyncMainOperationForSaleStatus("TEKLİF"),
  false,
  "Teklif satış operasyona çıkmamalı"
);

assert.equal(
  shouldSyncMainOperationForSaleStatus("İPTAL"),
  false,
  "İptal satış operasyona çıkmamalı"
);

assert.equal(
  shouldSyncMainOperationForSaleStatus("ONAYLANDI"),
  true,
  "Onaylanan satış GENERAL operasyona çıkmalı"
);

assert.equal(
  shouldSyncMainOperationForSaleStatus("SİPARİŞ"),
  true,
  "Sipariş satış GENERAL operasyonda kalmalı/güncellenebilmeli"
);

assert.equal(
  shouldSyncMainOperationForSaleStatus(
    "ÜRETİME_GÖNDERİLDİ"
  ),
  true,
  "Üretime gönderilen satış GENERAL operasyonda kalmalı"
);

assert.equal(
  shouldSyncMainOperationForSaleStatus(
    "MONTAJA_GÖNDERİLDİ"
  ),
  true,
  "Montaja gönderilen satış GENERAL operasyonda kalmalı"
);

assert.equal(
  shouldSyncMainOperationForSaleStatus("TAMAMLANDI"),
  true,
  "Tamamlanan legacy satış GENERAL operasyon kaydını koruyabilmeli"
);

console.log(
  "[PASS] saleOperationEligibilitySuite completed"
);