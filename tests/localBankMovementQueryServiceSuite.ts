import "fake-indexeddb/auto";

import type {
  BankMovement
} from "@/lib/finance/bankingContracts";
import {
  localFinanceJournalDb
} from "@/lib/finance/localFinanceJournalDb";
import {
  queryLocalBankMovements
} from "@/lib/finance/localBankMovementQueryService";
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
    sourceDocumentType: "BANK_TEST",
    sourceDocumentId: "document-base",
    sourceDocumentNumber: "TEST-BASE",

    customerId: "customer-1",
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
    description: "Banka sorgu testi",
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
      id: "eft-in",
      movementNumber: "BNK-001",
      movementType: "EFT_IN",
      direction: "IN",
      netAmount: 1000,
      grossAmount: 1000,
      transactionDate: "2026-07-27",
      createdAt: "2026-07-27T09:00:00.000Z"
    }),
    movement({
      id: "eft-out",
      movementNumber: "BNK-002",
      movementType: "EFT_OUT",
      direction: "OUT",
      netAmount: 200,
      grossAmount: 200,
      transactionDate: "2026-07-28",
      createdAt: "2026-07-28T09:00:00.000Z"
    }),
    movement({
      id: "havale-in",
      movementNumber: "BNK-003",
      movementType: "HAVALE_IN",
      direction: "IN",
      netAmount: 300,
      grossAmount: 300,
      transactionDate: "2026-07-28",
      createdAt: "2026-07-28T10:00:00.000Z"
    }),
    movement({
      id: "havale-out-bank-2",
      movementNumber: "BNK-004",
      bankAccountId: "bank-account-2",
      movementType: "HAVALE_OUT",
      direction: "OUT",
      netAmount: 50,
      grossAmount: 50,
      transactionDate: "2026-07-28",
      createdAt: "2026-07-28T11:00:00.000Z"
    }),
    movement({
      id: "fast-in",
      movementNumber: "BNK-005",
      movementType: "FAST_IN",
      direction: "IN",
      netAmount: 400,
      grossAmount: 400,
      transactionDate: "2026-07-29",
      createdAt: "2026-07-29T09:00:00.000Z"
    }),
    movement({
      id: "fast-out",
      movementNumber: "BNK-006",
      movementType: "FAST_OUT",
      direction: "OUT",
      netAmount: 100,
      grossAmount: 100,
      transactionDate: "2026-07-29",
      createdAt: "2026-07-29T10:00:00.000Z"
    }),
    movement({
      id: "pos-settlement",
      movementNumber: "BNK-007",
      movementType: "POS_SETTLEMENT",
      direction: "IN",
      sourceModule: "POS",
      sourceDocumentType: "POS_SETTLEMENT",
      sourceDocumentId: "settlement-1",
      sourceDocumentNumber: "POS-GEC-0001",
      grossAmount: 10000,
      feeAmount: 300,
      netAmount: 9700,
      transactionDate: "2026-07-28",
      createdAt: "2026-07-28T12:00:00.000Z"
    }),
    movement({
      id: "pos-commission",
      movementNumber: "BNK-008",
      movementType: "POS_COMMISSION",
      direction: "OUT",
      sourceModule: "POS",
      sourceDocumentType: "POS_COMMISSION",
      sourceDocumentId: "settlement-1",
      sourceDocumentNumber: "POS-KOM-0001",
      grossAmount: 300,
      feeAmount: 300,
      netAmount: 300,
      transactionDate: "2026-07-28",
      createdAt: "2026-07-28T13:00:00.000Z"
    }),
    movement({
      id: "bank-fee",
      movementNumber: "BNK-009",
      movementType: "BANK_FEE",
      direction: "OUT",
      netAmount: 25,
      grossAmount: 25,
      transactionDate: "2026-07-28",
      createdAt: "2026-07-28T14:00:00.000Z"
    }),
    movement({
      id: "other-in",
      movementNumber: "BNK-010",
      movementType: "OTHER_IN",
      direction: "IN",
      netAmount: 40,
      grossAmount: 40,
      transactionDate: "2026-07-28",
      createdAt: "2026-07-28T15:00:00.000Z"
    }),
    movement({
      ...scopeB,
      id: "other-company",
      movementNumber: "BNK-B-001",
      bankAccountId: "bank-account-company-2",
      movementType: "EFT_IN",
      direction: "IN",
      netAmount: 999999,
      grossAmount: 999999,
      transactionDate: "2026-07-28",
      createdAt: "2026-07-28T16:00:00.000Z"
    })
  ];

  await localFinanceJournalDb
    .bankMovements
    .bulkPut(movements);

  const allScopeA =
    await queryLocalBankMovements({
      ...scopeA
    });

  assertEqual(
    allScopeA.totalCount,
    10,
    "Şirket A yalnız kendi 10 hareketini görmeli"
  );

  assertTrue(
    allScopeA.movements.every(
      item =>
        item.companyId ===
        scopeA.companyId
    ),
    "Başka şirket hareketi sonuçlara karışmamalı"
  );

  assertEqual(
    allScopeA.summary.totalInflow,
    11440,
    "Toplam banka girişi yanlış"
  );

  assertEqual(
    allScopeA.summary.totalOutflow,
    675,
    "Toplam banka çıkışı yanlış"
  );

  assertEqual(
    allScopeA.summary.netMovement,
    10765,
    "Net banka hareketi yanlış"
  );

  assertEqual(
    allScopeA.summary.eftIn,
    1000,
    "EFT giriş özeti yanlış"
  );

  assertEqual(
    allScopeA.summary.eftOut,
    200,
    "EFT çıkış özeti yanlış"
  );

  assertEqual(
    allScopeA.summary.havaleIn,
    300,
    "Havale giriş özeti yanlış"
  );

  assertEqual(
    allScopeA.summary.havaleOut,
    50,
    "Havale çıkış özeti yanlış"
  );

  assertEqual(
    allScopeA.summary.fastIn,
    400,
    "FAST giriş özeti yanlış"
  );

  assertEqual(
    allScopeA.summary.fastOut,
    100,
    "FAST çıkış özeti yanlış"
  );

  assertEqual(
    allScopeA.summary.posSettlementIn,
    9700,
    "POS banka geçiş özeti yanlış"
  );

  assertEqual(
    allScopeA.summary.posCommissionOut,
    300,
    "POS komisyon özeti yanlış"
  );

  assertEqual(
    allScopeA.summary.bankFeesOut,
    25,
    "Banka gideri özeti yanlış"
  );

  assertEqual(
    allScopeA.summary.otherIn,
    40,
    "Diğer giriş özeti yanlış"
  );

  const bankOneOnly =
    await queryLocalBankMovements({
      ...scopeA,
      bankAccountId: "bank-account-1"
    });

  assertEqual(
    bankOneOnly.totalCount,
    9,
    "Banka hesabı filtresi yanlış"
  );

  assertEqual(
    bankOneOnly.summary.havaleOut,
    0,
    "Başka banka hesabının havale çıkışı karıştı"
  );

  assertEqual(
    bankOneOnly.summary.totalOutflow,
    625,
    "Banka hesabı çıkış özeti yanlış"
  );

  const dateRange =
    await queryLocalBankMovements({
      ...scopeA,
      dateFrom: "2026-07-28",
      dateTo: "2026-07-28"
    });

  assertEqual(
    dateRange.totalCount,
    7,
    "Tarih aralığı filtresi yanlış"
  );

  assertEqual(
    dateRange.summary.totalInflow,
    10040,
    "Tarih aralığı toplam girişi yanlış"
  );

  assertEqual(
    dateRange.summary.totalOutflow,
    575,
    "Tarih aralığı toplam çıkışı yanlış"
  );

  const limited =
    await queryLocalBankMovements({
      ...scopeA,
      dateFrom: "2026-07-28",
      dateTo: "2026-07-28",
      limit: 2
    });

  assertEqual(
    limited.movements.length,
    2,
    "Limit sonuç listesini iki kayıtla sınırlamalı"
  );

  assertEqual(
    limited.totalCount,
    7,
    "Limit toplam kayıt sayısını değiştirmemeli"
  );

  assertEqual(
    limited.summary.totalInflow,
    10040,
    "Limit özet toplamını daraltmamalı"
  );

  assertEqual(
    limited.movements[0]?.id,
    "other-in",
    "Sonuçlar tarih ve oluşturulma zamanına göre tersten sıralanmalı"
  );

  assertEqual(
    limited.movements[1]?.id,
    "bank-fee",
    "İkinci hareket sıralaması yanlış"
  );

  const companyB =
    await queryLocalBankMovements({
      ...scopeB
    });

  assertEqual(
    companyB.totalCount,
    1,
    "Şirket B yalnız kendi hareketini görmeli"
  );

  assertEqual(
    companyB.summary.totalInflow,
    999999,
    "Şirket B özeti yanlış"
  );

  assertEqual(
    companyB.movements[0]?.id,
    "other-company",
    "Şirket B hareketi yanlış"
  );

  await localFinanceJournalDb.delete();

  console.log(
    "BANK_MOVEMENT_QUERY_REPORT_TEST: PAK"
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
