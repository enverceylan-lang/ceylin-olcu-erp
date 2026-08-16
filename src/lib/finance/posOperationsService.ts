import type {
  PosMonthlyFee,
  PosSettlementSchedule,
  PosSettlementScheduleLine,
  PosTransaction
} from "@/lib/finance/posContracts";
import {
  calculatePosContractPricing
} from "@/lib/finance/posContractPricingEngine";
import type {
  CreatePosMonthlyFeeCommand,
  CreatePosTransactionCommand,
  CreatePosTransactionResult,
  PayPosMonthlyFeeCommand,
  PosOperationAudit,
  PosOperationContext,
  PosOperationState,
  RefundPosTransactionCommand,
  RefundPosTransactionResult,
  ReversePosOperationCommand,
  SettlePosTransactionCommand,
  SettlePosTransactionResult
} from "@/lib/finance/posOperationsContracts";

const MONEY_EPSILON = 0.000001;

export interface PosOperationResult<T> {
  value: T;
  audit: PosOperationAudit;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function assertIsoDate(value: string): void {
  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    value.length !== 10 ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new Error("POS_OPERATION_DATE_INVALID");
  }
}

function assertTimestamp(value: string): void {
  if (Number.isNaN(Date.parse(value))) {
    throw new Error("POS_OPERATION_TIMESTAMP_INVALID");
  }
}

function assertRequired(
  value: string,
  errorCode: string
): void {
  if (value.trim().length === 0) {
    throw new Error(errorCode);
  }
}

function sameScope(
  context: PosOperationContext,
  scoped: {
    tenantId: string;
    companyId: string;
    branchId: string;
    accountingPeriodId: string;
  }
): boolean {
  return (
    context.tenantId === scoped.tenantId &&
    context.companyId === scoped.companyId &&
    context.branchId === scoped.branchId &&
    context.accountingPeriodId ===
      scoped.accountingPeriodId
  );
}

function assertContext(
  context: PosOperationContext
): void {
  assertRequired(
    context.tenantId,
    "POS_OPERATION_TENANT_REQUIRED"
  );
  assertRequired(
    context.companyId,
    "POS_OPERATION_COMPANY_REQUIRED"
  );
  assertRequired(
    context.branchId,
    "POS_OPERATION_BRANCH_REQUIRED"
  );
  assertRequired(
    context.accountingPeriodId,
    "POS_OPERATION_PERIOD_REQUIRED"
  );
  assertRequired(
    context.userId,
    "POS_OPERATION_USER_REQUIRED"
  );
  assertRequired(
    context.idempotencyKey,
    "POS_OPERATION_IDEMPOTENCY_REQUIRED"
  );

  assertTimestamp(context.operationDate);
}

function assertScope(
  context: PosOperationContext,
  scoped: {
    tenantId: string;
    companyId: string;
    branchId: string;
    accountingPeriodId: string;
  }
): void {
  if (!sameScope(context, scoped)) {
    throw new Error(
      "POS_OPERATION_SCOPE_MISMATCH"
    );
  }
}

function assertIdempotency(
  state: PosOperationState,
  context: PosOperationContext
): void {
  const duplicate = state.audits.some(
    audit =>
      sameScope(context, audit) &&
      audit.idempotencyKey ===
        context.idempotencyKey
  );

  if (duplicate) {
    throw new Error(
      "POS_OPERATION_IDEMPOTENCY_CONFLICT"
    );
  }
}

function createAudit(
  context: PosOperationContext,
  operationType: PosOperationAudit["operationType"],
  sourceOperationId: string,
  description: string | null,
  reversalOfAuditId: string | null = null
): PosOperationAudit {
  return {
    id:
      "pos-audit-" +
      context.idempotencyKey,

    tenantId: context.tenantId,
    companyId: context.companyId,
    branchId: context.branchId,
    accountingPeriodId:
      context.accountingPeriodId,

    operationType,
    operationStatus: "COMPLETED",

    sourceOperationId,
    idempotencyKey:
      context.idempotencyKey,

    userId: context.userId,
    operationDate:
      context.operationDate,

    description,
    reversalOfAuditId
  };
}

