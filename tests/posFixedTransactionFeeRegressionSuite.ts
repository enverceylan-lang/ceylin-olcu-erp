import assert from "node:assert/strict";

import type {
  PosContract,
  PosContractRule
} from "../src/lib/finance/posContracts";
import {
  createPosTransaction
} from "../src/lib/finance/posOperationsService";
import {
  createPosSettlementFinance
} from "../src/lib/finance/posFinanceBridgeService";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1"
};

const contract: PosContract = {
  ...scope,
  id: "contract-1",
  contractNumber: "POS-SOZ-1",
  contractName: "POS",
  bankAccountId: "bank-1",
  posAccountId: "pos-1",
  workingMode: "ADVANCE_NET",
  monthlyFixedFeeEnabled: false,
  monthlyFixedFeeAmount: 0,
  currency: "TRY",
  validFrom: "2026-08-01",
  validUntil: null,
  isActive: true,
  createdBy: "admin",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
  archivedAt: null
};

const rule: PosContractRule = {
  ...scope,
  id: "rule-1",
  posContractId: contract.id,
  posAccountId: contract.posAccountId,
  installmentCount: 1,
  workingMode: "ADVANCE_NET",
  commissionRate: 0,
  fixedTransactionFee: 100,
  taxRate: 0,
  additionalFeeRate: 0,
  firstSettlementDayCount: 1,
  installmentIntervalDayCount: 0,
  isActive: true,
  createdBy: "admin",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
  archivedAt: null
};

const context = {
  ...scope,
  userId: "admin",
  operationDate: "2026-08-16T08:00:00.000Z",
  idempotencyKey: "fixed-fee-create"
};

const created = createPosTransaction(
  {
    context,
    id: "pos-tx-1",
    posTransactionNumber: "POS-1",
    contract,
    rule,
    saleId: "sale-1",
    saleNumber: "SAT-1",
    paymentId: "payment-1",
    customerId: "customer-1",
    grossAmount: 1000,
    installmentCount: 1,
    transactionDate: "2026-08-16",
    currency: "TRY",
    description: null
  },
  {
    transactions: [],
    settlementSchedules: [],
    monthlyFees: [],
    audits: []
  }
);

const line = created.value.settlementSchedule.lines[0];
assert.equal(line.fixedTransactionFee, 100);
assert.equal(line.netAmount, 900);

const settlement = createPosSettlementFinance(
  {
    context: {
      ...context,
      idempotencyKey: "fixed-fee-settlement",
      operationDate: "2026-08-17T08:00:00.000Z"
    },
    transaction: created.value.transaction,
    schedule: created.value.settlementSchedule,
    settlementId: "settlement-1",
    settlementNumber: "SET-1",
    scheduleLineId: line.id,
    settlementAmount: 900,
    settlementDate: "2026-08-17",
    documents: {
      bankMovementId: "bank-movement-1",
      bankMovementNumber: "BNK-1",
      journalEntryId: "journal-1",
      journalNo: "FIS-1"
    },
    accounts: {
      posClearingAccountId: "ledger-clearing",
      bankAccountLedgerId: "ledger-bank",
      posCommissionExpenseAccountId: "ledger-commission",
      posMonthlyFeeExpenseAccountId: "ledger-monthly",
      posTaxExpenseAccountId: "ledger-tax",
      customerReceivableAccountId: "ledger-customer"
    },
    description: null
  },
  {
    bankMovements: [],
    journalEntryIds: [],
    journalNumbers: [],
    idempotencyKeys: []
  }
);

assert.equal(settlement.value.bankNetAmount, 900);
assert.equal(settlement.value.journalPosting.lines.length, 3);

const totalDebit = settlement.value.journalPosting.lines.reduce(
  (sum, item) => sum + item.debitAmount,
  0
);
const totalCredit = settlement.value.journalPosting.lines.reduce(
  (sum, item) => sum + item.creditAmount,
  0
);

assert.equal(totalDebit, 1000);
assert.equal(totalCredit, 1000);
assert.ok(
  settlement.value.journalPosting.lines.some(
    item =>
      item.accountId === "ledger-commission" &&
      item.debitAmount === 100
  )
);

console.log("[PASS] pos fixed transaction fee settlement regression");
