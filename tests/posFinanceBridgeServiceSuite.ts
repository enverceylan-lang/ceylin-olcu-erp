import assert from "node:assert/strict";

import type {
  PosContract,
  PosContractRule
} from "../src/lib/finance/posContracts";
import type {
  PosFinanceBridgeState
} from "../src/lib/finance/posFinanceBridgeContracts";
import type {
  PosOperationContext,
  PosOperationState
} from "../src/lib/finance/posOperationsContracts";
import {
  createPosMonthlyFee,
  createPosTransaction,
  refundPosTransaction
} from "../src/lib/finance/posOperationsService";
import {
  createPosMonthlyFeeFinance,
  createPosRefundFinance,
  createPosSettlementFinance
} from "../src/lib/finance/posFinanceBridgeService";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1"
};

function context(
  idempotencyKey: string,
  operationDate =
    "2026-07-27T20:00:00.000Z"
): PosOperationContext {
  return {
    ...scope,
    userId: "admin",
    operationDate,
    idempotencyKey
  };
}

function contract(
  overrides: Partial<PosContract> = {}
): PosContract {
  const base: PosContract = {
    ...scope,

    id: "contract-1",
    contractNumber: "POS-SOZ-0001",
    contractName: "Garanti POS",

    bankAccountId: "bank-account-1",
    posAccountId: "pos-account-1",

    workingMode: "ADVANCE_NET",

    monthlyFixedFeeEnabled: true,
    monthlyFixedFeeAmount: 500,

    currency: "TRY",
    validFrom: "2026-01-01",
    validUntil: null,

    isActive: true,

    createdBy: "admin",
    createdAt: "2026-01-01T09:00:00.000Z",
    updatedAt: "2026-01-01T09:00:00.000Z",
    archivedAt: null
  };

  return {
    ...base,
    ...overrides
  } as PosContract;
}

function rule(
  overrides: Partial<PosContractRule> = {}
): PosContractRule {
  const base: PosContractRule = {
    ...scope,

    id: "rule-1",
    posContractId: "contract-1",
    posAccountId: "pos-account-1",

    installmentCount: 1,
    workingMode: "ADVANCE_NET",

    commissionRate: 3,
    fixedTransactionFee: 0,
    taxRate: 0,
    additionalFeeRate: 0,

    firstSettlementDayCount: 1,
    installmentIntervalDayCount: 0,

    isActive: true,

    createdBy: "admin",
    createdAt: "2026-01-01T09:00:00.000Z",
    updatedAt: "2026-01-01T09:00:00.000Z",
    archivedAt: null
  };

  return {
    ...base,
    ...overrides
  } as PosContractRule;
}

function emptyOperationState(): PosOperationState {
  return {
    transactions: [],
    settlementSchedules: [],
    monthlyFees: [],
    audits: []
  };
}

function emptyBridgeState(): PosFinanceBridgeState {
  return {
    bankMovements: [],
    journalEntryIds: [],
    journalNumbers: [],
    idempotencyKeys: []
  };
}

const accounts = {
  posClearingAccountId: "ledger-pos-clearing-1",
  bankAccountLedgerId: "ledger-bank-1",
  posCommissionExpenseAccountId:
    "ledger-pos-commission-expense",
  posMonthlyFeeExpenseAccountId:
    "ledger-pos-monthly-fee-expense",
  posTaxExpenseAccountId:
    "ledger-pos-tax-expense",
  customerReceivableAccountId:
    "ledger-customer-receivable"
};

function debitTotal(
  lines: readonly {
    debitAmount: number;
  }[]
): number {
  return lines.reduce(
    (total, line) =>
      total + line.debitAmount,
    0
  );
}

function creditTotal(
  lines: readonly {
    creditAmount: number;
  }[]
): number {
  return lines.reduce(
    (total, line) =>
      total + line.creditAmount,
    0
  );
}

