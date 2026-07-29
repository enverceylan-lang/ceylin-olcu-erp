import assert from "node:assert/strict";
import {
  buildCashMovementReport,
  summarizeCashMovements,
  type CashMovementReportQuery
} from "../src/lib/finance/cashMovementReportService";
import type {
  CashMovement
} from "../src/lib/finance/cashFinanceContracts";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1"
};

function movement(
  overrides: Partial<CashMovement>
): CashMovement {
  return {
    ...scope,
    id: "cash-1",
    movementNumber: "KASA-1",
    cashAccountId: "cash-account-1",
    direction: "IN",
    transactionId: "transaction-1",
    idempotencyKey: "idempotency-1",
    sourceDocumentType: "CUSTOMER_COLLECTION",
    sourceDocumentId: "source-1",
    sourceDocumentNumber: "SRC-1",
    customerId: "customer-1",
    supplierId: null,
    saleId: "sale-1",
    installmentId: "installment-1",
    amount: 100,
    currency: "TRY",
    transactionDate: "2026-07-28",
    status: "POSTED",
    description: null,
    createdBy: "admin",
    createdAt: "2026-07-28T10:00:00.000Z",
    reversedAt: null,
    reversalOfMovementId: null,
    ...overrides
  };
}

const movements: CashMovement[] = [
  movement({
    id: "collection",
    amount: 125.25
  }),
  movement({
    id: "supplier-payment",
    movementNumber: "KASA-2",
    direction: "OUT",
    sourceDocumentType: "SUPPLIER_PAYMENT",
    customerId: null,
    supplierId: "supplier-1",
    saleId: null,
    installmentId: null,
    amount: 40.1,
    transactionDate: "2026-07-27",
    createdAt: "2026-07-27T10:00:00.000Z"
  }),
  movement({
    id: "manual-in",
    movementNumber: "KASA-3",
    sourceDocumentType: "MANUAL_CASH",
    customerId: null,
    saleId: null,
    installmentId: null,
    amount: 10,
    transactionDate: "2026-07-26",
    createdAt: "2026-07-26T10:00:00.000Z"
  }),
  movement({
    id: "reversed",
    movementNumber: "KASA-4",
    sourceDocumentType: "MANUAL_CASH",
    customerId: null,
    saleId: null,
    installmentId: null,
    amount: 999,
    status: "REVERSED",
    reversedAt: "2026-07-28T12:00:00.000Z"
  }),
  movement({
    tenantId: "tenant-2",
    id: "foreign-scope",
    movementNumber: "KASA-5",
    amount: 500
  })
];

const summary = summarizeCashMovements(
  movements.slice(0, 4)
);

assert.equal(summary.postedCount, 3);
assert.equal(summary.reversedCount, 1);
assert.equal(summary.totalInflow, 135.25);
assert.equal(summary.totalOutflow, 40.1);
assert.equal(summary.netMovement, 95.15);
assert.equal(
  summary.customerCollectionsIn,
  125.25
);
assert.equal(summary.supplierPaymentsOut, 40.1);
assert.equal(summary.manualCashIn, 10);

const baseQuery: CashMovementReportQuery = {
  ...scope
};

const report = buildCashMovementReport(
  movements,
  baseQuery
);

assert.equal(report.totalCount, 4);
assert.deepEqual(
  report.movements.map(item => item.id),
  [
    "reversed",
    "collection",
    "supplier-payment",
    "manual-in"
  ]
);
assert.equal(report.summary.totalInflow, 135.25);

const customerReport = buildCashMovementReport(
  movements,
  {
    ...baseQuery,
    customerId: "customer-1",
    status: "POSTED"
  }
);

assert.deepEqual(
  customerReport.movements.map(item => item.id),
  ["collection"]
);

const limitedReport = buildCashMovementReport(
  movements,
  {
    ...baseQuery,
    limit: 2
  }
);

assert.equal(limitedReport.totalCount, 4);
assert.equal(limitedReport.movements.length, 2);
assert.equal(
  limitedReport.summary.totalInflow,
  135.25
);

assert.throws(
  () => buildCashMovementReport(
    movements,
    {
      ...baseQuery,
      dateFrom: "2026-07-30",
      dateTo: "2026-07-01"
    }
  ),
  /CASH_MOVEMENT_QUERY_DATE_RANGE_INVALID/
);

assert.throws(
  () => buildCashMovementReport(
    movements,
    {
      ...baseQuery,
      limit: 0
    }
  ),
  /CASH_MOVEMENT_QUERY_LIMIT_INVALID/
);

console.log(
  "CASH_MOVEMENT_REPORT_SERVICE_TEST: PAK"
);