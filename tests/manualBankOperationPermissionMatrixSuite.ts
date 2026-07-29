import type {
  ManualBankOperationCommand,
  ManualBankOperationPermission
} from "@/lib/finance/manualBankOperationContracts";
import {
  createManualBankOperationPlan
} from "@/lib/finance/manualBankOperationService";

interface MatrixCase {
  channel:
    ManualBankOperationCommand["channel"];
  direction:
    ManualBankOperationCommand["direction"];
  permission:
    ManualBankOperationPermission;
  movementType:
    ReturnType<
      typeof createManualBankOperationPlan
    >["movementType"];
}

const matrix: MatrixCase[] = [
  {
    channel: "EFT",
    direction: "IN",
    permission: "BANK_EFT_IN",
    movementType: "EFT_IN"
  },
  {
    channel: "EFT",
    direction: "OUT",
    permission: "BANK_EFT_OUT",
    movementType: "EFT_OUT"
  },
  {
    channel: "HAVALE",
    direction: "IN",
    permission: "BANK_HAVALE_IN",
    movementType: "HAVALE_IN"
  },
  {
    channel: "HAVALE",
    direction: "OUT",
    permission: "BANK_HAVALE_OUT",
    movementType: "HAVALE_OUT"
  },
  {
    channel: "FAST",
    direction: "IN",
    permission: "BANK_FAST_IN",
    movementType: "FAST_IN"
  },
  {
    channel: "FAST",
    direction: "OUT",
    permission: "BANK_FAST_OUT",
    movementType: "FAST_OUT"
  }
];

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

function assertPermissionDenied(
  command: ManualBankOperationCommand,
  expectedPermission: ManualBankOperationPermission
): void {
  let actualMessage = "";

  try {
    createManualBankOperationPlan(command);
  } catch (error) {
    actualMessage =
      error instanceof Error
        ? error.message
        : String(error);
  }

  const expectedMessage =
    `MANUAL_BANK_OPERATION_PERMISSION_DENIED:${expectedPermission}`;

  assertEqual(
    actualMessage,
    expectedMessage,
    `${expectedPermission} yetki reddi yanlış`
  );
}

function commandFor(
  item: MatrixCase,
  index: number,
  permissions:
    readonly ManualBankOperationPermission[]
): ManualBankOperationCommand {
  return {
    tenantId: "tenant-1",
    companyId: "company-1",
    branchId: "branch-1",
    accountingPeriodId: "period-2026",

    transactionId:
      `transaction-${index}`,

    idempotencyKey:
      `manual-bank-operation-${index}`,

    channel: item.channel,
    direction: item.direction,

    bankAccountId:
      "bank-account-1",

    bankLedgerAccountId:
      "ledger-bank-1",

    counterpartyLedgerAccountId:
      "ledger-counterparty-1",

    amount: 100 + index,
    currency: "TRY",

    transactionDate: "2026-07-28",

    movementId:
      `movement-${index}`,

    movementNumber:
      `BNK-HRK-${index}`,

    journalEntryId:
      `journal-${index}`,

    journalNumber:
      `FIS-${index}`,

    sourceDocumentId:
      `source-${index}`,

    sourceDocumentNumber:
      `SRC-${index}`,

    firstJournalLineId:
      `line-${index}-1`,

    secondJournalLineId:
      `line-${index}-2`,

    grantedPermissions:
      permissions,

    createdBy: "admin",
    createdAt:
      "2026-07-28T10:00:00.000Z"
  };
}

function runSuite(): void {
  assertEqual(
    matrix.length,
    6,
    "Yetki matrisi altı kombinasyon içermeli"
  );

  matrix.forEach((item, index) => {
    const plan =
      createManualBankOperationPlan(
        commandFor(
          item,
          index + 1,
          [item.permission]
        )
      );

    assertEqual(
      plan.requiredPermission,
      item.permission,
      `${item.channel} ${item.direction} gerekli yetkisi yanlış`
    );

    assertEqual(
      plan.movementType,
      item.movementType,
      `${item.channel} ${item.direction} hareket tipi yanlış`
    );

    assertEqual(
      plan.bankMovement.direction,
      item.direction,
      `${item.channel} ${item.direction} yönü yanlış`
    );

    const wrongPermission =
      matrix.find(
        candidate =>
          candidate.permission !==
          item.permission
      )?.permission;

    if (!wrongPermission) {
      throw new Error(
        "Yanlış yetki örneği bulunamadı"
      );
    }

    assertPermissionDenied(
      commandFor(
        item,
        index + 20,
        [wrongPermission]
      ),
      item.permission
    );
  });

  console.log(
    "MANUAL_BANK_PERMISSION_MATRIX_TEST: PAK"
  );
}

runSuite();
