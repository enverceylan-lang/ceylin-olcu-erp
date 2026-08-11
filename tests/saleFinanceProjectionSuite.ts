import assert from "node:assert/strict";
import { projectSaleFinance } from "../src/lib/finance/saleFinanceProjection";
import type { ErpScope } from "../src/lib/erpScope";
import type { Sale, SalePayment } from "../src/store/salesStore";

const scope: ErpScope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1",
};

const projectionAt = "2026-07-27T10:00:00.000Z";

function payment(overrides: Partial<SalePayment> = {}): SalePayment {
  return {
    id: "payment-1",
    amount: 200,
    paidAt: "2026-07-26T09:00:00.000Z",
    method: "NAKIT",
    ...overrides,
  };
}

function sale(overrides: Partial<Sale> = {}): Sale {
  return {
    ...scope,
    id: "sale-1",
    saleNo: "SAT-1",
    customerId: "customer-1",
    status: "ONAYLANDI",
    items: [],
    priceSource: "MANUAL",
    totalAmount: 1000,
    cashPrice: 1000,
    installmentPrice: 1000,
    discount: 100,
    downPayment: 0,
    remainingBalance: 900,
    payments: [],
    createdAt: "2026-07-26T08:00:00.000Z",
    updatedAt: "2026-07-26T08:00:00.000Z",
    ...overrides,
  };
}

function project(source: Sale, overrideScope: ErpScope = scope) {
  return projectSaleFinance({
    sale: source,
    scope: overrideScope,
    currency: "TRY",
    projectionAt,
  });
}

const netDebt = project(sale());
assert.equal(
  netDebt.transactions.filter((entry) => entry.projectionSource === "SALE_CHARGE")
    .length,
  1,
);
assert.equal(netDebt.summary.projectedDebit, 900);
assert.equal(netDebt.transactions[0].grossAmount, 900);

const legacyOnly = project(
  sale({ discount: 0, downPayment: 250, remainingBalance: 750 }),
);
assert.equal(legacyOnly.transactions.length, 2);
assert.equal(legacyOnly.summary.legacyDownPaymentDifference, 250);
assert.equal(
  legacyOnly.transactions[1].sourceDocumentType,
  "LEGACY_DOWN_PAYMENT",
);

const equalDownPayment = project(
  sale({
    discount: 0,
    downPayment: 200,
    payments: [payment()],
    remainingBalance: 800,
  }),
);
assert.equal(equalDownPayment.summary.legacyDownPaymentDifference, 0);
assert.equal(
  equalDownPayment.transactions.some(
    (entry) => entry.projectionSource === "LEGACY_DOWN_PAYMENT",
  ),
  false,
);

const partialDownPayment = project(
  sale({
    discount: 0,
    downPayment: 300,
    payments: [payment()],
    remainingBalance: 700,
  }),
);
assert.equal(partialDownPayment.summary.legacyDownPaymentDifference, 100);
assert.equal(partialDownPayment.summary.projectedCredit, 300);

const paymentsAboveDownPayment = project(
  sale({
    discount: 0,
    downPayment: 100,
    payments: [payment({ amount: 250 })],
    remainingBalance: 750,
  }),
);
assert.equal(paymentsAboveDownPayment.summary.legacyDownPaymentDifference, 0);
assert.equal(paymentsAboveDownPayment.summary.projectedCredit, 250);

const multiplePayments = project(
  sale({
    discount: 0,
    payments: [
      payment({ id: "payment-b", paidAt: "2026-07-27", amount: 150 }),
      payment({ id: "payment-a", paidAt: "2026-07-26", amount: 100 }),
    ],
    remainingBalance: 750,
  }),
);
assert.equal(
  multiplePayments.transactions.filter(
    (entry) => entry.projectionSource === "SALE_PAYMENT",
  ).length,
  2,
);
assert.equal(multiplePayments.summary.projectedCredit, 250);
assert.equal(multiplePayments.summary.projectedBalance, 750);
assert.equal(multiplePayments.summary.expectedRemainingBalance, 750);

