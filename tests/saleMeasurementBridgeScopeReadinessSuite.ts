import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const cari = read("src/app/cariler/[id]/page.tsx");
const salesAdapter = read("src/lib/salesAdapter.ts");
const newSale = read("src/app/satis/yeni/page.tsx");

assert.match(
  cari,
  /loading:\s*scopeLoading[\s\S]*error:\s*scopeError[\s\S]*useErpRuntimeContext\(\)/,
  "Cari/ölçü ekranı canonical ERP runtime loading/error durumunu okumalıdır."
);

const transferHandler = cari.match(
  /const handleTransferToSales = async \(\) => \{([\s\S]*?)\n\s*\};/
)?.[1] ?? "";

assert.match(
  transferHandler,
  /if\s*\(scopeLoading\)[\s\S]*return;/,
  "Ölçü -> yeni satış, scope yüklenirken başlamamalıdır."
);

assert.match(
  transferHandler,
  /if\s*\(scopeError \|\| !scope\)[\s\S]*return;/,
  "Ölçü -> yeni satış, scope hata/yok durumunda fail-closed olmalıdır."
);

assert.ok(
  transferHandler.indexOf("if (scopeLoading)") <
    transferHandler.indexOf("syncOrCreateDraftSale"),
  "Scope readiness guard, satış taslağı oluşturmadan önce çalışmalıdır."
);

assert.match(
  cari,
  /disabled=\{\s*isSaving \|\|\s*scopeLoading \|\|\s*Boolean\(scopeError\) \|\|\s*!scope\s*\}/,
  "Ana Satışa Aktar düğmesi scope hazır değilken kapalı olmalıdır."
);

assert.match(
  cari,
  /const requiresSaleBridge =\s*Boolean\(returnSaleId\) \|\|\s*transferToSale;/,
  "Satışa Hazırlık -> mevcut satış ve yeni satış aynı readiness kapısını kullanmalıdır."
);

assert.match(
  cari,
  /requiresSaleBridge[\s\S]*scopeLoading[\s\S]*scopeError[\s\S]*!scope[\s\S]*return;/,
  "Satışa Hazırlık köprüsü scope hazır değilken satış güncellememelidir."
);

assert.match(
  cari,
  /syncOrCreateDraftSale\([\s\S]*scope,\s*returnSaleId\s*\)/,
  "Satış -> Satışa Hazırlık -> aynı satış, exact returnSaleId ile devam etmelidir."
);

assert.match(
  newSale,
  /syncOrCreateDraftSale\([\s\S]*selectedCustomer[\s\S]*currentUser,[\s\S]*scope[\s\S]*\)/,
  "Normal satış açma mevcut canonical taslak motorunu kullanmaya devam etmelidir."
);

assert.match(
  salesAdapter,
  /const manualItems:\s*SaleItem\[\]\s*=[\s\S]*existingItems\.filter\([\s\S]*!item\.measurementId/,
  "Ölçüden dönerken manuel/adetli/aksesuar satırları korunmalıdır."
);

assert.match(
  salesAdapter,
  /const refreshedAutomaticItems:\s*SaleItem\[\][\s\S]*Boolean\(item\.measurementId\)/,
  "Ölçü kaynaklı satırlar ayrı canonical yenileme akışında kalmalıdır."
);

assert.match(
  salesAdapter,
  /cleanTargetSaleId[\s\S]*sale\.id === cleanTargetSaleId/,
  "Mevcut satışa dönüş exact saleId ile bağlanmalıdır."
);

console.log("PAK_SALE_MEASUREMENT_BRIDGE_SCOPE_READINESS");