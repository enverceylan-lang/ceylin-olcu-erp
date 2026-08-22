import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const panel = fs.readFileSync(
  path.join(root, "src/components/finance/CustomerFinancePanel.tsx"),
  "utf8",
);

const financePage = fs.readFileSync(
  path.join(root, "src/app/finans/page.tsx"),
  "utf8",
);

assert.match(financePage, /useSalesStore/);
assert.match(financePage, /selectFinanceReadModel/);

assert.match(panel, /useSalesStore/);
assert.match(panel, /selectFinanceReadModel/);
assert.match(panel, /customerId,/);
assert.match(panel, /requestedCapability:\s*"CUSTOMER_FINANCE"/);
assert.match(panel, /calculateCustomerFinanceDashboard/);
assert.match(panel, /FinanceTransactionTable/);

assert.doesNotMatch(panel, /readCustomerReceivableSnapshot/);
assert.doesNotMatch(panel, /CustomerReceivableSnapshot/);
assert.doesNotMatch(panel, /localFinanceDb|listLocalFinanceTransactions/);

console.log("[PASS] customer finance mirrors finance center read model");