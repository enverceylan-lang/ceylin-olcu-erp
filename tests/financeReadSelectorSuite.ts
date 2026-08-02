import assert from "node:assert/strict";
import { selectFinanceReadModel } from "../src/lib/finance/financeReadSelector";
import { projectSaleFinance } from "../src/lib/finance/saleFinanceProjection";
import type { SaleFinanceProjectionResult } from "../src/lib/finance/financeContracts";
import type { ErpScope } from "../src/lib/erpScope";
import type { Sale } from "../src/store/salesStore";

const scope: ErpScope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1",
};
const projectionAt = "2026-07-27T11:00:00.000Z";

function sale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: "sale-1",
    saleNo: "SAT-1",
    customerId: "customer-1",
    status: "ONAYLANDI",
    items: [],
    priceSource: "MANUAL",
    totalAmount: 1000,
    cashPrice: 1000,
    installmentPrice: 1000,
    discount: 0,
    downPayment: 0,
    remainingBalance: 800,
    payments: [
      {
        id: "payment-1",
        amount: 200,
        paidAt: "2026-07-27",
        method: "NAKIT",
      },
    ],
    createdAt: "2026-07-26T08:00:00.000Z",
    updatedAt: "2026-07-26T08:00:00.000Z",
    ...overrides,
  };
}

function select(overrides: Parameters<typeof selectFinanceReadModel>[0] = {
  scope,
  packageType: "PRO",
  permissions: ["customerFinance.view"],
  requestedCapability: "CUSTOMER_FINANCE",
  sales: [sale()],
  projectionAt,
  currency: "TRY",
}) {
  return selectFinanceReadModel(overrides);
}

const baseInput = {
  scope,
  packageType: "PRO" as const,
  permissions: ["customerFinance.view"] as const,
  requestedCapability: "CUSTOMER_FINANCE" as const,
  sales: [sale()],
  projectionAt,
  currency: "TRY",
};

assert.deepEqual(select(baseInput), select(baseInput));

const directProjection = projectSaleFinance({
  sale: baseInput.sales[0],
  scope,
  projectionAt,
  currency: "TRY",
});
assert.deepEqual(select(baseInput).transactions, directProjection.transactions);

const twoSales = [
  sale(),
  sale({
    id: "sale-2",
    saleNo: "SAT-2",
    customerId: "customer-2",
    totalAmount: 500,
    remainingBalance: 500,
    payments: [],
  }),
];
const customerFiltered = select({
  ...baseInput,
  sales: twoSales,
  customerId: "customer-2",
});
assert.ok(
  customerFiltered.transactions.every(
    (transaction) => transaction.customerId === "customer-2",
  ),
);

const saleFiltered = select({
  ...baseInput,
  sales: twoSales,
  saleId: "sale-2",
});
assert.ok(
  saleFiltered.transactions.every(
    (transaction) => transaction.saleId === "sale-2",
  ),
);

function projectionInScope(
  projectionScope: ErpScope,
): SaleFinanceProjectionResult {
  return projectSaleFinance({
    sale: sale(),
    scope: projectionScope,
    projectionAt,
    currency: "TRY",
  });
}

for (const mismatchedScope of [
  { ...scope, tenantId: "tenant-2" },
  { ...scope, companyId: "company-2" },
  { ...scope, branchId: "branch-2" },
  { ...scope, accountingPeriodId: "period-2" },
]) {
  const scoped = select({
    ...baseInput,
    sales: [],
    projectionResults: [projectionInScope(mismatchedScope)],
  });
  assert.equal(scoped.transactions.length, 0);
  assert.ok(scoped.issues.some((entry) => entry.code === "SCOPE_MISMATCH"));
}

const transactionScopeMismatch = projectionInScope(scope);
transactionScopeMismatch.transactions[0] = {
  ...transactionScopeMismatch.transactions[0],
  branchId: "branch-other",
};
const transactionScoped = select({
  ...baseInput,
  sales: [],
  projectionResults: [transactionScopeMismatch],
});
assert.equal(
  transactionScoped.transactions.some(
    (transaction) => transaction.branchId === "branch-other",
  ),
  false,
);
assert.ok(
  transactionScoped.issues.some((entry) => entry.code === "SCOPE_MISMATCH"),
);

const unauthorized = select({
  ...baseInput,
  permissions: [],
});
assert.equal(unauthorized.transactions.length, 0);
assert.deepEqual(unauthorized.summary, {
  debitTotal: 0,
  creditTotal: 0,
  balance: 0,
  transactionCount: 0,
  issueCount: 1,
});
assert.equal(unauthorized.excludedCount, 0);

const ecoBasic = select({
  ...baseInput,
  packageType: "ECO",
  permissions: ["finance.view"],
  requestedCapability: "BASIC_FINANCE",
});
assert.equal(ecoBasic.accessDecision.allowed, true);
assert.equal(ecoBasic.summary.balance, 800);

const ecoDetailed = select({
  ...baseInput,
  packageType: "ECO",
});
assert.equal(ecoDetailed.accessDecision.allowed, false);
assert.equal(ecoDetailed.transactions.length, 0);

const totals = select(baseInput);
assert.equal(totals.summary.debitTotal, 1000);
assert.equal(totals.summary.creditTotal, 200);
assert.equal(totals.summary.balance, 800);
assert.equal(totals.summary.transactionCount, 2);
assert.equal(totals.summary.issueCount, totals.issues.length);

const mutableSales = twoSales.map((entry) => structuredClone(entry));
const salesSnapshot = structuredClone(mutableSales);
select({ ...baseInput, sales: mutableSales });
assert.deepEqual(mutableSales, salesSnapshot);

const empty = select({ ...baseInput, sales: [] });
assert.deepEqual(empty.transactions, []);
assert.deepEqual(empty.summary, {
  debitTotal: 0,
  creditTotal: 0,
  balance: 0,
  transactionCount: 0,
  issueCount: 0,
});

const invalidProjection = projectionInScope(scope);
invalidProjection.issues.push({
  code: "INVALID_PAYMENT_AMOUNT",
  severity: "ERROR",
  message: "fixture issue",
  saleId: "sale-1",
  paymentId: "payment-1",
  expected: "> 0",
  actual: 0,
});
const invalidPreserved = select({
  ...baseInput,
  sales: [],
  projectionResults: [invalidProjection],
});
assert.ok(
  invalidPreserved.issues.some(
    (entry) => entry.code === "INVALID_PAYMENT_AMOUNT",
  ),
);

const customerCannotBypassScope = select({
  ...baseInput,
  sales: [],
  customerId: "customer-1",
  projectionResults: [
    projectionInScope({ ...scope, tenantId: "tenant-other" }),
  ],
});
assert.equal(customerCannotBypassScope.transactions.length, 0);
assert.ok(
  customerCannotBypassScope.issues.some(
    (entry) => entry.code === "SCOPE_MISMATCH",
  ),
);

const duplicateProjection = projectionInScope(scope);
const duplicateResult = select({
  ...baseInput,
  sales: [],
  projectionResults: [duplicateProjection, duplicateProjection],
});
assert.equal(
  duplicateResult.transactions.length,
  duplicateProjection.transactions.length * 2,
);
assert.ok(
  duplicateResult.issues.some(
    (entry) => entry.code === "DUPLICATE_TRANSACTION_ID",
  ),
);

assert.equal(
  Object.keys(select(baseInput)).some((key) =>
    /save|write|persist|repository/i.test(key),
  ),
  false,
);

console.log("[PASS] finance read selector (20 required scenarios)");
