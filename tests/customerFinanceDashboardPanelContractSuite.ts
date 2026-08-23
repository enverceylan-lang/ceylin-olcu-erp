import assert from "node:assert/strict";

import {
  readFileSync
} from "node:fs";

import {
  resolve
} from "node:path";

const panel =
  readFileSync(
    resolve(
      process.cwd(),
      "src/components/finance/CustomerFinancePanel.tsx"
    ),
    "utf8"
  );

const customerPage =
  readFileSync(
    resolve(
      process.cwd(),
      "src/app/cariler/[id]/page.tsx"
    ),
    "utf8"
  );

const requiredPanelContracts = [
  "readCustomerReceivableSnapshot",
  "CustomerReceivableSnapshot",
  'requestedCapability: "CUSTOMER_FINANCE"',
  "Finans merkezindeki merkezi kayıtlardan okunur",
  "snapshot.summary.originalDebtTotal",
  "snapshot.summary.allocatedCollectionTotal",
  "snapshot.summary.unallocatedCreditTotal",
  "snapshot.summary.currentBalance",
  "snapshot.due.overdueAmount",
  "snapshot.due.dueTodayAmount",
  "snapshot.due.futureAmount",
  "<FinanceTransactionTable"
];

for (
  const requirement of
  requiredPanelContracts
) {
  assert.ok(
    panel.includes(requirement),
    `Missing canonical panel contract: ${requirement}`
  );
}

assert.ok(
  customerPage.includes(
    '<CustomerFinancePanel customerId={customer.id} currency="TRY" />'
  ),
  "Customer detail financial tab must render CustomerFinancePanel."
);

assert.ok(
  customerPage.includes(
    'setActiveTab("financial")'
  ),
  "Customer financial tab button is missing."
);

assert.equal(
  panel.includes(
    "Customer.balance"
  ),
  false,
  "UI must not use a mutable customer balance field."
);

assert.equal(
  panel.includes(
    "listLocalFinanceTransactions"
  ),
  false,
  "Canonical panel must not read the local finance ledger."
);

assert.equal(
  panel.includes(
    "calculateCustomerFinanceDashboard"
  ),
  false,
  "Canonical panel must not recalculate customer balance from the sales mirror."
);

assert.equal(
  panel.includes(
    ".delete("
  ),
  false,
  "UI must not physically delete finance records."
);

assert.equal(
  panel.includes(
    "appendLocalFinanceTransaction"
  ),
  false,
  "Dashboard panel must remain read-only."
);

console.log(
  "customerFinanceDashboardPanelContractSuite: PASS"
);