function assertTransactionSetup(
  command: CreatePosTransactionCommand
): void {
  const {
    context,
    contract,
    rule
  } = command;

  assertScope(context, contract);
  assertScope(context, rule);

  if (
    rule.posContractId !== contract.id ||
    contract.posAccountId !==
      rule.posAccountId
  ) {
    throw new Error(
      "POS_OPERATION_CONTRACT_RULE_MISMATCH"
    );
  }

  if (
    contract.currency !== command.currency
  ) {
    throw new Error(
      "POS_OPERATION_CURRENCY_MISMATCH"
    );
  }

  if (
    !contract.isActive ||
    contract.archivedAt !== null
  ) {
    throw new Error(
      "POS_OPERATION_CONTRACT_INACTIVE"
    );
  }

  if (
    !rule.isActive ||
    rule.archivedAt !== null
  ) {
    throw new Error(
      "POS_OPERATION_RULE_INACTIVE"
    );
  }

  assertRequired(
    command.id,
    "POS_OPERATION_TRANSACTION_ID_REQUIRED"
  );
  assertRequired(
    command.posTransactionNumber,
    "POS_OPERATION_TRANSACTION_NUMBER_REQUIRED"
  );
  assertRequired(
    command.paymentId,
    "POS_OPERATION_PAYMENT_ID_REQUIRED"
  );
  assertRequired(
    command.customerId,
    "POS_OPERATION_CUSTOMER_ID_REQUIRED"
  );
}

