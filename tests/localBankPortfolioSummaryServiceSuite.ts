import "fake-indexeddb/auto";

import type {
  BankMovement
} from "@/lib/finance/bankingContracts";
import {
  localFinanceJournalDb
} from "@/lib/finance/localFinanceJournalDb";
import {
  calculateLocalBankPortfolioSummary
} from "@/lib/finance/localBankPortfolioSummaryService";
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
    sourceDocumentType: "BANK_PORTFOLIO_TEST",
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
    description: "Toplu banka bakiye testi",
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
      typeof calculateLocalBankPortfolioSummary
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
      typeof calculateLocalBankPortfolioSummary
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
      id: "bank-1-try-in-1",
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
      id: "bank-1-try-out-1",
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
      id: "bank-1-try-in-2",
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
      id: "bank-1-try-out-2",
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
      id: "bank-2-try-in",
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
      id: "bank-2-try-out",
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
      id: "bank-1-usd-in",
      movementNumber: "BNK-007",
      bankAccountId: "bank-account-1",
      movementType: "EFT_IN",
      direction: "IN",
      grossAmount: 1000,
      netAmount: 1000,
      currency: "USD",
      transactionDate: "2026-07-28",
      createdAt: "2026-07-28T13:00:00.000Z"
    }),
    movement({
      id: "bank-1-usd-out",
      movementNumber: "BNK-008",
      bankAccountId: "bank-account-1",
      movementType: "EFT_OUT",
      direction: "OUT",
      grossAmount: 200,
      netAmount: 200,
      currency: "USD",
      transactionDate: "2026-07-28",
      createdAt: "2026-07-28T14:00:00.000Z"
    }),
    movement({
      id: "bank-2-try-later",
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
      createdAt: "2026-07-28T15:00:00.000Z"
    })
  ];

  await localFinanceJournalDb
    .bankMovements
    .bulkPut(movements);

  const asOfSummary =
    await calculateLocalBankPortfolioSummary({
      ...scopeA,
      asOfDate: "2026-07-28"
    });

  assertEqual(
    asOfSummary.totalAccountCount,
    3,
    "Tarih itibarıyla hesap ve para birimi grubu sayısı yanlış"
  );

  assertEqual(
    asOfSummary.totalMovementCount,
    8,
    "Tarih itibarıyla hareket sayısı yanlış"
  );

  const bank1Try =
    findAccount(
      asOfSummary.accounts,
      "bank-account-1",
      "TRY"
    );

  assertTrue(
    bank1Try !== undefined,
    "Banka 1 TRY özeti bulunamadı"
  );

  assertEqual(
    bank1Try?.totalInflow,
    7000,
    "Banka 1 TRY toplam girişi yanlış"
  );

  assertEqual(
    bank1Try?.totalOutflow,
    1300,
    "Banka 1 TRY toplam çıkışı yanlış"
  );

  assertEqual(
    bank1Try?.balance,
    5700,
    "Banka 1 TRY bakiyesi yanlış"
  );

  assertEqual(
    bank1Try?.movementCount,
    4,
    "Banka 1 TRY hareket sayısı yanlış"
  );

  const bank2Try =
    findAccount(
      asOfSummary.accounts,
      "bank-account-2",
      "TRY"
    );

  assertTrue(
    bank2Try !== undefined,
    "Banka 2 TRY özeti bulunamadı"
  );

  assertEqual(
    bank2Try?.totalInflow,
    10000,
    "Banka 2 TRY toplam girişi yanlış"
  );

  assertEqual(
    bank2Try?.totalOutflow,
    2500,
    "Banka 2 TRY toplam çıkışı yanlış"
  );

  assertEqual(
    bank2Try?.balance,
    7500,
    "Banka 2 TRY bakiyesi yanlış"
  );

  const bank1Usd =
    findAccount(
      asOfSummary.accounts,
      "bank-account-1",
      "USD"
    );

  assertTrue(
    bank1Usd !== undefined,
    "Banka 1 USD özeti bulunamadı"
  );

  assertEqual(
    bank1Usd?.balance,
    800,
    "Banka 1 USD bakiyesi yanlış"
  );

  const trySummary =
    findCurrency(
      asOfSummary.currencies,
      "TRY"
    );

  assertTrue(
    trySummary !== undefined,
    "TRY portföy özeti bulunamadı"
  );

  assertEqual(
    trySummary?.totalInflow,
    17000,
    "TRY portföy toplam girişi yanlış"
  );

  assertEqual(
    trySummary?.totalOutflow,
    3800,
    "TRY portföy toplam çıkışı yanlış"
  );

  assertEqual(
    trySummary?.balance,
    13200,
    "TRY portföy bakiyesi yanlış"
  );

  assertEqual(
    trySummary?.accountCount,
    2,
    "TRY hesap sayısı yanlış"
  );

  assertEqual(
    trySummary?.movementCount,
    6,
    "TRY hareket sayısı yanlış"
  );

  const usdSummary =
    findCurrency(
      asOfSummary.currencies,
      "USD"
    );

  assertTrue(
    usdSummary !== undefined,
    "USD portföy özeti bulunamadı"
  );

  assertEqual(
    usdSummary?.balance,
    800,
    "USD portföy bakiyesi yanlış"
  );

  assertEqual(
    usdSummary?.accountCount,
    1,
    "USD hesap sayısı yanlış"
  );

  const allDates =
    await calculateLocalBankPortfolioSummary({
      ...scopeA
    });

  const allDatesBank2Try =
    findAccount(
      allDates.accounts,
      "bank-account-2",
      "TRY"
    );

  assertEqual(
    allDatesBank2Try?.totalInflow,
    10700,
    "İleri tarihli banka girişi genel özete eklenmedi"
  );

  assertEqual(
    allDatesBank2Try?.balance,
    8200,
    "Banka 2 tüm tarihler bakiyesi yanlış"
  );

  const allDatesTry =
    findCurrency(
      allDates.currencies,
      "TRY"
    );

  assertEqual(
    allDatesTry?.balance,
    13900,
    "Tüm tarihler TRY portföy bakiyesi yanlış"
  );

  assertEqual(
    allDates.totalMovementCount,
    9,
    "Tüm tarihler hareket sayısı yanlış"
  );

  const tryOnly =
    await calculateLocalBankPortfolioSummary({
      ...scopeA,
      currency: "TRY",
      asOfDate: "2026-07-28"
    });

  assertEqual(
    tryOnly.totalAccountCount,
    2,
    "TRY filtresi hesap sayısı yanlış"
  );

  assertEqual(
    tryOnly.currencies.length,
    1,
    "TRY filtresinde başka para birimi karıştı"
  );

  assertEqual(
    tryOnly.currencies[0]?.currency,
    "TRY",
    "TRY filtresi yanlış para birimi döndürdü"
  );

  const companyB =
    await calculateLocalBankPortfolioSummary({
      ...scopeB
    });

  assertEqual(
    companyB.totalAccountCount,
    1,
    "Şirket B hesap sayısı yanlış"
  );

  assertEqual(
    companyB.totalMovementCount,
    1,
    "Şirket B hareket sayısı yanlış"
  );

  assertEqual(
    companyB.accounts[0]?.balance,
    99999,
    "Şirket B bakiyesi yanlış"
  );

  assertTrue(
    asOfSummary.accounts.every(
      account =>
        account.balance !== 99999
    ),
    "Başka şirket bakiyesi Şirket A portföyüne karıştı"
  );

  await localFinanceJournalDb.delete();

  console.log(
    "BANK_PORTFOLIO_SUMMARY_TEST: PAK"
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
