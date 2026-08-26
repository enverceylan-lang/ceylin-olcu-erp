import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const page = readFileSync(
  resolve(process.cwd(), "src/app/finans/page.tsx"),
  "utf8",
);

assert.match(page, /readFinanceOverviewSnapshot\(/);
assert.match(page, /FinanceCanonicalOverview/);
assert.match(page, /Müşteriden Alacak/);
assert.match(page, /Müşteri Kredisi/);
assert.match(page, /Tedarikçiye Borç/);
assert.match(page, /Kasa \+ Banka/);
assert.match(page, /POS Bekleyen/);
assert.match(page, /Vadesi Geçen/);
assert.match(page, /Bugün Vadeli/);
assert.match(page, /İleri Vadeli/);
assert.match(page, /Finans özeti şu anda alınamadı\. Lütfen yeniden deneyin\./);

assert.doesNotMatch(page, /useSalesStore/);
assert.doesNotMatch(page, /selectFinanceReadModel/);
assert.doesNotMatch(page, /FinanceIssueList/);
assert.doesNotMatch(page, /FinanceSummaryCards/);
assert.doesNotMatch(page, /\{overviewError\}/);

assert.match(page, /<FinanceOperationsPanel/);
assert.match(page, /<FinanceAccountManager/);
assert.match(page, /canOpenFinanceCenter/);
assert.match(page, /canViewFinanceOverview/);

console.log("[PASS] F3 overview UI reads canonical snapshot");
console.log("[PASS] F3 overview UI no longer projects salesStore");
console.log("[PASS] F1 navigation and operations shell remain wired");
console.log("[PASS] F3 UI does not leak raw overview error codes");