export function createPosTransaction(
  command: CreatePosTransactionCommand,
  state: PosOperationState
): PosOperationResult<CreatePosTransactionResult> {
  assertContext(command.context);
  assertIdempotency(state, command.context);
  assertTransactionSetup(command);

  const duplicatePayment =
    state.transactions.some(
      transaction =>
        sameScope(
          command.context,
          transaction
        ) &&
        transaction.paymentId ===
          command.paymentId &&
        transaction.reversedAt === null
    );

  if (duplicatePayment) {
    throw new Error(
      "POS_OPERATION_PAYMENT_ALREADY_POSTED"
    );
  }

  const pricing =
    calculatePosContractPricing({
      grossAmount:
        command.grossAmount,
      installmentCount:
        command.installmentCount,
      transactionDate:
        command.transactionDate,
      rule: command.rule
    });

  const transaction: PosTransaction = {
    tenantId:
      command.context.tenantId,
    companyId:
      command.context.companyId,
    branchId:
      command.context.branchId,
    accountingPeriodId:
      command.context.accountingPeriodId,

    id: command.id,
    posTransactionNumber:
      command.posTransactionNumber,

    posAccountId:
      command.contract.posAccountId,
    bankAccountId:
      command.contract.bankAccountId,

    posContractId:
      command.contract.id,
    posContractRuleId:
      command.rule.id,

    saleId: command.saleId,
    saleNumber: command.saleNumber,
    paymentId: command.paymentId,
    customerId: command.customerId,

    installmentCount:
      command.installmentCount,
    workingMode:
      command.rule.workingMode,

    grossAmount:
      pricing.grossAmount,
    commissionAmount:
      pricing.commissionAmount,
    fixedTransactionFee:
      pricing.fixedTransactionFee,
    taxAmount:
      pricing.taxAmount,
    additionalFeeAmount:
      pricing.additionalFeeAmount,
    totalDeductionAmount:
      pricing.totalDeductionAmount,
    netAmount:
      pricing.netAmount,

    currency: command.currency,

    transactionDate:
      command.transactionDate,
    expectedFirstSettlementDate:
      pricing.expectedFirstSettlementDate,
    expectedFinalSettlementDate:
      pricing.expectedFinalSettlementDate,
    actualSettlementDate: null,

    settledAmount: 0,
    pendingAmount:
      pricing.pendingAmount,

    status: "PENDING_SETTLEMENT",
    description:
      command.description,

    createdBy:
      command.context.userId,
    createdAt:
      command.context.operationDate,

    ruleSnapshot:
      pricing.ruleSnapshot,

    reversedAt: null,
    reversalOfPosTransactionId: null
  };

  const scheduleId =
    command.id + "-schedule";

  const lines: PosSettlementScheduleLine[] =
    pricing.schedule.map(line => ({
      tenantId:
        command.context.tenantId,
      companyId:
        command.context.companyId,
      branchId:
        command.context.branchId,
      accountingPeriodId:
        command.context.accountingPeriodId,

      id:
        scheduleId +
        "-line-" +
        line.sequence,
      scheduleId,

      sequence: line.sequence,

      expectedSettlementDate:
        line.expectedSettlementDate,
      actualSettlementDate: null,

      grossAmount:
        line.grossAmount,
      commissionAmount:
        line.commissionAmount,
      fixedTransactionFee:
        line.fixedTransactionFee,
      taxAmount:
        line.taxAmount,
      additionalFeeAmount:
        line.additionalFeeAmount,
      netAmount:
        line.netAmount,

      settledAmount: 0,
      pendingAmount:
        line.netAmount,

      bankMovementId: null,
      status: "PENDING"
    }));

  const settlementSchedule:
    PosSettlementSchedule = {
      tenantId:
        command.context.tenantId,
      companyId:
        command.context.companyId,
      branchId:
        command.context.branchId,
      accountingPeriodId:
        command.context.accountingPeriodId,

      id: scheduleId,
      scheduleNumber:
        command.posTransactionNumber +
        "-PLAN",

      posTransactionId:
        transaction.id,
      posContractId:
        command.contract.id,
      posContractRuleId:
        command.rule.id,

      posAccountId:
        command.contract.posAccountId,
      bankAccountId:
        command.contract.bankAccountId,

      workingMode:
        command.rule.workingMode,
      installmentCount:
        command.installmentCount,

      grossAmount:
        pricing.grossAmount,
      totalDeductionAmount:
        pricing.totalDeductionAmount,
      netAmount:
        pricing.netAmount,

      settledAmount: 0,
      pendingAmount:
        pricing.netAmount,

      currency:
        command.currency,

      createdBy:
        command.context.userId,
      createdAt:
        command.context.operationDate,

      lines
    };

  return {
    value: {
      transaction,
      settlementSchedule
    },
    audit: createAudit(
      command.context,
      "CREATE_TRANSACTION",
      transaction.id,
      command.description
    )
  };
}

