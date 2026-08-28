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

const materialCutDecisionPanel =
  read(
    "src/components/operations/MaterialCutDecisionPanel.tsx"
  );

const operationsStore =
  read(
    "src/store/useOperationsStore.ts"
  );

const producerBridge =
  read(
    "src/lib/finance/counterpartySourceTruthProducerBridge.ts"
  );

assert.doesNotMatch(
  materialCutDecisionPanel,
  /registerSupplierReceiptPayable/,
  "Supplier receipt / mal kabul must not create supplier payable."
);

assert.doesNotMatch(
  materialCutDecisionPanel,
  /supplierReceiptPayableBridge/,
  "Supplier receipt UI must not import the legacy receipt-to-payable bridge."
);

assert.doesNotMatch(
  materialCutDecisionPanel,
  /Gerçek Alış Birim Fiyatı/,
  "Physical receipt must not require invoice/purchase pricing."
);

assert.doesNotMatch(
  materialCutDecisionPanel,
  /Stok kartında geçerli Alış KDV oranı/,
  "Physical receipt must not require purchase VAT to complete stock receipt."
);

assert.match(
  operationsStore,
  /projectProviderEarningSourceTruth/
);

assert.match(
  operationsStore,
  /request\.operation\.party[\s\S]*\?\.assignmentType\s*!==[\s\S]*"EXTERNAL"/
);

assert.match(
  operationsStore,
  /assignmentType:\s*[\r\n\s]*"EXTERNAL"/
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
