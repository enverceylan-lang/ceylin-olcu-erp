import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function main() {
  const source =
    fs.readFileSync(
      path.join(
        process.cwd(),
        "src/components/operations/MaterialCutDecisionPanel.tsx"
      ),
      "utf8"
    );

  assert.match(
    source,
    /const handleReceiveSupplierMaterial = async \(/
  );
  assert.match(
    source,
    /await persistSupplierReceiptStockAuthority\(/
  );
  assert.match(
    source,
    /supplierOrder\.allocationId/
  );
  assert.match(
    source,
    /supplierOrderLineId/
  );
  assert.match(
    source,
    /readCentralSupplierReceiptLines/
  );
  assert.match(
    source,
    /receivedUnit:\s*unit/
  );

  const authorityIndex =
    source.indexOf(
      "await persistSupplierReceiptStockAuthority("
    );
  const mechanicalIndex =
    source.indexOf(
      "executeMechanicalSupplierReceiptToInstallation({"
    );
  const textileIndex =
    source.indexOf(
      "executeSupplierReceiptToProduction({"
    );

  assert.ok(authorityIndex >= 0);
  assert.ok(mechanicalIndex > authorityIndex);
  assert.ok(textileIndex > authorityIndex);

  assert.match(
    source,
    /Mal kabul kalıcı olarak kaydedildi\./
  );

  console.log(
    "supplierReceiptStockUiWiringSuite: PASS"
  );
}

main();