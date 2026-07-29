import type {
  BankMovement
} from "@/lib/finance/bankingContracts";
import type {
  FinanceJournalLine,
  FinanceJournalPosting
} from "@/lib/finance/financeJournalContracts";
import type {
  PosSettlementScheduleLine
} from "@/lib/finance/posContracts";
import type {
  PosOperationContext
} from "@/lib/finance/posOperationsContracts";
import type {
  CreatePosMonthlyFeeFinanceCommand,
  CreatePosMonthlyFeeFinanceResult,
  CreatePosRefundFinanceCommand,
  CreatePosRefundFinanceResult,
  CreatePosSettlementFinanceCommand,
  CreatePosSettlementFinanceResult,
  PosFinanceBridgeState,
  PosFinanceBridgeWriteResult
} from "@/lib/finance/posFinanceBridgeContracts";

const MONEY_EPSILON = 0.000001;

interface ScopedRecord {
  tenantId: string;
  companyId: string;
  branchId: string;
  accountingPeriodId: string;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function assertRequired(
  value: string,
  errorCode: string
): void {
  if (value.trim().length === 0) {
    throw new Error(errorCode);
  }
}

function assertIsoDate(value: string): void {
  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    value.length !== 10 ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new Error(
      "POS_FINANCE_BRIDGE_DATE_INVALID"
    );
  }
}

function sameScope(
  context: PosOperationContext,
  record: ScopedRecord
): boolean {
  return (
    context.tenantId === record.tenantId &&
    context.companyId === record.companyId &&
    context.branchId === record.branchId &&
    context.accountingPeriodId ===
      record.accountingPeriodId
  );
}

function assertScope(
  context: PosOperationContext,
  record: ScopedRecord
): void {
  if (!sameScope(context, record)) {
    throw new Error(
      "POS_FINANCE_BRIDGE_SCOPE_MISMATCH"
    );
  }
}

function assertContext(
  context: PosOperationContext
): void {
  assertRequired(
    context.tenantId,
    "POS_FINANCE_BRIDGE_TENANT_REQUIRED"
  );
  assertRequired(
    context.companyId,
    "POS_FINANCE_BRIDGE_COMPANY_REQUIRED"
  );
  assertRequired(
    context.branchId,
    "POS_FINANCE_BRIDGE_BRANCH_REQUIRED"
  );
  assertRequired(
    context.accountingPeriodId,
    "POS_FINANCE_BRIDGE_PERIOD_REQUIRED"
  );
  assertRequired(
    context.userId,
    "POS_FINANCE_BRIDGE_USER_REQUIRED"
  );
  assertRequired(
    context.idempotencyKey,
    "POS_FINANCE_BRIDGE_IDEMPOTENCY_REQUIRED"
  );

  if (
    Number.isNaN(
      Date.parse(context.operationDate)
    )
  ) {
    throw new Error(
      "POS_FINANCE_BRIDGE_OPERATION_DATE_INVALID"
    );
  }
}

function assertBridgeIdempotency(
  state: PosFinanceBridgeState,
  context: PosOperationContext
): void {
  if (
    state.idempotencyKeys.includes(
      context.idempotencyKey
    )
  ) {
    throw new Error(
      "POS_FINANCE_BRIDGE_IDEMPOTENCY_CONFLICT"
    );
  }
}

function assertDocumentUniqueness(
  state: PosFinanceBridgeState,
  journalEntryId: string,
  journalNo: string,
  bankMovementId: string
): void {
  if (
    state.journalEntryIds.includes(
      journalEntryId
    )
  ) {
    throw new Error(
      "POS_FINANCE_BRIDGE_JOURNAL_ID_DUPLICATE"
    );
  }

  if (
    state.journalNumbers.includes(
      journalNo
    )
  ) {
    throw new Error(
      "POS_FINANCE_BRIDGE_JOURNAL_NO_DUPLICATE"
    );
  }

  if (
    state.bankMovements.some(
      movement =>
        movement.id === bankMovementId
    )
  ) {
    throw new Error(
      "POS_FINANCE_BRIDGE_BANK_MOVEMENT_DUPLICATE"
    );
  }
}

function assertAccountIds(
  accounts: {
    posClearingAccountId: string;
    bankAccountLedgerId: string;
    posCommissionExpenseAccountId: string;
    posMonthlyFeeExpenseAccountId: string;
    posTaxExpenseAccountId: string;
    customerReceivableAccountId: string;
  }
): void {
  const values = Object.values(accounts);

  if (
    values.some(
      value => value.trim().length === 0
    )
  ) {
    throw new Error(
      "POS_FINANCE_BRIDGE_ACCOUNT_REQUIRED"
    );
  }
}

