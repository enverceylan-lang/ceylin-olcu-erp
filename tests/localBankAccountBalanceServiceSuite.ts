import "fake-indexeddb/auto";

import type {
  BankMovement
} from "@/lib/finance/bankingContracts";
import {
  calculateLocalBankAccountBalance,
  calculateLocalBankAccountDailySummary
} from "@/lib/finance/localBankAccountBalanceService";
import {
  localFinanceJournalDb
} from "@/lib/finance/localFinanceJournalDb";
import type {
  ErpScope
} from "@/lib/erpScope";

const scopeA: ErpScope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-2026"
};

const scopeB: ErpScope = {
  tenantId: "tenant-1",
  companyId: "company-2",
  branchId: "branch-2",
  accountingPeriodId: "period-2026"
};

function assertEqual<T>(
  actual: T,
  expected: T,
  message: string
): void {
  if (actual !== expected) {
    throw new Error(
      `${message} | expected=${String(expected)} actual=${String(actual)}`
    );
  }
}

function movement(
  overrides: Partial<BankMovement> = {}
): BankMovement {
  const base: BankMovement = {
    ...scopeA,

    id: "movement-base",
    movementNumber: "BNK-HRK-BASE",
    bankAccountId: "bank-account-1",

    movementType: "OTHER_IN",
    direction: "IN",

    sourceModule: "FINANCE",
    sourceDocumentType: "BANK_BALANCE_TEST",
    sourceDocumentId: "document-base",
    sourceDocumentNumber: "TEST-BASE",

    customerId: null,
    supplierId: null,
    tailorId: null,
    installerId: null,

    grossAmount: 0,
    feeAmount: 0,
    netAmount: 0,
    currency: "TRY",

    transactionDate: "2026-07-28",
    valueDate: "2026-07-28",
    settlementDate: "2026-07-28",

    status: "SETTLED",
    description: "Banka bakiye testi",
    externalReference: null,

    createdBy: "admin",
    createdAt: "2026-07-28T00:00:00.000Z",

    reversedAt: null,
    reversalOfMovementId: null
  };

  return {
    ...base,
    ...overrides
  };
}

