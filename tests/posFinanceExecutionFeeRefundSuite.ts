import "fake-indexeddb/auto";

import assert from "node:assert/strict";

import type {
  FinanceAccount
} from "../src/lib/finance/financeContracts";
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
  executePosMonthlyFeeFinance,
  executePosRefundFinance
} from "../src/lib/finance/posFinanceExecutionService";
import {
  localFinanceJournalDb,
  saveLocalFinanceAccount
} from "../src/lib/finance/localFinanceJournalDb";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1"
};

function context(
  idempotencyKey: string,
  operationDate =
    "2026-07-28T02:00:00.000Z"
): PosOperationContext {
  return {
    ...scope,
    userId: "admin",
    operationDate,
    idempotencyKey
  };
}

function account(
  id: string,
  code: string,
  name: string
): FinanceAccount {
  return {
    ...scope,

    id,
    code,
    name,

    type: "CASH",
    currency: "TRY",
    isActive: true,

    isDefaultCollection: false,
    isDefaultPayment: false,

    linkedBankAccountId: null,
    linkedPosAccountId: null,

    createdAt: "2026-07-28T00:00:00.000Z",
    updatedAt: "2026-07-28T00:00:00.000Z",
    archivedAt: null
  };
}

function contract(): PosContract {
  return {
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
}

function rule(): PosContractRule {
  return {
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
}

function operationState(): PosOperationState {
  return {
    transactions: [],
    settlementSchedules: [],
    monthlyFees: [],
    audits: []
  };
}

function bridgeState(): PosFinanceBridgeState {
  return {
    bankMovements: [],
    journalEntryIds: [],
    journalNumbers: [],
    idempotencyKeys: []
  };
}

async function saveAccounts(): Promise<void> {
  await saveLocalFinanceAccount(
    account(
      "ledger-bank-1",
      "102.01",
      "Garanti Bankası"
    )
  );

  await saveLocalFinanceAccount(
    account(
      "ledger-pos-clearing-1",
      "108.01",
      "Garanti POS Bekleyen"
    )
  );

  await saveLocalFinanceAccount(
    account(
      "ledger-pos-commission-expense",
      "780.01",
      "POS Komisyon Gideri"
    )
  );

  await saveLocalFinanceAccount(
    account(
      "ledger-pos-monthly-fee-expense",
      "780.02",
      "POS Aylık Gideri"
    )
  );

  await saveLocalFinanceAccount(
    account(
      "ledger-pos-tax-expense",
      "780.03",
      "POS Vergi Gideri"
    )
  );

  await saveLocalFinanceAccount(
    account(
      "ledger-customer-receivable",
      "120.01",
      "Müşteri Alacakları"
    )
  );
}

const accounts = {
  posClearingAccountId:
    "ledger-pos-clearing-1",
  bankAccountLedgerId:
    "ledger-bank-1",
  posCommissionExpenseAccountId:
    "ledger-pos-commission-expense",
  posMonthlyFeeExpenseAccountId:
    "ledger-pos-monthly-fee-expense",
  posTaxExpenseAccountId:
    "ledger-pos-tax-expense",
  customerReceivableAccountId:
    "ledger-customer-receivable"
};

async function run(): Promise<void> {
  await localFinanceJournalDb.delete();
  await localFinanceJournalDb.open();

  await saveAccounts();

  const state = operationState();

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
      state
    );

  const monthlyFeeCommand = {
    context:
      context(
        "execute-monthly-fee",
        "2026-07-31T10:00:00.000Z"
      ),

    fee: monthlyFee.value,

    documents: {
      bankMovementId:
        "bank-movement-monthly-fee",
      bankMovementNumber:
        "BNK-HRK-AYLIK-0001",

      journalEntryId:
        "journal-monthly-fee",
      journalNo:
        "FIS-POS-AYLIK-0001"
    },

    accounts,

    paymentDate: "2026-07-31",
    description:
      "Aylık POS kullanım gideri"
  };

  const monthlyCreated =
    await executePosMonthlyFeeFinance(
      monthlyFeeCommand,
      bridgeState()
    );

  assert.equal(
    monthlyCreated.persistenceResult.outcome,
    "CREATED"
  );

  assert.equal(
    monthlyCreated.bridgeResult.value.expenseAmount,
    500
  );

  assert.equal(
    monthlyCreated.bridgeResult.value.taxAmount,
    100
  );

  assert.equal(
    monthlyCreated.bridgeResult.value.bankOutflowAmount,
    600
  );

  const monthlyReplay =
    await executePosMonthlyFeeFinance(
      monthlyFeeCommand,
      bridgeState()
    );

  assert.equal(
    monthlyReplay.persistenceResult.outcome,
    "REPLAY"
  );

  const createdTransaction =
    createPosTransaction(
      {
        context:
          context("create-pos-for-refund"),

        id: "pos-transaction-refund-source",
        posTransactionNumber:
          "POS-ISL-IADE-KAYNAK",

        contract: contract(),
        rule: rule(),

        saleId: "sale-refund",
        saleNumber: "SAT-IADE-0001",
        paymentId: "payment-refund",
        customerId: "customer-refund",

        grossAmount: 10000,
        installmentCount: 1,
        transactionDate: "2026-07-27",

        currency: "TRY",
        description:
          "İade kaynak POS tahsilatı"
      },
      state
    );

  const originalTransaction =
    createdTransaction.value.transaction;

  const refundOperation =
    refundPosTransaction(
      {
        context:
          context(
            "create-refund-operation",
            "2026-07-29T10:00:00.000Z"
          ),

        originalTransaction,

        refundTransactionId:
          "refund-transaction-1",
        refundTransactionNumber:
          "POS-IADE-0001",

        refundAmount: 10000,
        refundDate: "2026-07-29",

        bankMovementId:
          "bank-refund-operation-source",
        description:
          "Tam POS iadesi"
      },
      state
    );

  const refundCommand = {
    context:
      context(
        "execute-refund-finance",
        "2026-07-29T11:00:00.000Z"
      ),

    originalTransaction,

    refundTransaction:
      refundOperation.value.refundTransaction,

    documents: {
      bankMovementId:
        "bank-movement-refund-1",
      bankMovementNumber:
        "BNK-HRK-IADE-0001",

      journalEntryId:
        "journal-refund-1",
      journalNo:
        "FIS-POS-IADE-0001"
    },

    accounts,

    refundDate: "2026-07-29",
    description:
      "POS banka iadesi"
  };

  const refundCreated =
    await executePosRefundFinance(
      refundCommand,
      bridgeState()
    );

  assert.equal(
    refundCreated.persistenceResult.outcome,
    "CREATED"
  );

  assert.equal(
    refundCreated.bridgeResult.value.refundAmount,
    10000
  );

  assert.equal(
    refundCreated.bridgeResult.value.bankOutflowAmount,
    10000
  );

  const refundReplay =
    await executePosRefundFinance(
      refundCommand,
      bridgeState()
    );

  assert.equal(
    refundReplay.persistenceResult.outcome,
    "REPLAY"
  );

  assert.equal(
    await localFinanceJournalDb
      .bankMovements.count(),
    2
  );

  assert.equal(
    await localFinanceJournalDb.entries.count(),
    2
  );

  assert.equal(
    await localFinanceJournalDb.lines.count(),
    5
  );

  console.log(
    "[PASS] pos monthly fee and refund execution lifecycle"
  );

  await localFinanceJournalDb.close();
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
