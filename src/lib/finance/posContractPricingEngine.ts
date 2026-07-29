import type {
  PosContractRule,
  PosWorkingMode
} from "@/lib/finance/posContracts";

const MONEY_EPSILON = 0.000001;

export interface PosContractPricingCommand {
  grossAmount: number;
  installmentCount: number;
  transactionDate: string;
  rule: PosContractRule;
}

export interface PosContractSettlementLine {
  sequence: number;
  expectedSettlementDate: string;

  grossAmount: number;
  commissionAmount: number;
  fixedTransactionFee: number;
  taxAmount: number;
  additionalFeeAmount: number;
  totalDeductionAmount: number;
  netAmount: number;
}

export interface PosContractRuleSnapshot {
  ruleId: string;
  posContractId: string;
  workingMode: PosWorkingMode;
  installmentCount: number;

  commissionRate: number;
  fixedTransactionFee: number;
  taxRate: number;
  additionalFeeRate: number;

  firstSettlementDayCount: number;
  installmentIntervalDayCount: number;
}

export interface PosContractPricingResult {
  grossAmount: number;

  commissionAmount: number;
  fixedTransactionFee: number;
  taxAmount: number;
  additionalFeeAmount: number;
  totalDeductionAmount: number;

  netAmount: number;
  pendingAmount: number;

  expectedFirstSettlementDate: string;
  expectedFinalSettlementDate: string;

  automaticSettlement: boolean;
  schedule: PosContractSettlementLine[];
  ruleSnapshot: PosContractRuleSnapshot;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseIsoDate(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    value.length !== 10 ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new Error("POS_CONTRACT_PRICING_DATE_INVALID");
  }

  return date;
}

function addDays(
  value: string,
  dayCount: number
): string {
  const date = parseIsoDate(value);

  date.setUTCDate(
    date.getUTCDate() + dayCount
  );

  return date.toISOString().slice(0, 10);
}

function splitMoney(
  total: number,
  partCount: number
): number[] {
  const roundedTotal = roundMoney(total);

  const basePart = Math.floor(
    roundedTotal * 100 / partCount
  ) / 100;

  const parts = Array.from(
    { length: partCount },
    () => basePart
  );

  const assigned = roundMoney(
    basePart * partCount
  );

  parts[partCount - 1] = roundMoney(
    parts[partCount - 1] +
      roundedTotal -
      assigned
  );

  return parts;
}

function assertValidCommand(
  command: PosContractPricingCommand
): void {
  const { rule } = command;

  if (
    !Number.isFinite(command.grossAmount) ||
    command.grossAmount <= 0
  ) {
    throw new Error(
      "POS_CONTRACT_PRICING_GROSS_AMOUNT_INVALID"
    );
  }

  if (
    !Number.isInteger(command.installmentCount) ||
    command.installmentCount <= 0
  ) {
    throw new Error(
      "POS_CONTRACT_PRICING_INSTALLMENT_COUNT_INVALID"
    );
  }

  if (
    command.installmentCount !==
    rule.installmentCount
  ) {
    throw new Error(
      "POS_CONTRACT_PRICING_RULE_MISMATCH"
    );
  }

  if (
    !rule.isActive ||
    rule.archivedAt !== null
  ) {
    throw new Error(
      "POS_CONTRACT_PRICING_RULE_INACTIVE"
    );
  }

  const numericValues = [
    rule.commissionRate,
    rule.fixedTransactionFee,
    rule.taxRate,
    rule.additionalFeeRate,
    rule.firstSettlementDayCount,
    rule.installmentIntervalDayCount
  ];

  if (
    numericValues.some(
      value =>
        !Number.isFinite(value) ||
        value < 0
    )
  ) {
    throw new Error(
      "POS_CONTRACT_PRICING_RULE_VALUE_INVALID"
    );
  }

  if (
    rule.workingMode === "MONTHLY_BLOCKED" &&
    rule.installmentIntervalDayCount <= 0
  ) {
    throw new Error(
      "POS_CONTRACT_PRICING_INTERVAL_REQUIRED"
    );
  }

  parseIsoDate(command.transactionDate);
}