function run(): void {
  const operationState =
    emptyOperationState();

  const createdTransaction =
    createPosTransaction(
      {
        context:
          context("create-pos-transaction"),

        id: "pos-transaction-1",
        posTransactionNumber: "POS-ISL-0001",

        contract: contract(),
        rule: rule(),

        saleId: "sale-1",
        saleNumber: "SAT-0001",
        paymentId: "payment-1",
        customerId: "customer-1",

        grossAmount: 10000,
        installmentCount: 1,
        transactionDate: "2026-07-27",

        currency: "TRY",
        description: "POS tahsilatı"
      },
      operationState
    );

  const transaction =
    createdTransaction.value.transaction;

  const schedule =
    createdTransaction.value
      .settlementSchedule;

  const scheduleLine =
    schedule.lines[0];

  const settlement =
    createPosSettlementFinance(
      {
        context: context(
          "bridge-settlement-1",
          "2026-07-28T10:00:00.000Z"
        ),

        transaction,
        schedule,

        settlementId: "settlement-1",
        settlementNumber: "POS-GEC-0001",
        scheduleLineId: scheduleLine.id,

        settlementAmount: 9700,
        settlementDate: "2026-07-28",

        documents: {
          bankMovementId:
            "bank-movement-settlement-1",
          bankMovementNumber:
            "BNK-HRK-0001",

          journalEntryId:
            "journal-settlement-1",
          journalNo:
            "FIS-POS-0001"
        },

        accounts,
        description:
          "Garanti POS banka geçişi"
      },
      emptyBridgeState()
    );

  assert.equal(
    settlement.value.grossSettlementAmount,
    10000
  );

  assert.equal(
    settlement.value.commissionAmount,
    300
  );

  assert.equal(
    settlement.value.bankNetAmount,
    9700
  );

  assert.equal(
    settlement.value.bankMovement.bankAccountId,
    "bank-account-1"
  );

  assert.equal(
    settlement.value.bankMovement.direction,
    "IN"
  );

  assert.equal(
    settlement.value.bankMovement.movementType,
    "POS_SETTLEMENT"
  );

  assert.equal(
    debitTotal(
      settlement.value.journalPosting.lines
    ),
    10000
  );

  assert.equal(
    creditTotal(
      settlement.value.journalPosting.lines
    ),
    10000
  );

  const settlementAccounts =
    settlement.value.journalPosting.lines.map(
      line => line.accountId
    );

  assert.ok(
    settlementAccounts.includes(
      accounts.bankAccountLedgerId
    )
  );

  assert.ok(
    settlementAccounts.includes(
      accounts.posCommissionExpenseAccountId
    )
  );

  assert.ok(
    settlementAccounts.includes(
      accounts.posClearingAccountId
    )
  );

  const usedBridgeState:
    PosFinanceBridgeState = {
      bankMovements: [
        settlement.value.bankMovement
      ],

      journalEntryIds: [
        settlement.value.journalPosting.entry.id
      ],

      journalNumbers: [
        settlement.value.journalPosting
          .entry.journalNo
      ],

      idempotencyKeys: [
        settlement.idempotencyKey
      ]
    };

  assert.throws(
    () =>
      createPosSettlementFinance(
        {
          context: context(
            "bridge-settlement-1"
          ),

          transaction,
          schedule,

          settlementId: "settlement-repeat",
          settlementNumber:
            "POS-GEC-REPEAT",
          scheduleLineId: scheduleLine.id,

          settlementAmount: 9700,
          settlementDate: "2026-07-28",

          documents: {
            bankMovementId:
              "bank-movement-repeat",
            bankMovementNumber:
              "BNK-HRK-REPEAT",

            journalEntryId:
              "journal-repeat",
            journalNo:
              "FIS-POS-REPEAT"
          },

          accounts,
          description: null
        },
        usedBridgeState
      ),
    /POS_FINANCE_BRIDGE_IDEMPOTENCY_CONFLICT/
  );

  assert.throws(
    () =>
      createPosSettlementFinance(
        {
          context: {
            ...context(
              "bridge-company-mismatch"
            ),
            companyId: "company-2"
          },

          transaction,
          schedule,

          settlementId:
            "settlement-company-fail",
          settlementNumber:
            "POS-GEC-COMPANY-FAIL",
          scheduleLineId: scheduleLine.id,

          settlementAmount: 9700,
          settlementDate: "2026-07-28",

          documents: {
            bankMovementId:
              "bank-company-fail",
            bankMovementNumber:
              "BNK-COMPANY-FAIL",

            journalEntryId:
              "journal-company-fail",
            journalNo:
              "FIS-COMPANY-FAIL"
          },

          accounts,
          description: null
        },
        emptyBridgeState()
      ),
    /POS_FINANCE_BRIDGE_SCOPE_MISMATCH/
  );

  const mismatchedSchedule = {
    ...schedule,
    bankAccountId: "bank-account-2",
    posAccountId: "pos-account-2"
  };

  assert.throws(
    () =>
      createPosSettlementFinance(
        {
          context:
            context("bridge-account-mismatch"),

          transaction,
          schedule: mismatchedSchedule,

          settlementId:
            "settlement-account-fail",
          settlementNumber:
            "POS-GEC-ACCOUNT-FAIL",
          scheduleLineId:
            mismatchedSchedule.lines[0].id,

          settlementAmount: 9700,
          settlementDate: "2026-07-28",

          documents: {
            bankMovementId:
              "bank-account-fail",
            bankMovementNumber:
              "BNK-ACCOUNT-FAIL",

            journalEntryId:
              "journal-account-fail",
            journalNo:
              "FIS-ACCOUNT-FAIL"
          },

          accounts,
          description: null
        },
        emptyBridgeState()
      ),
    /POS_FINANCE_BRIDGE_BANK_POS_MISMATCH/
  );

  const monthlyFee =
    createPosMonthlyFee(
      {
        context:
          context("create-monthly-fee"),

        id: "monthly-fee-2026-07",
        feeNumber:
          "POS-GDR-2026-07-0001",

        contract: contract(),

        year: 2026,
        month: 7,

        taxRate: 20,
        dueDate: "2026-07-31",

        existingFees: []
      },
      operationState
    );

  const monthlyFeeFinance =
    createPosMonthlyFeeFinance(
      {
        context: context(
          "bridge-monthly-fee",
          "2026-07-31T10:00:00.000Z"
        ),

        fee: monthlyFee.value,

        documents: {
          bankMovementId:
            "bank-movement-monthly-fee",
          bankMovementNumber:
            "BNK-HRK-0002",

          journalEntryId:
            "journal-monthly-fee",
          journalNo:
            "FIS-POS-0002"
        },

        accounts,

        paymentDate: "2026-07-31",
        description:
          "Aylık POS kullanım gideri"
      },
      emptyBridgeState()
    );

  assert.equal(
    monthlyFeeFinance.value.expenseAmount,
    500
  );

  assert.equal(
    monthlyFeeFinance.value.taxAmount,
    100
  );

  assert.equal(
    monthlyFeeFinance.value.bankOutflowAmount,
    600
  );

  assert.equal(
    monthlyFeeFinance.value
      .bankMovement.direction,
    "OUT"
  );

  assert.equal(
    debitTotal(
      monthlyFeeFinance.value
        .journalPosting.lines
    ),
    600
  );

  assert.equal(
    creditTotal(
      monthlyFeeFinance.value
        .journalPosting.lines
    ),
    600
  );

  const refundOperation =
    refundPosTransaction(
      {
        context: context(
          "create-refund",
          "2026-07-29T10:00:00.000Z"
        ),

        originalTransaction: transaction,

        refundTransactionId:
          "refund-transaction-1",
        refundTransactionNumber:
          "POS-IADE-0001",

        refundAmount: 10000,
        refundDate: "2026-07-29",

        bankMovementId:
          "bank-refund-source",
        description: "Tam POS iadesi"
      },
      operationState
    );

  const refundFinance =
    createPosRefundFinance(
      {
        context: context(
          "bridge-refund",
          "2026-07-29T11:00:00.000Z"
        ),

        originalTransaction:
          transaction,
        refundTransaction:
          refundOperation.value
            .refundTransaction,

        documents: {
          bankMovementId:
            "bank-movement-refund",
          bankMovementNumber:
            "BNK-HRK-0003",

          journalEntryId:
            "journal-refund",
          journalNo:
            "FIS-POS-0003"
        },

        accounts,

        refundDate: "2026-07-29",
        description: "POS banka iadesi"
      },
      emptyBridgeState()
    );

  assert.equal(
    refundFinance.value.refundAmount,
    10000
  );

  assert.equal(
    refundFinance.value.bankOutflowAmount,
    10000
  );

  assert.equal(
    refundFinance.value.bankMovement.direction,
    "OUT"
  );

  assert.equal(
    debitTotal(
      refundFinance.value
        .journalPosting.lines
    ),
    10000
  );

  assert.equal(
    creditTotal(
      refundFinance.value
        .journalPosting.lines
    ),
    10000
  );

  console.log(
    "[PASS] pos finance bridge lifecycle"
  );
}

run();
