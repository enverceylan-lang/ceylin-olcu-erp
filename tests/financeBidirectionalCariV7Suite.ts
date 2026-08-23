import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  calculateCounterpartyPayableBalance,
  type CounterpartyPayableMovement
} from "../src/lib/counterpartyPayableService";

const scope = {
  tenantId: "tenant-v7",
  companyId: "company-v7",
  branchId: "branch-v7",
  accountingPeriodId: "period-v7"
};

const movements: CounterpartyPayableMovement[] = [
  {
    ...scope,
    id: "accrual-1",
    idempotencyKey: "accrual-1",
    counterpartyCustomerId: "supplier-1",
    counterpartyType: "SUPPLIER",
    kind: "ACCRUAL",
    amount: 480,
    currency: "TRY",
    occurredAt: "2026-08-23T09:00:00.000Z",
    recordedAt: "2026-08-23T09:00:00.000Z"
  },
  {
    ...scope,
    id: "payment-1",
    idempotencyKey: "payment-1",
    counterpartyCustomerId: "supplier-1",
    counterpartyType: "SUPPLIER",
    kind: "PAYMENT",
    amount: 481,
    currency: "TRY",
    occurredAt: "2026-08-23T10:00:00.000Z",
    recordedAt: "2026-08-23T10:00:00.000Z"
  }
];

assert.equal(
  calculateCounterpartyPayableBalance(
    movements,
    scope,
    "supplier-1"
  ),
  -1
);

const sqlPath = path.join(
  process.cwd(),
  "docs/sql/20260816_finance_collection_authority_v1.sql"
);
const sql = fs.readFileSync(sqlPath, "utf8");

assert.doesNotMatch(
  sql,
  /FINANCE_COLLECTION_EXCEEDS_OPEN_RECEIVABLE/
);

assert.match(
  sql,
  /'unallocatedCreditAmount',greatest\(v_remaining,0\)/
);

assert.match(
  sql,
  /order by oi\.due_date,oi\.document_number,oi\.sequence_no,oi\.id/
);

assert.match(
  sql,
  /FINANCE_INSTRUMENT_NOMINAL_ALLOCATION_MISMATCH/
);

const providerPath = path.join(
  process.cwd(),
  "src/lib/providerEarningsLedgerService.ts"
);
const provider = fs.readFileSync(providerPath, "utf8");

assert.match(
  provider,
  /PAYMENT_EXCEEDS_FINALIZED_AMOUNT/
);

console.log("[PASS] V7 supplier balance can cross zero");
console.log("[PASS] V7 cash-bank-pos customer residual is not rejected");
console.log("[PASS] installment/open-item due-date allocation order preserved");
console.log("[PASS] cheque-note nominal allocation guard preserved");
console.log("[PASS] provider single-earning overpayment guard preserved");
const residualSnapshotSql = fs.readFileSync(
  path.join(
    process.cwd(),
    "docs/sql/20260822_finance_customer_receivable_snapshot_v1.sql"
  ),
  "utf8"
);

assert.match(residualSnapshotSql, /unallocatedCreditTotal/);
assert.match(residualSnapshotSql, /active_collection_total/);

console.log("[PASS] V7 canonical snapshot carries residual customer credit");
