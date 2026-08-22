import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(
    path.join(repoRoot, relativePath),
    "utf8",
  );
}

test(
  "central SaleItem gerçek stockItemId taşır",
  () => {
    const source = read(
      "src/store/salesStore.ts",
    );

    assert.match(
      source,
      /export interface SaleItem[\s\S]*?stockItemId\?\s*:\s*string/,
    );
  },
);

test(
  "satış ekranı seçilen stok kartını stockItemId olarak yazar",
  () => {
    const source = read(
      "src/app/satis/[id]/page.tsx",
    );

    assert.match(
      source,
      /stockItemId:\s*product\.id/,
    );
  },
);

test(
  "kesim ve tedarik planı saleItem stockItemId kullanır",
  () => {
    const source = read(
      "src/lib/saleCutRequirementPlan.ts",
    );

    assert.match(
      source,
      /saleItem\.stockItemId/,
    );
  },
);

test(
  "production bridge legacy productId alanında stockItemId silmez",
  () => {
    const source = read(
      "src/lib/productionBridge.ts",
    );

    assert.doesNotMatch(
      source,
      /productId:\s*['"]{2}/,
    );

    assert.match(
      source,
      /productId:\s*item\.stockItemId\s*\|\|\s*['"]{2}/,
    );
  },
);

test(
  "ProductionItem stockItemId taşır ve production bridge doldurur",
  () => {
    const storeSource = read(
      "src/store/useStore.ts",
    );

    const bridgeSource = read(
      "src/lib/productionBridge.ts",
    );

    assert.match(
      storeSource,
      /export interface ProductionItem[\s\S]*?stockItemId\?\s*:\s*string/,
    );

    assert.match(
      bridgeSource,
      /stockItemId:\s*item\.stockItemId/,
    );
  },
);

test(
  "mevcut production kayıtları kaynak satış satırından stockItemId ile onarılır",
  () => {
    const source = read(
      "src/lib/productionBridge.ts",
    );

    assert.match(
      source,
      /!repairedItem\.stockItemId[\s\S]*?sourceItem\.stockItemId/,
    );
  },
);