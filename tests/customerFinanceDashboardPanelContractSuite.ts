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
  "calculateCustomerFinanceDashboard",
  "listLocalFinanceTransactions",
  'requestedCapability: "CUSTOMER_FINANCE"',
  "Cari Finans V1",
  "Cari Ekstresi",
  "Açık Vade Dağılımı",
  "dashboard.summary.balance",
  "dashboard.due.overdueAmount",
  "dashboard.due.dueTodayAmount",
  "dashboard.due.futureAmount",
  "<FinanceTransactionTable"
];

for (
  const requirement of
  requiredPanelContracts
) {
  assert.ok(
    panel.includes(requirement),
    `Missing panel contract: ${requirement}`
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
    "remainingBalance"
  ),
  false,
  "UI must not use a mutable remaining balance field."
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