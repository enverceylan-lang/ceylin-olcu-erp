import "fake-indexeddb/auto";

import type {
  BankMovement
} from "@/lib/finance/bankingContracts";
import {
  calculateLocalBankDailyDashboard
} from "@/lib/finance/localBankDailyDashboardService";
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

function assertTrue(
  condition: boolean,
  message: string
): void {
  if (!condition) {
    throw new Error(message);
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
    sourceDocumentType: "BANK_DAILY_DASHBOARD_TEST",
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
    description: "Banka günlük panel testi",
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

function findAccount(
  accounts: Awaited<
    ReturnType<
      typeof calculateLocalBankDailyDashboard
    >
  >["accounts"],
  bankAccountId: string,
  currency: string
) {
  return accounts.find(
    account =>
      account.bankAccountId === bankAccountId &&
      account.currency === currency
  );
}

function findCurrency(
  currencies: Awaited<
    ReturnType<
      typeof calculateLocalBankDailyDashboard
    >
  >["currencies"],
  currency: string
) {
  return currencies.find(
    item => item.currency === currency
  );
}

async function runSuite(): Promise<void> {
  await localFinanceJournalDb.delete();
  await localFinanceJournalDb.open();

  const movements: BankMovement[] = [
    movement({
      id: "bank-1-try-opening-in",
      movementNumber: "BNK-001",
      bankAccountId: "bank-account-1",
      movementType: "EFT_IN",
      direction: "IN",
      grossAmount: 5000,
      netAmount: 5000,
      currency: "TRY",
      transactionDate: "2026-07-27",
      createdAt: "2026-07-27T09:00:00.000Z"
    }),
    movement({
      id: "bank-1-try-opening-out",
      movementNumber: "BNK-002",
      bankAccountId: "bank-account-1",
      movementType: "EFT_OUT",
      direction: "OUT",
      grossAmount: 1000,
      netAmount: 1000,
      currency: "TRY",
      transactionDate: "2026-07-27",
      createdAt: "2026-07-27T10:00:00.000Z"
    }),
    movement({
      id: "bank-1-try-daily-in",
      movementNumber: "BNK-003",
      bankAccountId: "bank-account-1",
      movementType: "HAVALE_IN",
      direction: "IN",
      grossAmount: 2000,
      netAmount: 2000,
      currency: "TRY",
      transactionDate: "2026-07-28",
      createdAt: "2026-07-28T09:00:00.000Z"
    }),
    movement({
      id: "bank-1-try-daily-out",
      movementNumber: "BNK-004",
      bankAccountId: "bank-account-1",
      movementType: "BANK_FEE",
      direction: "OUT",
      grossAmount: 300,
      netAmount: 300,
      currency: "TRY",
      transactionDate: "2026-07-28",
      createdAt: "2026-07-28T10:00:00.000Z"
    }),
    movement({
      id: "bank-2-try-daily-in",
      movementNumber: "BNK-005",
      bankAccountId: "bank-account-2",
      movementType: "POS_SETTLEMENT",
      direction: "IN",
      grossAmount: 10000,
      netAmount: 10000,
      currency: "TRY",
      transactionDate: "2026-07-28",
      createdAt: "2026-07-28T11:00:00.000Z"
    }),
    movement({
      id: "bank-2-try-daily-out",
      movementNumber: "BNK-006",
      bankAccountId: "bank-account-2",
      movementType: "POS_COMMISSION",
      direction: "OUT",
      grossAmount: 2500,
      netAmount: 2500,
      currency: "TRY",
      transactionDate: "2026-07-28",
      createdAt: "2026-07-28T12:00:00.000Z"
    }),
    movement({
      id: "bank-1-usd-opening-in",
      movementNumber: "BNK-007",
      bankAccountId: "bank-account-1",
      movementType: "EFT_IN",
      direction: "IN",
      grossAmount: 1000,
      netAmount: 1000,
      currency: "USD",
      transactionDate: "2026-07-27",
      createdAt: "2026-07-27T13:00:00.000Z"
    }),
    movement({
      id: "bank-1-usd-daily-out",
      movementNumber: "BNK-008",
      bankAccountId: "bank-account-1",
      movementType: "EFT_OUT",
      direction: "OUT",
      grossAmount: 200,
      netAmount: 200,
      currency: "USD",
      transactionDate: "2026-07-28",
      createdAt: "2026-07-28T13:00:00.000Z"
    }),
    movement({
      id: "future-movement",
      movementNumber: "BNK-009",
      bankAccountId: "bank-account-2",
      movementType: "FAST_IN",
      direction: "IN",
      grossAmount: 700,
      netAmount: 700,
      currency: "TRY",
      transactionDate: "2026-07-29",
      createdAt: "2026-07-29T09:00:00.000Z"
    }),
    movement({
      ...scopeB,
      id: "other-company",
      movementNumber: "BNK-B-001",
      bankAccountId: "bank-account-1",
      movementType: "EFT_IN",
      direction: "IN",
      grossAmount: 99999,
      netAmount: 99999,
      currency: "TRY",
      transactionDate: "2026-07-28",
      createdAt: "2026-07-28T14:00:00.000Z"
    })
  ];

  await localFinanceJournalDb
    .bankMovements
    .bulkPut(movements);

  const dashboard =
    await calculateLocalBankDailyDashboard({
      ...scopeA,
      transactionDate: "2026-07-28"
    });

  assertEqual(
    dashboard.totalAccountCount,
    3,
    "Hesap ve para birimi grubu sayısı yanlış"
  );

  assertEqual(
    dashboard.totalDailyMovementCount,
    5,
    "Toplam günlük hareket sayısı yanlış"
  );

  const bank1Try =
    findAccount(
      dashboard.accounts,
      "bank-account-1",
      "TRY"
    );

  assertTrue(
    bank1Try !== undefined,
    "Banka 1 TRY günlük özeti bulunamadı"
  );

  assertEqual(
    bank1Try?.openingBalance,
    4000,
    "Banka 1 TRY gün başı bakiyesi yanlış"
  );

  assertEqual(
    bank1Try?.dailyInflow,
    2000,
    "Banka 1 TRY günlük girişi yanlış"
  );

  assertEqual(
    bank1Try?.dailyOutflow,
    300,
    "Banka 1 TRY günlük çıkışı yanlış"
  );

  assertEqual(
    bank1Try?.dailyNetMovement,
    1700,
    "Banka 1 TRY günlük net hareketi yanlış"
  );

  assertEqual(
    bank1Try?.closingBalance,
    5700,
    "Banka 1 TRY gün sonu bakiyesi yanlış"
  );

  assertEqual(
    bank1Try?.openingMovementCount,
    2,
    "Banka 1 TRY açılış hareket sayısı yanlış"
  );

  assertEqual(
    bank1Try?.dailyMovementCount,
    2,
    "Banka 1 TRY günlük hareket sayısı yanlış"
  );

  const bank2Try =
    findAccount(
      dashboard.accounts,
      "bank-account-2",
      "TRY"
    );

  assertTrue(
    bank2Try !== undefined,
    "Banka 2 TRY günlük özeti bulunamadı"
  );

  assertEqual(
    bank2Try?.openingBalance,
    0,
    "Banka 2 TRY gün başı bakiyesi yanlış"
  );

  assertEqual(
    bank2Try?.dailyInflow,
    10000,
    "Banka 2 TRY günlük girişi yanlış"
  );

  assertEqual(
    bank2Try?.dailyOutflow,
    2500,
    "Banka 2 TRY günlük çıkışı yanlış"
  );

  assertEqual(
    bank2Try?.dailyNetMovement,
    7500,
    "Banka 2 TRY günlük net hareketi yanlış"
  );

  assertEqual(
    bank2Try?.closingBalance,
    7500,
    "Banka 2 TRY gün sonu bakiyesi yanlış"
  );

  const bank1Usd =
    findAccount(
      dashboard.accounts,
      "bank-account-1",
      "USD"
    );

  assertTrue(
    bank1Usd !== undefined,
    "Banka 1 USD günlük özeti bulunamadı"
  );

  assertEqual(
    bank1Usd?.openingBalance,
    1000,
    "Banka 1 USD gün başı bakiyesi yanlış"
  );

  assertEqual(
    bank1Usd?.dailyInflow,
    0,
    "Banka 1 USD günlük girişi yanlış"
  );

  assertEqual(
    bank1Usd?.dailyOutflow,
    200,
    "Banka 1 USD günlük çıkışı yanlış"
  );

  assertEqual(
    bank1Usd?.closingBalance,
    800,
    "Banka 1 USD gün sonu bakiyesi yanlış"
  );

  const trySummary =
    findCurrency(
      dashboard.currencies,
      "TRY"
    );

  assertTrue(
    trySummary !== undefined,
    "TRY günlük portföy özeti bulunamadı"
  );

  assertEqual(
    trySummary?.openingBalance,
    4000,
    "TRY toplam gün başı bakiyesi yanlış"
  );

  assertEqual(
    trySummary?.dailyInflow,
    12000,
    "TRY toplam günlük girişi yanlış"
  );

  assertEqual(
    trySummary?.dailyOutflow,
    2800,
    "TRY toplam günlük çıkışı yanlış"
  );

  assertEqual(
    trySummary?.dailyNetMovement,
    9200,
    "TRY toplam günlük net hareketi yanlış"
  );

  assertEqual(
    trySummary?.closingBalance,
    13200,
    "TRY toplam gün sonu bakiyesi yanlış"
  );

  assertEqual(
    trySummary?.accountCount,
    2,
    "TRY hesap sayısı yanlış"
  );

  assertEqual(
    trySummary?.dailyMovementCount,
    4,
    "TRY günlük hareket sayısı yanlış"
  );

  const usdSummary =
    findCurrency(
      dashboard.currencies,
      "USD"
    );

  assertTrue(
    usdSummary !== undefined,
    "USD günlük portföy özeti bulunamadı"
  );

  assertEqual(
    usdSummary?.openingBalance,
    1000,
    "USD toplam gün başı bakiyesi yanlış"
  );

  assertEqual(
    usdSummary?.dailyOutflow,
    200,
    "USD toplam günlük çıkışı yanlış"
  );

  assertEqual(
    usdSummary?.closingBalance,
    800,
    "USD toplam gün sonu bakiyesi yanlış"
  );

  const tryOnly =
    await calculateLocalBankDailyDashboard({
      ...scopeA,
      transactionDate: "2026-07-28",
      currency: "TRY"
    });

  assertEqual(
    tryOnly.totalAccountCount,
    2,
    "TRY filtresi hesap sayısı yanlış"
  );

  assertEqual(
    tryOnly.currencies.length,
    1,
    "TRY filtresine başka para birimi karıştı"
  );

  const bank1Only =
    await calculateLocalBankDailyDashboard({
      ...scopeA,
      transactionDate: "2026-07-28",
      bankAccountId: "bank-account-1",
      currency: "TRY"
    });

  assertEqual(
    bank1Only.totalAccountCount,
    1,
    "Banka hesabı filtresi yanlış"
  );

  assertEqual(
    bank1Only.accounts[0]?.closingBalance,
    5700,
    "Banka hesabı filtreli gün sonu bakiyesi yanlış"
  );

  const companyB =
    await calculateLocalBankDailyDashboard({
      ...scopeB,
      transactionDate: "2026-07-28"
    });

  assertEqual(
    companyB.totalAccountCount,
    1,
    "Şirket B hesap sayısı yanlış"
  );

  assertEqual(
    companyB.totalDailyMovementCount,
    1,
    "Şirket B günlük hareket sayısı yanlış"
  );

  assertEqual(
    companyB.accounts[0]?.closingBalance,
    99999,
    "Şirket B gün sonu bakiyesi yanlış"
  );

  assertTrue(
    dashboard.accounts.every(
      account =>
        account.closingBalance !== 99999
    ),
    "Başka şirket bakiyesi Şirket A paneline karıştı"
  );

  assertTrue(
    dashboard.accounts.every(
      account =>
        account.closingBalance !== 13900
    ),
    "İleri tarihli hareket günlük panele karıştı"
  );

  await localFinanceJournalDb.delete();

  console.log(
    "BANK_DAILY_DASHBOARD_TEST: PAK"
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
