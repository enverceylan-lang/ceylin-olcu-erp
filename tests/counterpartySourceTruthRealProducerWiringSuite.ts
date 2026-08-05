import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot =
  process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(
    path.join(repoRoot, relativePath),
    "utf8"
  );
}

const supplierBridge =
  read(
    "src/lib/supplierReceiptPayableBridge.ts"
  );

const operationsStore =
  read(
    "src/store/useOperationsStore.ts"
  );

const producerBridge =
  read(
    "src/lib/finance/counterpartySourceTruthProducerBridge.ts"
  );

const supplierProjectionCount =
  (
    supplierBridge.match(
      /const sourceTruth\s*=\s*projectSupplierReceiptSourceTruth\(/g
    ) || []
  ).length;

assert.equal(
  supplierProjectionCount,
  1,
  "Supplier receipt source truth must be projected exactly once."
);

assert.match(
  supplierBridge,
  /receivedQuantity:\s*receipt\.receivedQuantity/
);

assert.match(
  supplierBridge,
  /actualPurchaseUnitPrice:\s*input\.unitPrice/
);

assert.match(
  supplierBridge,
  /purchaseVatRate:\s*input\.purchaseVatRate/
);

assert.match(
  supplierBridge,
  /receivedAt:\s*receipt\.receivedAt/
);

assert.match(
  supplierBridge,
  /kind:\s*"SUPPLIER_RECEIPT"[\s\S]*source:\s*sourceTruth\.value/
);

assert.match(
  producerBridge,
  /const netAmount\s*=[\s\S]*input\.receivedQuantity\s*\*\s*input\.actualPurchaseUnitPrice/
);

assert.match(
  producerBridge,
  /const payableAmount\s*=[\s\S]*netAmount\s*\*[\s\S]*input\.purchaseVatRate\s*\/\s*100/
);

assert.match(
  operationsStore,
  /projectProviderEarningSourceTruth/
);

assert.match(
  operationsStore,
  /assignmentType:\s*request\.operation\.party[\s\S]*\|\|\s*"INTERNAL"/
);

assert.match(
  operationsStore,
  /earningsEntryId:\s*entry\.id/
);

assert.match(
  operationsStore,
  /finalizedAmount:\s*request\.amount/
);

assert.match(
  operationsStore,
  /enqueueCounterpartySourceTruthPersistence\(\{[\s\S]*source:\s*providerSourceTruth\.value/
);

assert.match(
  producerBridge,
  /input\.assignmentType\s*===\s*"INTERNAL"/
);

assert.match(
  producerBridge,
  /status:\s*"FINALIZED"/
);

console.log(
  "counterpartySourceTruthRealProducerWiringSuite: PASS"
);