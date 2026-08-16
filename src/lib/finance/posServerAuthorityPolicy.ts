import type { ErpScope } from "@/lib/erpScope";
import type {
  PosServerAuthorityCommand,
  PosServerAuthorityDecision
} from "@/lib/finance/posServerAuthorityContracts";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CURRENCY_RE = /^[A-Z]{3}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function nonBlank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function uuid(value: unknown): value is string {
  return nonBlank(value) && UUID_RE.test(value);
}

function date(value: unknown): value is string {
  if (!nonBlank(value) || !ISO_DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function timestamp(value: unknown): value is string {
  return nonBlank(value) && !Number.isNaN(Date.parse(value));
}

function scopeMatches(command: PosServerAuthorityCommand, scope: ErpScope): boolean {
  return (
    command.tenantId === scope.tenantId &&
    command.companyId === scope.companyId &&
    command.branchId === scope.branchId &&
    command.accountingPeriodId === scope.accountingPeriodId
  );
}

function positive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function nonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function validWorkingMode(value: unknown): boolean {
  return (
    value === "ADVANCE_NET" ||
    value === "MONTHLY_BLOCKED" ||
    value === "BLOCKED_FIXED_DAY" ||
    value === "MANUAL"
  );
}

export function decidePosServerAuthorityContract(
  body: unknown,
  activeScope: ErpScope
): PosServerAuthorityDecision {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { allowed: false, status: 400, code: "INVALID_REQUEST" };
  }

  const raw = (body as { posCommand?: unknown }).posCommand;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { allowed: false, status: 400, code: "POS_COMMAND_REQUIRED" };
  }

  const command = raw as PosServerAuthorityCommand;

  if (
    !nonBlank(command.tenantId) ||
    !nonBlank(command.companyId) ||
    !nonBlank(command.branchId) ||
    !nonBlank(command.accountingPeriodId) ||
    !uuid(command.operationId) ||
    !nonBlank(command.idempotencyKey) ||
    !timestamp(command.occurredAt)
  ) {
    return { allowed: false, status: 400, code: "POS_COMMAND_REQUIRED_FIELD_MISSING" };
  }

  if (!scopeMatches(command, activeScope)) {
    return { allowed: false, status: 403, code: "POS_COMMAND_SCOPE_MISMATCH" };
  }

  if (command.action === "UPSERT_CONTRACT") {
    const value = command.contract;
    if (
      !value ||
      !uuid(value.contractId) ||
      !uuid(value.posAccountId) ||
      !nonBlank(value.contractNumber) ||
      !nonBlank(value.contractName) ||
      !validWorkingMode(value.workingMode) ||
      !nonNegative(value.monthlyFixedFeeAmount) ||
      !nonNegative(value.monthlyFeeTaxRate) ||
      !CURRENCY_RE.test(value.currency) ||
      !date(value.validFrom) ||
      (value.validUntil != null && !date(value.validUntil)) ||
      !uuid(value.accounts.customerReceivableAccountId) ||
      !uuid(value.accounts.commissionExpenseAccountId) ||
      !uuid(value.accounts.taxExpenseAccountId) ||
      !uuid(value.accounts.monthlyFeeExpenseAccountId)
    ) {
      return { allowed: false, status: 400, code: "POS_CONTRACT_INVALID" };
    }
    if (!value.monthlyFixedFeeEnabled && value.monthlyFixedFeeAmount !== 0) {
      return { allowed: false, status: 400, code: "POS_CONTRACT_MONTHLY_FEE_STATE_INVALID" };
    }
    if (value.validUntil && value.validUntil < value.validFrom) {
      return { allowed: false, status: 400, code: "POS_CONTRACT_DATE_RANGE_INVALID" };
    }
    return { allowed: true, command, guard: { mode: "ADMIN" } };
  }

  if (command.action === "UPSERT_RULE") {
    const value = command.rule;
    if (
      !value ||
      !uuid(value.ruleId) ||
      !uuid(value.contractId) ||
      !uuid(value.posAccountId) ||
      !Number.isInteger(value.installmentCount) ||
      value.installmentCount <= 0 ||
      !validWorkingMode(value.workingMode) ||
      !nonNegative(value.commissionRate) ||
      !nonNegative(value.fixedTransactionFee) ||
      !nonNegative(value.taxRate) ||
      !nonNegative(value.additionalFeeRate) ||
      !Number.isInteger(value.firstSettlementDayCount) ||
      value.firstSettlementDayCount < 0 ||
      !Number.isInteger(value.installmentIntervalDayCount) ||
      value.installmentIntervalDayCount < 0
    ) {
      return { allowed: false, status: 400, code: "POS_RULE_INVALID" };
    }
    if (value.workingMode === "MONTHLY_BLOCKED" && value.installmentIntervalDayCount <= 0) {
      return { allowed: false, status: 400, code: "POS_RULE_INTERVAL_REQUIRED" };
    }
    return { allowed: true, command, guard: { mode: "ADMIN" } };
  }

  if (
    command.action === "ARCHIVE_CONTRACT" ||
    command.action === "ARCHIVE_RULE"
  ) {
    if (!command.archive || !uuid(command.archive.id) || !nonBlank(command.archive.reason)) {
      return { allowed: false, status: 400, code: "POS_ARCHIVE_INVALID" };
    }
    return { allowed: true, command, guard: { mode: "ADMIN" } };
  }

  if (command.action === "POST_COLLECTION") {
    const value = command.collection;
    if (
      !value ||
      !uuid(value.transactionId) ||
      !uuid(value.contractId) ||
      !uuid(value.ruleId) ||
      !uuid(value.posAccountId) ||
      !nonBlank(value.posTransactionNumber) ||
      !nonBlank(value.saleId) ||
      !nonBlank(value.saleNumber) ||
      !nonBlank(value.paymentId) ||
      !nonBlank(value.customerId) ||
      !positive(value.grossAmount) ||
      !Number.isInteger(value.installmentCount) ||
      value.installmentCount <= 0 ||
      !date(value.transactionDate) ||
      !CURRENCY_RE.test(value.currency)
    ) {
      return { allowed: false, status: 400, code: "POS_COLLECTION_INVALID" };
    }
    return { allowed: true, command, guard: { mode: "ADMIN" } };
  }

  if (command.action === "SETTLE_TRANSACTION") {
    const value = command.settlement;
    if (
      !value ||
      !uuid(value.transactionId) ||
      !uuid(value.scheduleLineId) ||
      !uuid(value.settlementId) ||
      !nonBlank(value.settlementNumber) ||
      !positive(value.amount) ||
      !date(value.settlementDate)
    ) {
      return { allowed: false, status: 400, code: "POS_SETTLEMENT_INVALID" };
    }
    return { allowed: true, command, guard: { mode: "ADMIN" } };
  }

  if (command.action === "POST_MONTHLY_FEE") {
    const value = command.monthlyFee;
    if (
      !value ||
      !uuid(value.monthlyFeeId) ||
      !uuid(value.contractId) ||
      !nonBlank(value.feeNumber) ||
      !Number.isInteger(value.year) ||
      value.year < 2000 ||
      value.year > 2200 ||
      !Number.isInteger(value.month) ||
      value.month < 1 ||
      value.month > 12 ||
      !date(value.paymentDate)
    ) {
      return { allowed: false, status: 400, code: "POS_MONTHLY_FEE_INVALID" };
    }
    return { allowed: true, command, guard: { mode: "ADMIN" } };
  }

  if (command.action === "REFUND_TRANSACTION") {
    const value = command.refund;
    if (
      !value ||
      !uuid(value.originalTransactionId) ||
      !uuid(value.refundTransactionId) ||
      !nonBlank(value.refundTransactionNumber) ||
      !positive(value.refundAmount) ||
      !date(value.refundDate)
    ) {
      return { allowed: false, status: 400, code: "POS_REFUND_INVALID" };
    }
    return { allowed: true, command, guard: { mode: "ADMIN" } };
  }

  if (command.action === "REVERSE_TRANSACTION") {
    const value = command.reversal;
    if (
      !value ||
      !uuid(value.transactionId) ||
      !uuid(value.reversalTransactionId) ||
      !nonBlank(value.reversalReason) ||
      !timestamp(value.occurredAt)
    ) {
      return { allowed: false, status: 400, code: "POS_REVERSAL_INVALID" };
    }
    return { allowed: true, command, guard: { mode: "ADMIN" } };
  }

  return { allowed: false, status: 400, code: "POS_ACTION_UNSUPPORTED" };
}
