import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(
    path.join(root, relativePath),
    "utf8",
  );
}

test(
  "approval material coordinator uses stock-card default supplier per stockItemId",
  () => {
    const source = read(
      "src/lib/saleApprovalMaterialFulfillment.ts",
    );

    assert.match(
      source,
      /defaultSupplierCustomerId/,
    );

    assert.match(
      source,
      /supplierByStockItemId/,
    );

    assert.match(
      source,
      /stockRequirement\.stockItemId/,
    );
  },
);

test(
  "approval material coordinator reuses existing cut and lot engines",
  () => {
    const source = read(
      "src/lib/saleApprovalMaterialFulfillment.ts",
    );

    assert.match(
      source,
      /buildSaleCutRequirementPlan/,
    );

    assert.match(
      source,
      /optimizeSaleCutRequirementPlan/,
    );

    assert.match(
      source,
      /getStoreCutLots/,
    );

    assert.match(
      source,
      /executeSaleSupplyFulfillment/,
    );
  },
);

test(
  "multi supplier execution aggregates then saves production plans atomically",
  () => {
    const source = read(
      "src/lib/saleApprovalMaterialFulfillment.ts",
    );

    assert.match(
      source,
      /buildProductionSourcePlansFromFulfillment/,
    );

    assert.match(
      source,
      /savePlansAtomically/,
    );

    assert.match(
      source,
      /rollbackFulfillmentCreated/,
    );
  },
);

test(
  "mechanical supplier package is not forced through meter cut fulfillment",
  () => {
    const source = read(
      "src/lib/saleApprovalMaterialFulfillment.ts",
    );

    assert.match(
      source,
      /candidate\.kind ===\s*"TAILOR_MATERIAL"/,
    );

    assert.doesNotMatch(
      source,
      /candidate\.kind ===\s*"SUPPLIER_MECHANICAL"/,
    );
  },
);

test(
  "both sale approval screens call material fulfillment coordinator",
  () => {
    const listSource = read(
      "src/app/satis/page.tsx",
    );

    const detailSource = read(
      "src/app/satis/[id]/page.tsx",
    );

    assert.match(
      listSource,
      /executeSaleApprovalOperations/,
    );

    assert.match(
      detailSource,
      /executeSaleApprovalOperations/,
    );
  },
);