export function settlePosTransaction(
  command: SettlePosTransactionCommand,
  state: PosOperationState
): PosOperationResult<SettlePosTransactionResult> {
  assertContext(command.context);
  assertIdempotency(state, command.context);
  assertScope(
    command.context,
    command.transaction
  );
  assertScope(
    command.context,
    command.schedule
  );

  assertRequired(
    command.settlementId,
    "POS_OPERATION_SETTLEMENT_ID_REQUIRED"
  );
  assertRequired(
    command.settlementNumber,
    "POS_OPERATION_SETTLEMENT_NUMBER_REQUIRED"
  );
  assertRequired(
    command.bankMovementId,
    "POS_OPERATION_BANK_MOVEMENT_REQUIRED"
  );

  assertIsoDate(
    command.actualSettlementDate
  );

  if (
    !Number.isFinite(command.amount) ||
    command.amount <= 0
  ) {
    throw new Error(
      "POS_OPERATION_SETTLEMENT_AMOUNT_INVALID"
    );
  }

  if (
    command.transaction.reversedAt !== null ||
    command.transaction.status ===
      "CANCELLED" ||
    command.transaction.status ===
      "REVERSED"
  ) {
    throw new Error(
      "POS_OPERATION_TRANSACTION_NOT_SETTLEABLE"
    );
  }

  const lineIndex =
    command.schedule.lines.findIndex(
      line =>
        line.id ===
        command.scheduleLineId
    );

  if (lineIndex < 0) {
    throw new Error(
      "POS_OPERATION_SCHEDULE_LINE_NOT_FOUND"
    );
  }

  const originalLine =
    command.schedule.lines[lineIndex];

  if (
    command.amount >
    originalLine.pendingAmount +
      MONEY_EPSILON
  ) {
    throw new Error(
      "POS_OPERATION_SETTLEMENT_EXCEEDS_LINE"
    );
  }

  if (
    command.amount >
    command.transaction.pendingAmount +
      MONEY_EPSILON
  ) {
    throw new Error(
      "POS_OPERATION_SETTLEMENT_EXCEEDS_TRANSACTION"
    );
  }

  const lineSettledAmount = roundMoney(
    originalLine.settledAmount +
      command.amount
  );

  const linePendingAmount = roundMoney(
    originalLine.pendingAmount -
      command.amount
  );

  const updatedLine:
    PosSettlementScheduleLine = {
      ...originalLine,

      settledAmount:
        lineSettledAmount,
      pendingAmount:
        linePendingAmount,

      actualSettlementDate:
        linePendingAmount <=
        MONEY_EPSILON
          ? command.actualSettlementDate
          : originalLine.actualSettlementDate,

      bankMovementId:
        command.bankMovementId,

      status:
        linePendingAmount <= MONEY_EPSILON
          ? "SETTLED"
          : "PARTIALLY_SETTLED"
    };

  const updatedLines =
    command.schedule.lines.map(
      (line, index) =>
        index === lineIndex
          ? updatedLine
          : line
    );

  const scheduleSettledAmount =
    roundMoney(
      command.schedule.settledAmount +
        command.amount
    );

  const schedulePendingAmount =
    roundMoney(
      command.schedule.pendingAmount -
        command.amount
    );

  const updatedSchedule:
    PosSettlementSchedule = {
      ...command.schedule,

      settledAmount:
        scheduleSettledAmount,
      pendingAmount:
        schedulePendingAmount,

      lines: updatedLines
    };

  const transactionSettledAmount =
    roundMoney(
      command.transaction.settledAmount +
        command.amount
    );

  const transactionPendingAmount =
    roundMoney(
      command.transaction.pendingAmount -
        command.amount
    );

  const updatedTransaction:
    PosTransaction = {
      ...command.transaction,

      settledAmount:
        transactionSettledAmount,
      pendingAmount:
        transactionPendingAmount,

      actualSettlementDate:
        transactionPendingAmount <=
        MONEY_EPSILON
          ? command.actualSettlementDate
          : null,

      status:
        transactionPendingAmount <=
        MONEY_EPSILON
          ? "SETTLED"
          : "PARTIALLY_SETTLED"
    };

  return {
    value: {
      transaction:
        updatedTransaction,
      settlementSchedule:
        updatedSchedule,

      settledAmount:
        command.amount,
      remainingPendingAmount:
        transactionPendingAmount
    },
    audit: createAudit(
      command.context,
      "SETTLE_TRANSACTION",
      command.settlementId,
      command.settlementNumber
    )
  };
}

