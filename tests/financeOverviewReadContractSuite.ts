import assert from "node:assert/strict";
import {
  parseFinanceOverviewSnapshot,
} from "../src/lib/finance/financeOverviewReadContracts";

const sample = {
  scope: {
    tenantId: "tenant-1",
    companyId: "company-1",
    branchId: "branch-1",
    accountingPeriodId: "period-1",
  },
  currency: "TRY",
  asOf: "2026-08-25T01:00:00.000Z",
  receivables: {
    originalDebtTotal: 1500,
    allocatedCollectionTotal: 500,
    reservedTotal: 0,
    openBalance: 1000,
    unallocatedCreditTotal: 25,
    customerNetPosition: 975,
    openItemCount: 3,
  },
  due: {
    overdueAmount: 400,
    dueTodayAmount: 100,
    futureAmount: 500,
    totalOpenAmount: 1000,
  },
  payables: {
    accrualTotal: 480,
    paymentTotal: 481,
    balance: -1,
  },
  liquidity: {
    cashBalance: 100,
    bankBalance: -20,
    posPendingAmount: 50,
  },
  recentTransactions: [
    {
      transactionId: "tx-1",
      transactionType: "COLLECTION",
      direction: "DEBIT",
      paymentMethod: "CASH",
      financeAccountId: "account-1",
      counterAccountId: "receivable-1",
      customerId: "customer-1",
      saleId: "sale-1",
      sourceDocumentId: "payment-1",
      sourceDocumentType: "SALE_PAYMENT",
      netAmount: 100,
      currency: "TRY",
      transactionDate: "2026-08-25",
      description: "Tahsilat",
      createdAt: "2026-08-25T01:00:00.000Z",
    },
  ],
  reconciliation: {
    ok: true,
    reason: null,
  },
};

const parsed = parseFinanceOverviewSnapshot(sample);
assert.equal(parsed.receivables.openBalance, 1000);
assert.equal(parsed.receivables.customerNetPosition, 975);
assert.equal(parsed.payables.balance, -1);
assert.equal(parsed.liquidity.bankBalance, -20);
assert.equal(parsed.liquidity.posPendingAmount, 50);
assert.equal(parsed.recentTransactions.length, 1);

const monthlyPosFeeLike = parseFinanceOverviewSnapshot({
  ...sample,
  recentTransactions: [
    {
      ...sample.recentTransactions[0],
      transactionId: "tx-pos-monthly-fee",
      transactionType: "PAYMENT",
      customerId: null,
      saleId: null,
      sourceDocumentId: "pos-monthly-fee-2026-08",
      sourceDocumentType: "EXPENSE",
      description: "Aylık POS kullanım gideri",
    },
  ],
});

assert.equal(monthlyPosFeeLike.recentTransactions[0]?.customerId, null);
assert.equal(monthlyPosFeeLike.recentTransactions[0]?.saleId, null);
assert.equal(
  monthlyPosFeeLike.recentTransactions[0]?.sourceDocumentId,
  "pos-monthly-fee-2026-08",
);

assert.throws(
  () =>
    parseFinanceOverviewSnapshot({
      ...sample,
      recentTransactions: [
        {
          ...sample.recentTransactions[0],
          customerId: null,
          saleId: null,
          sourceDocumentId: null,
        },
      ],
    }),
  /FINANCE_OVERVIEW_TRANSACTION_SOURCE_INVALID/,
);

assert.throws(
  () =>
    parseFinanceOverviewSnapshot({
      ...sample,
      liquidity: {
        ...sample.liquidity,
        posPendingAmount: -1,
      },
    }),
  /FINANCE_OVERVIEW_POS_PENDING_INVALID/,
);

assert.throws(
  () =>
    parseFinanceOverviewSnapshot({
      ...sample,
      reconciliation: {
        ok: false,
        reason: "broken",
      },
    }),
  /FINANCE_OVERVIEW_RECONCILIATION_FAILED/,
);

console.log("[PASS] F3 overview parser accepts signed balances");
console.log("[PASS] F3 overview parser accepts customer/sale-null company finance movements");
console.log("[PASS] F3 overview parser keeps sourceDocumentId mandatory");
console.log("[PASS] F3 overview parser rejects negative POS pending");
console.log("[PASS] F3 overview parser fails closed on reconciliation");