function createJournalLine(
  scope: ScopedRecord,
  journalEntryId: string,
  lineNo: number,
  accountId: string,
  debitAmount: number,
  creditAmount: number,
  currency: string,
  description: string,
  customerId: string | null = null
): FinanceJournalLine {
  return {
    ...scope,

    id: `${journalEntryId}:${lineNo}`,
    journalEntryId,
    lineNo,

    accountId,
    customerId,
    supplierId: null,
    chequeNoteId: null,

    description,

    debitAmount:
      roundMoney(debitAmount),
    creditAmount:
      roundMoney(creditAmount),

    currency
  };
}

function assertBalancedPosting(
  posting: FinanceJournalPosting
): void {
  const debitTotal = roundMoney(
    posting.lines.reduce(
      (total, line) =>
        total + line.debitAmount,
      0
    )
  );

  const creditTotal = roundMoney(
    posting.lines.reduce(
      (total, line) =>
        total + line.creditAmount,
      0
    )
  );

  if (
    Math.abs(
      debitTotal - creditTotal
    ) > MONEY_EPSILON
  ) {
    throw new Error(
      "POS_FINANCE_BRIDGE_JOURNAL_UNBALANCED"
    );
  }
}

function settlementRatio(
  settlementAmount: number,
  line: PosSettlementScheduleLine
): number {
  if (
    !Number.isFinite(settlementAmount) ||
    settlementAmount <= 0
  ) {
    throw new Error(
      "POS_FINANCE_BRIDGE_SETTLEMENT_AMOUNT_INVALID"
    );
  }

  if (
    settlementAmount >
    line.pendingAmount + MONEY_EPSILON
  ) {
    throw new Error(
      "POS_FINANCE_BRIDGE_SETTLEMENT_EXCEEDS_PENDING"
    );
  }

  if (line.netAmount <= 0) {
    throw new Error(
      "POS_FINANCE_BRIDGE_LINE_NET_INVALID"
    );
  }

  return settlementAmount / line.netAmount;
}

export function createPosSettlementFinance(
  command: CreatePosSettlementFinanceCommand,
  state: PosFinanceBridgeState
): PosFinanceBridgeWriteResult<
  CreatePosSettlementFinanceResult
