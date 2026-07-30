import assert from "node:assert/strict";

import {
  readFileSync
} from "node:fs";

import {
  resolve
} from "node:path";

const componentPath =
  resolve(
    process.cwd(),
    "src/components/sales/SaleReturnPanel.tsx"
  );

const pagePath =
  resolve(
    process.cwd(),
    "src/app/satis/[id]/page.tsx"
  );

const component =
  readFileSync(
    componentPath,
    "utf8"
  );

const page =
  readFileSync(
    pagePath,
    "utf8"
  );

const componentRequirements = [
  "startFinanceValidatedSaleReturn",
  "approveSaleReturnWorkflow",
  "rejectSaleReturnWorkflow",
  "completeSaleReturnWorkflow",
  "loadLocalSaleReturns",
  "listLocalFinanceTransactions",
  "calculateSaleReturnEligibility",
  '"BAŞLATILDI"',
  '"ONAYLANDI"',
  "İade Sürecini Başlat",
  "İadeyi Tamamla"
];

for (
  const requirement of
  componentRequirements
) {
  assert.ok(
    component.includes(
      requirement
    ),
    `Component requirement missing: ${requirement}`
  );
}

assert.ok(
  component.includes(
    "Promise.all(["
  ),
  "Initial data loading must be asynchronous."
);

assert.equal(
  component.includes(
    "void refresh();"
  ),
  false,
  "Effect must not call the state-mutating refresh helper."
);

assert.ok(
  page.includes(
    'import SaleReturnPanel from "@/components/sales/SaleReturnPanel";'
  ),
  "SaleReturnPanel import is missing."
);

assert.ok(
  page.includes(
    "<SaleReturnPanel"
  ),
  "SaleReturnPanel render is missing."
);

assert.ok(
  page.includes(
    "scope={scope}"
  ),
  "ERP scope is not forwarded."
);

assert.ok(
  page.includes(
    "actorUserId={"
  ),
  "Actor user is not forwarded."
);

assert.ok(
  page.includes(
    "persistedSale.status"
  ),
  "Persisted sale status is not used."
);

assert.equal(
  component.includes(
    ".delete("
  ),
  false,
  "Return panel must not physically delete records."
);

assert.equal(
  component.includes(
    "updateSale("
  ),
  false,
  "Return panel must not rewrite sale history."
);

console.log(
  "saleReturnPanelContractSuite: PASS"
);