function calculateTotals(
  grossAmount: number,
  rule: PosContractRule
) {
  const commissionAmount = roundMoney(
    grossAmount *
      rule.commissionRate /
      100
  );

  const fixedTransactionFee = roundMoney(
    rule.fixedTransactionFee
  );

  const taxBase = roundMoney(
    commissionAmount +
      fixedTransactionFee
  );

  const taxAmount = roundMoney(
    taxBase *
      rule.taxRate /
      100
  );

  const additionalFeeAmount = roundMoney(
    grossAmount *
      rule.additionalFeeRate /
      100
  );

  const totalDeductionAmount = roundMoney(
    commissionAmount +
      fixedTransactionFee +
      taxAmount +
      additionalFeeAmount
  );

  const netAmount = roundMoney(
    grossAmount -
      totalDeductionAmount
  );

  if (netAmount < -MONEY_EPSILON) {
    throw new Error(
      "POS_CONTRACT_PRICING_DEDUCTION_EXCEEDS_GROSS"
    );
  }

  return {
    commissionAmount,
    fixedTransactionFee,
    taxAmount,
    additionalFeeAmount,
    totalDeductionAmount,
    netAmount
  };
}

function settlementPartCount(
  command: PosContractPricingCommand
): number {
  if (
    command.rule.workingMode ===
    "MONTHLY_BLOCKED"
  ) {
    return command.installmentCount;
  }

  return 1;
}

function settlementDate(
  command: PosContractPricingCommand,
  index: number
): string {
  const firstDay =
    command.rule.firstSettlementDayCount;

  if (
    command.rule.workingMode ===
    "MONTHLY_BLOCKED"
  ) {
    return addDays(
      command.transactionDate,
      firstDay +
        command.rule.installmentIntervalDayCount *
          index
    );
  }

  return addDays(
    command.transactionDate,
    firstDay
  );
}

function createSchedule(
  command: PosContractPricingCommand,
  totals: ReturnType<typeof calculateTotals>
): PosContractSettlementLine[] {
  const partCount =
    settlementPartCount(command);

  const grossParts = splitMoney(
    command.grossAmount,
    partCount
  );

  const commissionParts = splitMoney(
    totals.commissionAmount,
    partCount
  );

  const fixedFeeParts = splitMoney(
    totals.fixedTransactionFee,
    partCount
  );

  const taxParts = splitMoney(
    totals.taxAmount,
    partCount
  );

  const additionalFeeParts = splitMoney(
    totals.additionalFeeAmount,
    partCount
  );

  const deductionParts = splitMoney(
    totals.totalDeductionAmount,
    partCount
  );

  const netParts = splitMoney(
    totals.netAmount,
    partCount
  );

  return grossParts.map(
    (grossAmount, index) => ({
      sequence: index + 1,
      expectedSettlementDate:
        settlementDate(command, index),
      grossAmount,
      commissionAmount:
        commissionParts[index],
      fixedTransactionFee:
        fixedFeeParts[index],
      taxAmount:
        taxParts[index],
      additionalFeeAmount:
        additionalFeeParts[index],
      totalDeductionAmount:
        deductionParts[index],
      netAmount:
        netParts[index]
    })
  );
}

export function calculatePosContractPricing(
  command: PosContractPricingCommand
): PosContractPricingResult {
  assertValidCommand(command);

  const totals = calculateTotals(
    command.grossAmount,
    command.rule
  );

  const schedule = createSchedule(
    command,
    totals
  );

  return {
    grossAmount:
      roundMoney(command.grossAmount),
    ...totals,
    pendingAmount:
      totals.netAmount,
    expectedFirstSettlementDate:
      schedule[0].expectedSettlementDate,
    expectedFinalSettlementDate:
      schedule[schedule.length - 1]
        .expectedSettlementDate,
    automaticSettlement:
      command.rule.workingMode !== "MANUAL",
    schedule,
    ruleSnapshot: {
      ruleId: command.rule.id,
      posContractId:
        command.rule.posContractId,
      workingMode:
        command.rule.workingMode,
      installmentCount:
        command.rule.installmentCount,
      commissionRate:
        command.rule.commissionRate,
      fixedTransactionFee:
        command.rule.fixedTransactionFee,
      taxRate:
        command.rule.taxRate,
      additionalFeeRate:
        command.rule.additionalFeeRate,
      firstSettlementDayCount:
        command.rule.firstSettlementDayCount,
      installmentIntervalDayCount:
        command.rule.installmentIntervalDayCount
    }
  };
}
