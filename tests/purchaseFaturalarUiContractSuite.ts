import assert from "node:assert/strict";
import fs from "node:fs";

const purchase =
  fs.readFileSync(
    "src/app/alis/page.tsx",
    "utf8",
  );
const purchaseReturn =
  fs.readFileSync(
    "src/app/alis-iade/page.tsx",
    "utf8",
  );
const sidebar =
  fs.readFileSync(
    "src/components/Sidebar.tsx",
    "utf8",
  );

assert.match(
  sidebar,
  /\{\s*name:\s*"Alış",\s*href:\s*"\/alis",\s*enabled:\s*true\s*\}/,
);
assert.match(
  sidebar,
  /\{\s*name:\s*"Alış İade",\s*href:\s*"\/alis-iade",\s*enabled:\s*true\s*\}/,
);

assert.match(
  purchase,
  /product\.purchasePrice1/,
);
assert.match(
  purchase,
  /product\.purchaseVatRate/,
);
assert.match(
  purchase,
  /Seç — genel öneri %10/,
);
assert.match(
  purchase,
  /taxIncluded:\s*null/,
);
assert.match(
  purchase,
  /KDV Şekli/,
);
assert.match(
  purchase,
  /Dahil/,
);
assert.match(
  purchase,
  /Hariç/,
);
assert.match(
  purchase,
  /persistPurchaseDraftServer/,
);
assert.match(
  purchase,
  /approvePurchaseDocumentServer/,
);
assert.match(
  purchase,
  /updateProduct\([\s\S]*purchasePrice1/,
);
assert.match(
  purchase,
  /Alış Fiyat 2\/3\/4 değiştirilmez/,
);

assert.match(
  purchaseReturn,
  /loadPurchaseServerSnapshot/,
);
assert.match(
  purchaseReturn,
  /createPurchaseReturnServer/,
);
assert.match(
  purchaseReturn,
  /purchase\.status ===[\s\S]*"APPROVED"/,
);
assert.match(
  purchaseReturn,
  /stoktan OUT hareketi/,
);
assert.match(
  purchaseReturn,
  /finansal ters kayıt/,
);

console.log(
  "purchaseFaturalarUiContractSuite: PASS",
);
