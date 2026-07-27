import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const sidebar = read("src/components/Sidebar.tsx");
const page = read("src/app/finans/page.tsx");
const customerPage = read("src/app/cariler/[id]/page.tsx");
const customerPanel = read(
  "src/components/finance/CustomerFinancePanel.tsx",
);
const summaryCards = read(
  "src/components/finance/FinanceSummaryCards.tsx",
);
const transactionTable = read(
  "src/components/finance/FinanceTransactionTable.tsx",
);
const accessState = read(
  "src/components/finance/FinanceAccessState.tsx",
);
const issueList = read("src/components/finance/FinanceIssueList.tsx");
const runtimeContext = read(
  "src/lib/finance/useFinanceRuntimeContext.ts",
);

assert.match(
  sidebar,
  /name: "Satış"[\s\S]*name: "Finans"[\s\S]*name: "Üretim"/,
);
assert.match(
  sidebar,
  /item\.href === "\/finans"[\s\S]*financeAccess\?\.allowed === true/,
);
assert.doesNotMatch(
  sidebar,
  /item\.href === "\/finans"[\s\S]{0,300}normalizeRole/,
);

assert.match(page, /selectFinanceReadModel\(\{/);
assert.match(page, /<FinanceSummaryCards summary=\{result\.summary\}/);
assert.doesNotMatch(page, /\.reduce\(/);

assert.match(customerPanel, /customerId,/);
assert.match(customerPanel, /requestedCapability: "CUSTOMER_FINANCE"/);
assert.match(customerPanel, /<FinanceTransactionTable/);

assert.match(
  runtimeContext,
  /fetch\("\/api\/erp-context"[\s\S]*Authorization: `Bearer \$\{sessionToken\}`/,
);
assert.match(runtimeContext, /cache: "no-store"/);
assert.doesNotMatch(runtimeContext, /ADMIN|normalizeRole/);

assert.match(page, /runtime\.state !== "ready"[\s\S]*FinanceAccessState/);
assert.match(
  customerPanel,
  /runtime\.state !== "ready"[\s\S]*FinanceAccessState/,
);
assert.match(page, /requestedCapability: "BASIC_FINANCE"/);
assert.match(customerPanel, /requestedCapability: "CUSTOMER_FINANCE"/);

assert.match(transactionTable, /transactions\.length === 0/);
assert.match(issueList, /issues\.length === 0/);
assert.match(summaryCards, /new Intl\.NumberFormat\("tr-TR"/);
assert.match(transactionTable, /new Intl\.DateTimeFormat\("tr-TR"\)/);

assert.match(customerPage, /<CustomerFinancePanel customerId=\{customer\.id\}/);
assert.doesNotMatch(customerPanel, /useStore|Customer\.balance|remainingBalance/);
assert.doesNotMatch(
  `${page}\n${customerPanel}`,
  /saveLocalSale|saveLocal|persist|Dexie|Supabase|fetch\(/,
);

assert.match(page, /recentTransactions[\s\S]*\.slice\(0, 20\)/);
assert.match(
  accessState,
  /Finans görünümü kullanılamıyor[\s\S]*Erişim kodu:/,
);
assert.doesNotMatch(accessState, /debitTotal|creditTotal|balance|transactionCount/);
assert.match(
  customerPage,
  /onClick=\{\(\) => setActiveTab\("financial"\)\}[\s\S]*<CustomerFinancePanel/,
);

console.log("[PASS] finance UI contracts (20 required scenarios)");
