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
const navigationPolicy = read(
  "src/lib/finance/financeNavigationPolicy.ts",
);
const operationsPanel = read(
  "src/components/finance/FinanceOperationsPanel.tsx",
);
const collectionWorkspace = read(
  "src/components/finance/CollectionWorkspace.tsx",
);

/*
 * Sidebar product order:
 * Faturalar -> Finans -> Operasyonlar -> Üretim
 *
 * Finance visibility is no longer role === ADMIN.
 * Finance shell visibility comes from the granular finance permission policy.
 */
assert.match(
  sidebar,
  /name: "Faturalar"[\s\S]*name: "Finans"[\s\S]*name: "Operasyonlar"[\s\S]*name: "Üretim"/,
);

assert.match(
  sidebar,
  /item\.href === "\/finans"[\s\S]{0,220}canOpenFinanceCenter\(financePermissions\)/,
);

assert.doesNotMatch(
  sidebar,
  /item\.href === "\/finans"[\s\S]{0,220}return role === "ADMIN"/,
);

assert.match(
  sidebar,
  /allowedFinanceSections = visibleFinanceSections\(financePermissions\)/,
);

assert.match(
  sidebar,
  /financeMenuItems[\s\S]*allowedFinanceSections\.includes/,
);

/*
 * General Finance page:
 * - finance shell can open without finance.view if another Finance operation
 *   permission exists;
 * - overview itself remains separately gated by finance.view;
 * - overview data now comes from the canonical finance snapshot API;
 * - FinanceAccountManager is manage-permission gated.
 */
assert.match(page, /canOpenFinanceCenter\(runtime\.permissions\)/);
assert.match(page, /canViewFinanceOverview\(runtime\.permissions\)/);

assert.match(page, /readFinanceOverviewSnapshot\(/);

assert.doesNotMatch(
  page,
  /FinanceSummaryCards|FinanceIssueList/,
);

assert.doesNotMatch(
  page,
  /useSalesStore|loadSales|selectFinanceReadModel/,
);

assert.match(
  page,
  /activeSection === "Hesaplar"[\s\S]{0,180}finance\.account\.manage/,
);

assert.match(
  page,
  /defaultFinanceSection\(runtime\.permissions\)/,
);

assert.doesNotMatch(page, /\.reduce\(/);

/*
 * Central Finance navigation policy.
 */
assert.match(
  navigationPolicy,
  /"Kasa \/ Nakit": "finance\.cash\.collection\.create"/,
);

assert.match(
  navigationPolicy,
  /"POS \/ Kart": "finance\.pos\.collection\.create"/,
);

assert.match(
  navigationPolicy,
  /"Banka \/ EFT \/ Havale": "finance\.bank\.collection\.create"/,
);

assert.match(
  navigationPolicy,
  /"Müşteri Çeki": "finance\.cheque\.receipt\.create"/,
);

assert.match(
  navigationPolicy,
  /"Müşteri Senedi": "finance\.note\.receipt\.create"/,
);

assert.match(
  navigationPolicy,
  /finance\.opening_balance\.create/,
);

assert.match(
  navigationPolicy,
  /export function canOpenFinanceCenter/,
);

assert.match(
  navigationPolicy,
  /export function visibleFinanceSections/,
);

assert.match(
  navigationPolicy,
  /export function canCreateFinanceCollectionItem/,
);

/*
 * Operation panel and CollectionWorkspace must consume the same permission
 * model instead of independently inventing access rules.
 */
assert.match(
  operationsPanel,
  /permissions: readonly FinancePermission\[\]/,
);

assert.match(
  operationsPanel,
  /visibleFinanceCollectionItems\(permissions\)/,
);

assert.match(
  operationsPanel,
  /visibleFinancePaymentItems\(permissions\)/,
);

assert.match(
  collectionWorkspace,
  /canCreateFinanceCollectionItem/,
);

assert.match(
  collectionWorkspace,
  /channelAllowed/,
);

assert.match(
  collectionWorkspace,
  /Bu finans işlemi için yetkiniz bulunmuyor\./,
);

/*
 * Canonical customer-finance contracts remain untouched.
 */
assert.match(customerPanel, /customerId,/);
assert.match(customerPanel, /requestedCapability: "CUSTOMER_FINANCE"/);
assert.match(customerPanel, /<FinanceTransactionTable/);

assert.match(
  runtimeContext,
  /fetch\("\/api\/erp-context"[\s\S]*Authorization: `Bearer \$\{sessionToken\}`/,
);

assert.match(runtimeContext, /cache: "no-store"/);
assert.doesNotMatch(runtimeContext, /ADMIN|normalizeRole/);

assert.match(
  page,
  /runtime\.state !== "ready"[\s\S]*FinanceAccessState/,
);

assert.match(
  customerPanel,
  /runtime\.state !== "ready"[\s\S]*FinanceAccessState/,
);

assert.match(page, /FinanceCanonicalOverview/);
assert.match(customerPanel, /requestedCapability: "CUSTOMER_FINANCE"/);

assert.match(transactionTable, /transactions\.length === 0/);
assert.match(issueList, /issues\.length === 0/);
assert.match(summaryCards, /new Intl\.NumberFormat\("tr-TR"/);
assert.match(transactionTable, /new Intl\.DateTimeFormat\("tr-TR"\)/);

assert.match(
  customerPage,
  /<CustomerFinancePanel customerId=\{customer\.id\}/,
);

/*
 * Canonical cari balance must not come from Customer.balance or a mutable
 * store balance. selectedSale.remainingBalance is intentionally allowed only
 * inside the read-only sale-detail presentation.
 */
assert.doesNotMatch(
  customerPanel,
  /Customer\.balance/,
);

assert.match(
  customerPanel,
  /selectedSale\.remainingBalance/,
);

assert.doesNotMatch(
  customerPanel,
  /updateSale\(|removeSale\(|deleteSale\(/,
);

assert.doesNotMatch(
  `${page}\n${customerPanel}`,
  /saveLocalSale|saveLocal|persist|Dexie|Supabase|fetch\(/,
);

assert.match(
  page,
  /snapshot\.recentTransactions/,
);

/*
 * AccessState still maps access reasons to human-readable text.
 * Removal of its optional diagnostic code is a separate UX hardening scope.
 */
assert.match(
  accessState,
  /Finans görünümü kullanılamıyor/,
);

assert.doesNotMatch(
  accessState,
  /debitTotal|creditTotal|balance|transactionCount/,
);

assert.match(
  customerPage,
  /onClick=\{\(\) => setActiveTab\("financial"\)\}[\s\S]*<CustomerFinancePanel/,
);

console.log(
  "[PASS] finance UI contracts (F1 granular navigation + canonical customer finance)",
);
