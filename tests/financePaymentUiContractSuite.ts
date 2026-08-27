import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const panel = readFileSync(
  resolve(process.cwd(), "src/components/finance/FinanceOperationsPanel.tsx"),
  "utf8",
);
const workspace = readFileSync(
  resolve(process.cwd(), "src/components/finance/PaymentWorkspace.tsx"),
  "utf8",
);

assert.match(panel, /PaymentWorkspace/);
assert.match(
  panel,
  /section === "Ödeme"[\s\S]*<PaymentWorkspace/,
);

assert.match(workspace, /"Kasa \/ Nakit": "CASH"/);
assert.match(workspace, /"Banka \/ EFT \/ Havale": "BANK"/);
assert.doesNotMatch(workspace, /"K\.Kartı ile Ödeme":/);
assert.doesNotMatch(workspace, /"Çek ile Ödeme":/);
assert.doesNotMatch(workspace, /"Senet ile Ödeme":/);

assert.match(workspace, /finance\.cash\.payment\.create/);
assert.match(workspace, /finance\.bank\.payment\.create/);
assert.match(workspace, /fetch\("\/api\/finance\/accounts"/);
assert.match(workspace, /fetch\("\/api\/finance\/operations"/);
assert.match(workspace, /Authorization:\s*`Bearer \$\{sessionToken\}`/);
assert.match(workspace, /kind:\s*"PAYMENT"/);
assert.match(workspace, /action:\s*"CREATE"/);
assert.match(workspace, /counterpartyType:\s*selectedCounterparty\.cariType/);
assert.match(workspace, /COUNTERPARTY_PAYMENT:/);

console.log("FINANCE_PAYMENT_UI_CONTRACT: PAK");