export function createPosMonthlyFee(
  command: CreatePosMonthlyFeeCommand,
  state: PosOperationState
): PosOperationResult<PosMonthlyFee> {
  assertContext(command.context);
  assertIdempotency(state, command.context);
  assertScope(
    command.context,
    command.contract
  );

  if (
    !command.contract.isActive ||
    command.contract.archivedAt !== null
  ) {
    throw new Error(
      "POS_OPERATION_CONTRACT_INACTIVE"
    );
  }

  if (
    !command.contract
      .monthlyFixedFeeEnabled
  ) {
    throw new Error(
      "POS_OPERATION_MONTHLY_FEE_DISABLED"
    );
  }

  if (
    !Number.isFinite(
      command.contract
        .monthlyFixedFeeAmount
    ) ||
    command.contract
      .monthlyFixedFeeAmount <= 0
  ) {
    throw new Error(
      "POS_OPERATION_MONTHLY_FEE_AMOUNT_INVALID"
    );
  }

  if (
    !Number.isInteger(command.year) ||
    command.year < 2000 ||
    !Number.isInteger(command.month) ||
    command.month < 1 ||
    command.month > 12
  ) {
    throw new Error(
      "POS_OPERATION_MONTHLY_FEE_PERIOD_INVALID"
    );
  }

  if (
    !Number.isFinite(command.taxRate) ||
    command.taxRate < 0
  ) {
    throw new Error(
      "POS_OPERATION_MONTHLY_FEE_TAX_INVALID"
    );
  }

  assertIsoDate(command.dueDate);

  const allFees = [
    ...state.monthlyFees,
    ...command.existingFees
  ];

  const duplicate = allFees.some(
    fee =>
      sameScope(
        command.context,
        fee
      ) &&
      fee.posContractId ===
        command.contract.id &&
      fee.year === command.year &&
      fee.month === command.month &&
      fee.status !== "CANCELLED" &&
      fee.status !== "REVERSED"
  );

  if (duplicate) {
    throw new Error(
      "POS_OPERATION_MONTHLY_FEE_DUPLICATE"
    );
  }

  const grossAmount = roundMoney(
    command.contract
      .monthlyFixedFeeAmount
  );

  const taxAmount = roundMoney(
    grossAmount *
      command.taxRate /
      100
  );

  const fee: PosMonthlyFee = {
    tenantId:
      command.context.tenantId,
    companyId:
      command.context.companyId,
    branchId:
      command.context.branchId,
    accountingPeriodId:
      command.context.accountingPeriodId,

    id: command.id,
    feeNumber: command.feeNumber,

    posContractId:
      command.contract.id,
    posAccountId:
      command.contract.posAccountId,
    bankAccountId:
      command.contract.bankAccountId,

    year: command.year,
    month: command.month,

    grossAmount,
    taxAmount,
    netAmount:
      roundMoney(
        grossAmount + taxAmount
      ),

    currency:
      command.contract.currency,
    dueDate: command.dueDate,
    paidAt: null,

    bankMovementId: null,
    status: "PLANNED",

    createdBy:
      command.context.userId,
    createdAt:
      command.context.operationDate,
    reversedAt: null
  };

  return {
    value: fee,
    audit: createAudit(
      command.context,
      "CREATE_MONTHLY_FEE",
      fee.id,
      fee.feeNumber
    )
  };
}

export function payPosMonthlyFee(
  command: PayPosMonthlyFeeCommand,
  state: PosOperationState
): PosOperationResult<PosMonthlyFee> {
  assertContext(command.context);
  assertIdempotency(state, command.context);
  assertScope(
    command.context,
    command.fee
  );

  if (
    command.fee.status === "PAID" ||
    command.fee.paidAt !== null ||
    command.fee.bankMovementId !== null
  ) {
    throw new Error(
      "POS_OPERATION_MONTHLY_FEE_ALREADY_PAID"
    );
  }

  if (
    command.fee.status ===
      "CANCELLED" ||
    command.fee.status ===
      "REVERSED"
  ) {
    throw new Error(
      "POS_OPERATION_MONTHLY_FEE_NOT_PAYABLE"
    );
  }

  assertRequired(
    command.bankMovementId,
    "POS_OPERATION_BANK_MOVEMENT_REQUIRED"
  );
  assertTimestamp(command.paidAt);

  const paidFee: PosMonthlyFee = {
    ...command.fee,
    status: "PAID",
    paidAt: command.paidAt,
    bankMovementId:
      command.bankMovementId
  };

  return {
    value: paidFee,
    audit: createAudit(
      command.context,
      "PAY_MONTHLY_FEE",
      paidFee.id,
      paidFee.feeNumber
    )
  };
}