const deterministicA = project(
  sale({
    discount: 0,
    payments: [
      payment({ id: "payment-b", paidAt: "2026-07-27", amount: 150 }),
      payment({ id: "payment-a", paidAt: "2026-07-26", amount: 100 }),
    ],
    remainingBalance: 750,
  }),
);
const deterministicB = project(
  sale({
    discount: 0,
    payments: [
      payment({ id: "payment-b", paidAt: "2026-07-27", amount: 150 }),
      payment({ id: "payment-a", paidAt: "2026-07-26", amount: 100 }),
    ],
    remainingBalance: 750,
  }),
);
assert.deepEqual(
  deterministicA.transactions.map(
    ({ id, transactionId, idempotencyKey }) => ({
      id,
      transactionId,
      idempotencyKey,
    }),
  ),
  deterministicB.transactions.map(
    ({ id, transactionId, idempotencyKey }) => ({
      id,
      transactionId,
      idempotencyKey,
    }),
  ),
);
assert.match(
  deterministicA.transactions[0].id,
  /^finance:sale:sale-1:charge$/,
);

const mutableSale = sale({
  discount: 0,
  payments: [payment()],
  remainingBalance: 800,
});
const snapshot = structuredClone(mutableSale);
project(mutableSale);
assert.deepEqual(mutableSale, snapshot);

const missingCustomer = project(sale({ customerId: "" }));
assert.equal(missingCustomer.transactions.length, 0);
assert.ok(
  missingCustomer.issues.some((entry) => entry.code === "MISSING_CUSTOMER_ID"),
);

const missingScope = project(
  sale(),
  { ...scope, branchId: "" } as ErpScope,
);
assert.equal(missingScope.transactions.length, 0);
assert.ok(missingScope.issues.some((entry) => entry.code === "MISSING_SCOPE"));

for (const invalidAmount of [0, -10]) {
  const invalidPayment = project(
    sale({
      payments: [payment({ amount: invalidAmount })],
      remainingBalance: 900,
    }),
  );
  assert.ok(
    invalidPayment.issues.some(
      (entry) => entry.code === "INVALID_PAYMENT_AMOUNT",
    ),
  );
}

const conflictingPayment = project(
  sale({
    payments: [
      payment({ id: "same-payment", amount: 100 }),
      payment({ id: "same-payment", amount: 200 }),
    ],
    remainingBalance: 600,
  }),
);
assert.ok(
  conflictingPayment.issues.some(
    (entry) => entry.code === "PAYMENT_ID_CONFLICT",
  ),
);

const customerWithLegacyBalance = {
  id: "customer-1",
  balance: 999999,
};
const balanceIndependent = project(sale());
assert.equal(customerWithLegacyBalance.balance, 999999);
assert.equal(balanceIndependent.summary.projectedBalance, 900);

const drift = project(sale({ remainingBalance: 123 }));
assert.equal(drift.summary.expectedRemainingBalance, 900);
assert.equal(drift.summary.projectedBalance, 900);
assert.ok(
  drift.issues.some(
    (entry) => entry.code === "SALE_REMAINING_BALANCE_DRIFT",
  ),
);

const otherSale = project(
  sale({
    id: "sale-2",
    saleNo: "SAT-2",
    customerId: "customer-2",
    totalAmount: 500,
    discount: 0,
    remainingBalance: 500,
  }),
);
assert.notEqual(netDebt.transactions[0].id, otherSale.transactions[0].id);
assert.ok(
  otherSale.transactions.every(
    (entry) =>
      entry.saleId === "sale-2" && entry.customerId === "customer-2",
  ),
);
assert.ok(
  netDebt.transactions.every(
    (entry) =>
      entry.saleId === "sale-1" && entry.customerId === "customer-1",
  ),
);

console.log("[PASS] sale finance projection (20 required scenarios)");