> {
  assertContext(command.context);
  assertBridgeIdempotency(
    state,
    command.context
  );

  assertScope(
    command.context,
    command.transaction
  );
  assertScope(
    command.context,
    command.schedule
  );

  assertAccountIds(command.accounts);

  assertDocumentUniqueness(
    state,
    command.documents.journalEntryId,
    command.documents.journalNo,
    command.documents.bankMovementId
  );

  assertIsoDate(command.settlementDate);

  if (
    command.transaction.id !==
      command.schedule.posTransactionId
  ) {
    throw new Error(
      "POS_FINANCE_BRIDGE_TRANSACTION_SCHEDULE_MISMATCH"
    );
  }

  if (
    command.transaction.posAccountId !==
      command.schedule.posAccountId ||
    command.transaction.bankAccountId !==
      command.schedule.bankAccountId
  ) {
    throw new Error(
      "POS_FINANCE_BRIDGE_BANK_POS_MISMATCH"
    );
  }

  if (
    command.transaction.currency !==
      command.schedule.currency
  ) {
    throw new Error(
      "POS_FINANCE_BRIDGE_CURRENCY_MISMATCH"
    );
  }

  const line = command.schedule.lines.find(
    item => item.id === command.scheduleLineId
  );

  if (!line) {
    throw new Error(
      "POS_FINANCE_BRIDGE_SCHEDULE_LINE_NOT_FOUND"
    );
  }

  assertScope(command.context, line);

  const ratio = settlementRatio(
    command.settlementAmount,
    line
  );

  const grossSettlementAmount =
    roundMoney(
      line.grossAmount * ratio
    );

  const commissionAmount =
    roundMoney(
      line.commissionAmount * ratio
    );

  const taxAmount =
    roundMoney(
      line.taxAmount * ratio
    );

  const additionalFeeAmount =
    roundMoney(
      line.additionalFeeAmount * ratio
    );

  const bankNetAmount =
    roundMoney(command.settlementAmount);

  const totalExpenseAmount =
    roundMoney(
      commissionAmount +
      taxAmount +
      additionalFeeAmount
    );

  const clearingCreditAmount =
    roundMoney(
      bankNetAmount +
      totalExpenseAmount
    );

  const scope = {
    tenantId: command.context.tenantId,
    companyId: command.context.companyId,
    branchId: command.context.branchId,
    accountingPeriodId:
      command.context.accountingPeriodId
  };

  const bankMovement: BankMovement = {
    ...scope,

    id:
      command.documents.bankMovementId,
    movementNumber:
      command.documents.bankMovementNumber,

    bankAccountId:
      command.transaction.bankAccountId,

    movementType: "POS_SETTLEMENT",
    direction: "IN",

    sourceModule: "POS",
    sourceDocumentType:
      "POS_SETTLEMENT",
    sourceDocumentId:
      command.settlementId,
    sourceDocumentNumber:
      command.settlementNumber,

    customerId:
      command.transaction.customerId,
    supplierId: null,
    tailorId: null,
    installerId: null,

    grossAmount:
      grossSettlementAmount,
    feeAmount:
      totalExpenseAmount,
    netAmount:
      bankNetAmount,

    currency:
      command.transaction.currency,

    transactionDate:
      command.settlementDate,
    valueDate:
      command.settlementDate,
    settlementDate:
      command.settlementDate,

    status: "SETTLED",

    description:
      command.description,
    externalReference: null,

    createdBy:
      command.context.userId,
    createdAt:
      command.context.operationDate,

    reversedAt: null,
    reversalOfMovementId: null
  };

  const lines: FinanceJournalLine[] = [
    createJournalLine(
      scope,
      command.documents.journalEntryId,
      1,
      command.accounts.bankAccountLedgerId,
      bankNetAmount,
      0,
      command.transaction.currency,
      "POS settlement banka girişi"
    )
  ];

  let lineNo = 2;

  if (commissionAmount > MONEY_EPSILON) {
    lines.push(
      createJournalLine(
        scope,
        command.documents.journalEntryId,
        lineNo,
        command.accounts
          .posCommissionExpenseAccountId,
        commissionAmount,
        0,
        command.transaction.currency,
        "POS komisyon gideri"
      )
    );

    lineNo++;
  }

  if (taxAmount > MONEY_EPSILON) {
    lines.push(
      createJournalLine(
        scope,
        command.documents.journalEntryId,
        lineNo,
        command.accounts
          .posTaxExpenseAccountId,
        taxAmount,
        0,
        command.transaction.currency,
        "POS komisyon vergisi"
      )
    );

    lineNo++;
  }

  if (additionalFeeAmount > MONEY_EPSILON) {
    lines.push(
      createJournalLine(
        scope,
        command.documents.journalEntryId,
        lineNo,
        command.accounts
          .posCommissionExpenseAccountId,
        additionalFeeAmount,
        0,
        command.transaction.currency,
        "POS ek kesinti gideri"
      )
    );

    lineNo++;
  }

  lines.push(
    createJournalLine(
      scope,
      command.documents.journalEntryId,
      lineNo,
      command.accounts.posClearingAccountId,
      0,
      clearingCreditAmount,
      command.transaction.currency,
      "POS bekleyen hesabı çıkışı"
    )
  );

  const journalPosting: FinanceJournalPosting = {
    entry: {
      ...scope,

      id:
        command.documents.journalEntryId,
      journalNo:
        command.documents.journalNo,

      transactionId:
        command.settlementId,
      idempotencyKey:
        command.context.idempotencyKey,

      sourceDocumentType:
        "POS_SETTLEMENT",
      sourceDocumentId:
        command.settlementId,

      description:
        command.description ||
        "POS settlement finans köprüsü",

      currency:
        command.transaction.currency,
      status: "POSTED",

      reversalOfJournalEntryId: null,

      createdBy:
        command.context.userId,
      createdAt:
        command.context.operationDate,
      postedAt:
        command.context.operationDate,
      reversedAt: null
    },

    lines
  };

  assertBalancedPosting(journalPosting);

  return {
    value: {
      bankMovement,
      journalPosting,

      grossSettlementAmount,
      commissionAmount,
      taxAmount,
      additionalFeeAmount,
      bankNetAmount
    },

    idempotencyKey:
      command.context.idempotencyKey,
    sourceDocumentId:
      command.settlementId,
    sourceDocumentNumber:
      command.settlementNumber
  };
}

