import type { ErpScope } from "@/lib/erpScope";
import {
  resolveFinanceChannelPermission,
  type FinanceChannelOperation
} from "@/lib/finance/financeChannelPermissions";
import type {
  FinanceOperationCommand
} from "@/lib/finance/financeOperationsContracts";
import {
  validateFinanceOperationCommand
} from "@/lib/finance/financeOperationsPolicy";

export type FinanceServerOperationDecision =
  | {
      allowed: true;
      command: FinanceOperationCommand;
      guard: {
        channel: FinanceOperationCommand["channel"];
        operation: FinanceChannelOperation;
        direction: FinanceOperationCommand["action"];
        requestedPermission: string;
      };
    }
  | {
      allowed: false;
      status: 400 | 403;
      code: string;
    };

function scopeMatches(command: FinanceOperationCommand, scope: ErpScope): boolean {
  return (
    command.tenantId === scope.tenantId &&
    command.companyId === scope.companyId &&
    command.branchId === scope.branchId &&
    command.accountingPeriodId === scope.accountingPeriodId
  );
}

function operationFor(command: FinanceOperationCommand): FinanceChannelOperation | null {
  if (command.kind === "COLLECTION") return "COLLECTION";
  if (command.kind === "PAYMENT") return "PAYMENT";
  if (command.kind === "TRANSFER") return "TRANSFER";
  if (command.kind === "REFUND") return "REFUND";
  return null;
}

function hasUuidShape(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function decideFinanceServerOperationContract(
  body: unknown,
  activeScope: ErpScope
): FinanceServerOperationDecision {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { allowed: false, status: 400, code: "INVALID_REQUEST" };
  }

  const command = (body as { command?: unknown }).command;
  if (!command || typeof command !== "object" || Array.isArray(command)) {
    return { allowed: false, status: 400, code: "INVALID_REQUEST" };
  }

  const typed = command as FinanceOperationCommand;
  const validation = validateFinanceOperationCommand(typed);
  if (!validation.ok) {
    return {
      allowed: false,
      status: 400,
      code: validation.reason ?? "FINANCE_OPERATION_INVALID"
    };
  }

  if (!scopeMatches(typed, activeScope)) {
    return { allowed: false, status: 403, code: "FINANCE_OPERATION_SCOPE_MISMATCH" };
  }

  if (typed.channel === "CHEQUE" || typed.channel === "NOTE") {
    return {
      allowed: false,
      status: 400,
      code: "FINANCE_INSTRUMENT_LIFECYCLE_REQUIRED"
    };
  }

  if (typed.channel === "CASH" && !hasUuidShape(typed.accounts.cashAccountId)) {
    return { allowed: false, status: 400, code: "FINANCE_CASH_ACCOUNT_UUID_REQUIRED" };
  }

  if (typed.channel === "BANK" && !hasUuidShape(typed.accounts.bankAccountId)) {
    return { allowed: false, status: 400, code: "FINANCE_BANK_ACCOUNT_UUID_REQUIRED" };
  }

  if (typed.channel === "POS" && !hasUuidShape(typed.accounts.posAccountId)) {
    return { allowed: false, status: 400, code: "FINANCE_POS_ACCOUNT_UUID_REQUIRED" };
  }

  if (typed.kind === "TRANSFER") {
    if (
      !hasUuidShape(typed.accounts.sourceBankAccountId) ||
      !hasUuidShape(typed.accounts.destinationBankAccountId) ||
      typed.accounts.sourceBankAccountId === typed.accounts.destinationBankAccountId
    ) {
      return {
        allowed: false,
        status: 400,
        code: "FINANCE_TRANSFER_BANK_PAIR_INVALID"
      };
    }
  }

  if (
    typed.action === "CREATE" &&
    typed.kind !== "TRANSFER" &&
    !hasUuidShape(typed.accounts.counterAccountId)
  ) {
    return {
      allowed: false,
      status: 400,
      code: "FINANCE_COUNTER_LEDGER_UUID_REQUIRED"
    };
  }

  const operation = operationFor(typed);
  if (!operation) {
    return {
      allowed: false,
      status: 400,
      code: "FINANCE_OPERATION_KIND_UNSUPPORTED"
    };
  }

  const permission = resolveFinanceChannelPermission({
    channel: typed.channel,
    operation,
    direction: typed.action
  });

  if (!permission) {
    return {
      allowed: false,
      status: 403,
      code: "FINANCE_OPERATION_PERMISSION_MAPPING_MISSING"
    };
  }

  return {
    allowed: true,
    command: typed,
    guard: {
      channel: typed.channel,
      operation,
      direction: typed.action,
      requestedPermission: permission.permission
    }
  };
}