export function refundPosTransaction(
  command: RefundPosTransactionCommand,
  state: PosOperationState
): PosOperationResult<RefundPosTransactionResult> {
  assertContext(command.context);
  assertIdempotency(state, command.context);
  assertScope(
    command.context,
    command.originalTransaction
  );

  if (
    command.originalTransaction
      .reversedAt !== null ||
    command.originalTransaction.status ===
      "CANCELLED" ||
    command.originalTransaction.status ===
      "REVERSED"
  ) {
    throw new Error(
      "POS_OPERATION_TRANSACTION_NOT_REFUNDABLE"
    );
  }

  if (
    !Number.isFinite(
      command.refundAmount
    ) ||
    command.refundAmount <= 0 ||
    command.refundAmount >
      command.originalTransaction
        .grossAmount +
        MONEY_EPSILON
  ) {
    throw new Error(
      "POS_OPERATION_REFUND_AMOUNT_INVALID"
    );
  }

  assertIsoDate(command.refundDate);

  const refundAmount = roundMoney(
    command.refundAmount
  );

  const fullRefund =
    Math.abs(
      refundAmount -
      command.originalTransaction
        .grossAmount
    ) <= MONEY_EPSILON;

  const refundTransaction:
    PosTransaction = {
      ...command.originalTransaction,

      id:
        command.refundTransactionId,
      posTransactionNumber:
        command.refundTransactionNumber,

      saleId:
        command.originalTransaction.saleId,
      saleNumber:
        command.originalTransaction.saleNumber,
      paymentId:
        command.originalTransaction.paymentId +
        "-REFUND-" +
        command.refundTransactionId,

      grossAmount:
        -refundAmount,
      commissionAmount: 0,
      taxAmount: 0,
      additionalFeeAmount: 0,
      totalDeductionAmount: 0,
      netAmount:
        -refundAmount,

      transactionDate:
        command.refundDate,
      expectedFirstSettlementDate:
        command.refundDate,
      expectedFinalSettlementDate:
        command.refundDate,
      actualSettlementDate:
        command.bankMovementId === null
          ? null
          : command.refundDate,

      settledAmount:
        command.bankMovementId === null
          ? 0
          : -refundAmount,
      pendingAmount:
        command.bankMovementId === null
          ? -refundAmount
          : 0,

      status: "REFUNDED",
      description:
        command.description,

      createdBy:
        command.context.userId,
      createdAt:
        command.context.operationDate,

      reversedAt: null,
      reversalOfPosTransactionId:
        command.originalTransaction.id
    };

  const updatedOriginal:
    PosTransaction = {
      ...command.originalTransaction,

      status:
        fullRefund
          ? "REFUNDED"
          : command.originalTransaction
              .status
    };

  return {
    value: {
      originalTransaction:
        updatedOriginal,
      refundTransaction
    },
    audit: createAudit(
      command.context,
      "REFUND_TRANSACTION",
      refundTransaction.id,
      command.description
    )
  };
}

export function reversePosOperation(
  command: ReversePosOperationCommand,
  state: PosOperationState
): PosOperationResult<PosOperationAudit> {
  assertContext(command.context);
  assertIdempotency(state, command.context);

  assertRequired(
    command.sourceOperationId,
    "POS_OPERATION_SOURCE_REQUIRED"
  );
  assertRequired(
    command.reversalOperationId,
    "POS_OPERATION_REVERSAL_ID_REQUIRED"
  );
  assertRequired(
    command.reversalReason,
    "POS_OPERATION_REVERSAL_REASON_REQUIRED"
  );

  const sourceAudit =
    state.audits.find(
      audit =>
        sameScope(
          command.context,
          audit
        ) &&
        audit.sourceOperationId ===
          command.sourceOperationId &&
        audit.operationStatus ===
          "COMPLETED"
    );

  if (!sourceAudit) {
    throw new Error(
      "POS_OPERATION_SOURCE_AUDIT_NOT_FOUND"
    );
  }

  const reversalAudit = createAudit(
    command.context,
    "REVERSE_OPERATION",
    command.reversalOperationId,
    command.reversalReason,
    sourceAudit.id
  );

  reversalAudit.operationStatus =
    "REVERSED";

  return {
    value: reversalAudit,
    audit: reversalAudit
  };
}
