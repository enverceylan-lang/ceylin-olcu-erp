import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const page = fs.readFileSync(
  path.join(root, "src/app/stok/page.tsx"),
  "utf8",
);
const panel = fs.readFileSync(
  path.join(
    root,
    "src/components/stock/StockV2BottomFinishPanel.tsx",
  ),
  "utf8",
);

assert.match(page, /useStockV2Store/);
assert.match(page, /buildStockV2Profile/);
assert.match(page, /stockV2Family/);
assert.match(
  page,
  /Aktif şirket \/ şube \/ dönem kapsamı bulunamadı/,
);

assert.match(
  page,
  /purchaseVatRate:\s*""/,
  "Yeni stok kartında alış KDV varsayılanı boş olmalıdır.",
);

assert.match(panel, /Etek Modeli/);
assert.match(panel, /Etek Lazer/);
assert.doesNotMatch(panel, /Sutaşı|Sütaşı/i);
assert.match(panel, /HEM_MODEL/);
assert.match(panel, /HEM_LASER/);
assert.match(panel, /ST 01 \/ LZ 01/);
assert.match(panel, /EN üzerinden mt/);
assert.match(panel, /Alan üzerinden m²/);

assert.doesNotMatch(
  panel,
  /jumboEnabled|jumboThresholdCm|jumboPricingMode/,
);

console.log(
  "PAK_STOCK_V2_A2_1_PROFILE_WIRING",
);