export function createPosMonthlyFeeFinance(
  command: CreatePosMonthlyFeeFinanceCommand,
  state: PosFinanceBridgeState
): PosFinanceBridgeWriteResult<
  CreatePosMonthlyFeeFinanceResult
> {
  assertContext(command.context);
  assertBridgeIdempotency(
    state,
    command.context
  );

  assertScope(command.context, command.fee);
  assertAccountIds(command.accounts);

  assertDocumentUniqueness(
    state,
    command.documents.journalEntryId,
    command.documents.journalNo,
    command.documents.bankMovementId
  );

  assertIsoDate(command.paymentDate);

  if (
    command.fee.status === "CANCELLED" ||
    command.fee.status === "REVERSED"
  ) {
    throw new Error(
      "POS_FINANCE_BRIDGE_MONTHLY_FEE_INVALID_STATUS"
    );
  }

  const scope = {
    tenantId: command.context.tenantId,
    companyId: command.context.companyId,
    branchId: command.context.branchId,
    accountingPeriodId:
      command.context.accountingPeriodId
  };

  const bankMovement: BankMovement = {
    ...scope,

    id:
      command.documents.bankMovementId,
    movementNumber:
      command.documents.bankMovementNumber,

    bankAccountId:
      command.fee.bankAccountId,

    movementType: "POS_COMMISSION",
    direction: "OUT",

    sourceModule: "POS",
    sourceDocumentType:
      "POS_MONTHLY_FEE",
    sourceDocumentId:
      command.fee.id,
    sourceDocumentNumber:
      command.fee.feeNumber,

    customerId: null,
    supplierId: null,
    tailorId: null,
    installerId: null,

    grossAmount:
      command.fee.netAmount,
    feeAmount: 0,
    netAmount:
      command.fee.netAmount,

    currency:
      command.fee.currency,

    transactionDate:
      command.paymentDate,
    valueDate:
      command.paymentDate,
    settlementDate:
      command.paymentDate,

    status: "SETTLED",

    description:
      command.description,
    externalReference: null,

    createdBy:
      command.context.userId,
    createdAt:
      command.context.operationDate,

    reversedAt: null,
    reversalOfMovementId: null
  };

  const lines: FinanceJournalLine[] = [
    createJournalLine(
      scope,
      command.documents.journalEntryId,
      1,
      command.accounts
        .posMonthlyFeeExpenseAccountId,
      command.fee.grossAmount,
      0,
      command.fee.currency,
      "Aylık sabit POS gideri"
    )
  ];

  let lineNo = 2;

  if (command.fee.taxAmount > MONEY_EPSILON) {
    lines.push(
      createJournalLine(
        scope,
        command.documents.journalEntryId,
        lineNo,
        command.accounts
          .posTaxExpenseAccountId,
        command.fee.taxAmount,
        0,
        command.fee.currency,
        "Aylık POS gideri vergisi"
      )
    );

    lineNo++;
  }

  lines.push(
    createJournalLine(
      scope,
      command.documents.journalEntryId,
      lineNo,
      command.accounts.bankAccountLedgerId,
      0,
      command.fee.netAmount,
      command.fee.currency,
      "Aylık POS gideri banka çıkışı"
    )
  );

  const journalPosting: FinanceJournalPosting = {
    entry: {
      ...scope,

      id:
        command.documents.journalEntryId,
      journalNo:
        command.documents.journalNo,

      transactionId:
        command.fee.id,
      idempotencyKey:
        command.context.idempotencyKey,

      sourceDocumentType:
        "EXPENSE",
      sourceDocumentId:
        command.fee.id,

      description:
        command.description ||
        "Aylık sabit POS gideri",

      currency:
        command.fee.currency,
      status: "POSTED",

      reversalOfJournalEntryId: null,

      createdBy:
        command.context.userId,
      createdAt:
        command.context.operationDate,
      postedAt:
        command.context.operationDate,
      reversedAt: null
    },

    lines
  };

  assertBalancedPosting(journalPosting);

  return {
    value: {
      bankMovement,
      journalPosting,

      expenseAmount:
        command.fee.grossAmount,
      taxAmount:
        command.fee.taxAmount,
      bankOutflowAmount:
        command.fee.netAmount
    },

    idempotencyKey:
      command.context.idempotencyKey,
    sourceDocumentId:
      command.fee.id,
    sourceDocumentNumber:
      command.fee.feeNumber
  };
}

export function createPosRefundFinance(
  command: CreatePosRefundFinanceCommand,
  state: PosFinanceBridgeState
): PosFinanceBridgeWriteResult<
  CreatePosRefundFinanceResult
