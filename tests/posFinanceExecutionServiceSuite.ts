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
  createPosTransaction
} from "../src/lib/finance/posOperationsService";
import {
  executePosSettlementFinance
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
  idempotencyKey: string
): PosOperationContext {
  return {
    ...scope,
    userId: "admin",
    operationDate: "2026-07-28T01:00:00.000Z",
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

async function run(): Promise<void> {
  await localFinanceJournalDb.delete();
  await localFinanceJournalDb.open();

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
      operationState()
    );

  const transaction =
    createdTransaction.value.transaction;

  const schedule =
    createdTransaction.value.settlementSchedule;

  const scheduleLine = schedule.lines[0];

  const command = {
    context:
      context("execute-pos-settlement-1"),

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

    accounts: {
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
    },

    description:
      "Garanti POS banka geçişi"
  };

  const created =
    await executePosSettlementFinance(
      command,
      bridgeState()
    );

  assert.equal(
    created.persistenceResult.outcome,
    "CREATED"
  );

  assert.equal(
    created.bridgeResult.value.bankNetAmount,
    9700
  );

  assert.equal(
    created.bridgeResult.value.commissionAmount,
    300
  );

  assert.equal(
    await localFinanceJournalDb
      .bankMovements.count(),
    1
  );

  assert.equal(
    await localFinanceJournalDb.entries.count(),
    1
  );

  assert.equal(
    await localFinanceJournalDb.lines.count(),
    3
  );

  const replay =
    await executePosSettlementFinance(
      command,
      bridgeState()
    );

  assert.equal(
    replay.persistenceResult.outcome,
    "REPLAY"
  );

  assert.equal(
    await localFinanceJournalDb
      .bankMovements.count(),
    1
  );

  assert.equal(
    await localFinanceJournalDb.entries.count(),
    1
  );

  assert.equal(
    await localFinanceJournalDb.lines.count(),
    3
  );

  const storedMovement =
    await localFinanceJournalDb
      .bankMovements
      .get("bank-movement-settlement-1");

  assert.ok(storedMovement);

  assert.equal(
    storedMovement.bankAccountId,
    "bank-account-1"
  );

  assert.equal(
    storedMovement.netAmount,
    9700
  );

  assert.equal(
    storedMovement.feeAmount,
    300
  );

  console.log(
    "[PASS] pos finance execution settlement lifecycle"
  );

  await localFinanceJournalDb.close();
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
