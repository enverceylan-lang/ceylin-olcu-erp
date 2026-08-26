import assert from "node:assert/strict";
import {
  canOpenFinanceCenter,
  canViewFinanceOverview,
  defaultFinanceSection,
  visibleFinanceCollectionItems,
  visibleFinancePaymentItems,
  visibleFinanceSections,
} from "../src/lib/finance/financeNavigationPolicy";

assert.equal(canOpenFinanceCenter([]), false);
assert.equal(canViewFinanceOverview([]), false);

const cashCollector = ["finance.cash.collection.create"] as const;
assert.equal(canOpenFinanceCenter(cashCollector), true);
assert.equal(canViewFinanceOverview(cashCollector), false);
assert.deepEqual(visibleFinanceSections(cashCollector), ["Tahsilat"]);
assert.deepEqual(visibleFinanceCollectionItems(cashCollector), ["Kasa / Nakit"]);
assert.equal(defaultFinanceSection(cashCollector), "Tahsilat");

const collector = [
  "finance.cash.collection.create",
  "finance.pos.collection.create",
] as const;

assert.deepEqual(visibleFinanceCollectionItems(collector), [
  "Kasa / Nakit",
  "POS / Kart",
]);

assert.equal(
  visibleFinanceCollectionItems(collector).includes("Banka / EFT / Havale"),
  false,
);

const bankPayer = ["finance.bank.payment.create"] as const;
assert.deepEqual(visibleFinanceSections(bankPayer), ["Ödeme"]);
assert.deepEqual(visibleFinancePaymentItems(bankPayer), [
  "Banka / EFT / Havale",
]);

const accountViewer = ["finance.bank.view"] as const;
assert.deepEqual(visibleFinanceSections(accountViewer), ["Hesaplar"]);

const accountManager = ["finance.account.manage"] as const;
assert.deepEqual(visibleFinanceSections(accountManager), ["Hesaplar"]);

const reporter = ["finance.report.view"] as const;
assert.deepEqual(visibleFinanceSections(reporter), ["Raporlar"]);

const opening = ["finance.opening_balance.create"] as const;
assert.deepEqual(visibleFinanceSections(opening), ["Devir / Açılış"]);

const overviewAndCollection = [
  "finance.view",
  "finance.cash.collection.create",
] as const;

assert.deepEqual(visibleFinanceSections(overviewAndCollection), [
  "Genel Bakış",
  "Tahsilat",
]);
assert.equal(defaultFinanceSection(overviewAndCollection), "Genel Bakış");

const customerFinanceOnly = ["customerFinance.view"] as const;
assert.equal(canOpenFinanceCenter(customerFinanceOnly), false);
assert.deepEqual(visibleFinanceSections(customerFinanceOnly), []);

console.log(
  "[PASS] finance navigation policy (granular section + channel visibility)",
);