> {
  assertContext(command.context);
  assertBridgeIdempotency(
    state,
    command.context
  );

  assertScope(
    command.context,
    command.originalTransaction
  );
  assertScope(
    command.context,
    command.refundTransaction
  );

  assertAccountIds(command.accounts);

  assertDocumentUniqueness(
    state,
    command.documents.journalEntryId,
    command.documents.journalNo,
    command.documents.bankMovementId
  );

  assertIsoDate(command.refundDate);

  if (
    command.originalTransaction
      .posAccountId !==
      command.refundTransaction
        .posAccountId ||
    command.originalTransaction
      .bankAccountId !==
      command.refundTransaction
        .bankAccountId
  ) {
    throw new Error(
      "POS_FINANCE_BRIDGE_REFUND_ACCOUNT_MISMATCH"
    );
  }

  if (
    command.originalTransaction.currency !==
      command.refundTransaction.currency
  ) {
    throw new Error(
      "POS_FINANCE_BRIDGE_CURRENCY_MISMATCH"
    );
  }

  const refundAmount = roundMoney(
    Math.abs(
      command.refundTransaction.netAmount
    )
  );

  if (refundAmount <= 0) {
    throw new Error(
      "POS_FINANCE_BRIDGE_REFUND_AMOUNT_INVALID"
    );
  }

  const scope = {
    tenantId: command.context.tenantId,
    companyId: command.context.companyId,
    branchId: command.context.branchId,
    accountingPeriodId:
      command.context.accountingPeriodId
  };

  const bankMovement: BankMovement = {
    ...scope,

    id:
      command.documents.bankMovementId,
    movementNumber:
      command.documents.bankMovementNumber,

    bankAccountId:
      command.refundTransaction.bankAccountId,

    movementType: "POS_SETTLEMENT",
    direction: "OUT",

    sourceModule: "POS",
    sourceDocumentType:
      "POS_REFUND",
    sourceDocumentId:
      command.refundTransaction.id,
    sourceDocumentNumber:
      command.refundTransaction
        .posTransactionNumber,

    customerId:
      command.refundTransaction.customerId,
    supplierId: null,
    tailorId: null,
    installerId: null,

    grossAmount:
      refundAmount,
    feeAmount: 0,
    netAmount:
      refundAmount,

    currency:
      command.refundTransaction.currency,

    transactionDate:
      command.refundDate,
    valueDate:
      command.refundDate,
    settlementDate:
      command.refundDate,

    status: "SETTLED",

    description:
      command.description,
    externalReference: null,

    createdBy:
      command.context.userId,
    createdAt:
      command.context.operationDate,

    reversedAt: null,
    reversalOfMovementId: null
  };

  const journalPosting: FinanceJournalPosting = {
    entry: {
      ...scope,

      id:
        command.documents.journalEntryId,
      journalNo:
        command.documents.journalNo,

      transactionId:
        command.refundTransaction.id,
      idempotencyKey:
        command.context.idempotencyKey,

      sourceDocumentType:
        "POS_SETTLEMENT",
      sourceDocumentId:
        command.refundTransaction.id,

      description:
        command.description ||
        "POS iade finans köprüsü",

      currency:
        command.refundTransaction.currency,
      status: "POSTED",

      reversalOfJournalEntryId: null,

      createdBy:
        command.context.userId,
      createdAt:
        command.context.operationDate,
      postedAt:
        command.context.operationDate,
      reversedAt: null
    },

    lines: [
      createJournalLine(
        scope,
        command.documents.journalEntryId,
        1,
        command.accounts
          .customerReceivableAccountId,
        refundAmount,
        0,
        command.refundTransaction.currency,
        "POS iadesi müşteri hesabı",
        command.refundTransaction.customerId
      ),
      createJournalLine(
        scope,
        command.documents.journalEntryId,
        2,
        command.accounts.bankAccountLedgerId,
        0,
        refundAmount,
        command.refundTransaction.currency,
        "POS iadesi banka çıkışı"
      )
    ]
  };

  assertBalancedPosting(journalPosting);

  return {
    value: {
      bankMovement,
      journalPosting,

      refundAmount,
      bankOutflowAmount:
        refundAmount
    },

    idempotencyKey:
      command.context.idempotencyKey,
    sourceDocumentId:
      command.refundTransaction.id,
    sourceDocumentNumber:
      command.refundTransaction
        .posTransactionNumber
  };
}