async function runSuite(): Promise<void> {
  await localFinanceJournalDb.delete();
  await localFinanceJournalDb.open();

  const movements: BankMovement[] = [
    movement({
      id: "opening-in",
      movementNumber: "BNK-001",
      movementType: "EFT_IN",
      direction: "IN",
      grossAmount: 5000,
      netAmount: 5000,
      transactionDate: "2026-07-27",
      createdAt: "2026-07-27T09:00:00.000Z"
    }),
    movement({
      id: "opening-out",
      movementNumber: "BNK-002",
      movementType: "EFT_OUT",
      direction: "OUT",
      grossAmount: 1000,
      netAmount: 1000,
      transactionDate: "2026-07-27",
      createdAt: "2026-07-27T10:00:00.000Z"
    }),
    movement({
      id: "daily-in",
      movementNumber: "BNK-003",
      movementType: "HAVALE_IN",
      direction: "IN",
      grossAmount: 2000,
      netAmount: 2000,
      transactionDate: "2026-07-28",
      createdAt: "2026-07-28T09:00:00.000Z"
    }),
    movement({
      id: "daily-out",
      movementNumber: "BNK-004",
      movementType: "BANK_FEE",
      direction: "OUT",
      grossAmount: 300,
      netAmount: 300,
      transactionDate: "2026-07-28",
      createdAt: "2026-07-28T10:00:00.000Z"
    }),
    movement({
      id: "later-in",
      movementNumber: "BNK-005",
      movementType: "FAST_IN",
      direction: "IN",
      grossAmount: 700,
      netAmount: 700,
      transactionDate: "2026-07-29",
      createdAt: "2026-07-29T09:00:00.000Z"
    }),
    movement({
      id: "other-bank",
      movementNumber: "BNK-006",
      bankAccountId: "bank-account-2",
      movementType: "EFT_IN",
      direction: "IN",
      grossAmount: 99999,
      netAmount: 99999,
      transactionDate: "2026-07-28",
      createdAt: "2026-07-28T11:00:00.000Z"
    }),
    movement({
      id: "other-currency",
      movementNumber: "BNK-007",
      currency: "USD",
      movementType: "EFT_IN",
      direction: "IN",
      grossAmount: 1000,
      netAmount: 1000,
      transactionDate: "2026-07-28",
      createdAt: "2026-07-28T12:00:00.000Z"
    }),
    movement({
      ...scopeB,
      id: "other-company",
      movementNumber: "BNK-B-001",
      bankAccountId: "bank-account-1",
      movementType: "EFT_IN",
      direction: "IN",
      grossAmount: 88888,
      netAmount: 88888,
      transactionDate: "2026-07-28",
      createdAt: "2026-07-28T13:00:00.000Z"
    })
  ];

  await localFinanceJournalDb
    .bankMovements
    .bulkPut(movements);

  const asOfOpening =
    await calculateLocalBankAccountBalance({
      ...scopeA,
      bankAccountId: "bank-account-1",
      currency: "TRY",
      asOfDate: "2026-07-27"
    });

  assertEqual(
    asOfOpening.totalInflow,
    5000,
    "Açılış tarihine kadar toplam giriş yanlış"
  );

  assertEqual(
    asOfOpening.totalOutflow,
    1000,
    "Açılış tarihine kadar toplam çıkış yanlış"
  );

  assertEqual(
    asOfOpening.balance,
    4000,
    "Açılış bakiyesi yanlış"
  );

  assertEqual(
    asOfOpening.movementCount,
    2,
    "Açılış hareket sayısı yanlış"
  );

  const daily =
    await calculateLocalBankAccountDailySummary({
      ...scopeA,
      bankAccountId: "bank-account-1",
      currency: "TRY",
      transactionDate: "2026-07-28"
    });

  assertEqual(
    daily.openingBalance,
    4000,
    "Gün başı bakiyesi yanlış"
  );

  assertEqual(
    daily.dailyInflow,
    2000,
    "Günlük giriş yanlış"
  );

  assertEqual(
    daily.dailyOutflow,
    300,
    "Günlük çıkış yanlış"
  );

  assertEqual(
    daily.dailyNetMovement,
    1700,
    "Günlük net hareket yanlış"
  );

  assertEqual(
    daily.closingBalance,
    5700,
    "Gün sonu bakiyesi yanlış"
  );

  assertEqual(
    daily.dailyMovementCount,
    2,
    "Günlük hareket sayısı yanlış"
  );

  const allDates =
    await calculateLocalBankAccountBalance({
      ...scopeA,
      bankAccountId: "bank-account-1",
      currency: "TRY"
    });

  assertEqual(
    allDates.totalInflow,
    7700,
    "Tüm tarihler toplam girişi yanlış"
  );

  assertEqual(
    allDates.totalOutflow,
    1300,
    "Tüm tarihler toplam çıkışı yanlış"
  );

  assertEqual(
    allDates.balance,
    6400,
    "Tüm tarihler bakiyesi yanlış"
  );

  assertEqual(
    allDates.movementCount,
    5,
    "Tüm tarihler hareket sayısı yanlış"
  );

  const otherBank =
    await calculateLocalBankAccountBalance({
      ...scopeA,
      bankAccountId: "bank-account-2",
      currency: "TRY"
    });

  assertEqual(
    otherBank.balance,
    99999,
    "Diğer banka hesabı bakiyesi yanlış"
  );

  assertEqual(
    otherBank.movementCount,
    1,
    "Diğer banka hesabı hareket sayısı yanlış"
  );

  const usdBalance =
    await calculateLocalBankAccountBalance({
      ...scopeA,
      bankAccountId: "bank-account-1",
      currency: "USD"
    });

  assertEqual(
    usdBalance.balance,
    1000,
    "USD bakiye yanlış"
  );

  assertEqual(
    usdBalance.movementCount,
    1,
    "USD hareket sayısı yanlış"
  );

  const companyB =
    await calculateLocalBankAccountBalance({
      ...scopeB,
      bankAccountId: "bank-account-1",
      currency: "TRY"
    });

  assertEqual(
    companyB.balance,
    88888,
    "Şirket B bakiyesi yanlış"
  );

  assertEqual(
    companyB.movementCount,
    1,
    "Şirket B hareket sayısı yanlış"
  );

  await localFinanceJournalDb.delete();

  console.log(
    "BANK_ACCOUNT_BALANCE_DAILY_SUMMARY_TEST: PAK"
  );
}

runSuite().catch(async error => {
  console.error(error);

  try {
    await localFinanceJournalDb.delete();
  } catch {
    // Test temizliği ana hatayı gölgelememelidir.
  }

  process.exitCode = 1;
});
