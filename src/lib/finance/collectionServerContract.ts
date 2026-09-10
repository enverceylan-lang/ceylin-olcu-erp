import type { ErpScope } from "@/lib/erpScope";
import type { CreateCollectionCommand } from "@/lib/finance/collectionContracts";
import type {
  ReverseCollectionCommand,
  TransitionReceivableInstrumentCommand
} from "@/lib/finance/collectionContracts";
import {
  validateCreateCollectionCommand,
  validateReverseCollectionCommand,
  validateTransitionReceivableInstrumentCommand
} from "@/lib/finance/collectionPolicy";
import { resolveFinanceChannelPermission } from "@/lib/finance/financeChannelPermissions";
import type { FinanceChannelOperation } from "@/lib/finance/financeChannelPermissions";

export type CollectionServerDecision =
  | {
      allowed: true;
      command: CreateCollectionCommand;
      requestedPermission: string;
      operation: FinanceChannelOperation;
    }
  | { allowed: false; status: 400 | 403; code: string };

function sameScope(command: CreateCollectionCommand, scope: ErpScope): boolean {
  return command.tenantId === scope.tenantId && command.companyId === scope.companyId &&
    command.branchId === scope.branchId && command.accountingPeriodId === scope.accountingPeriodId;
}

function scopeMatches(command: ErpScope, scope: ErpScope): boolean {
  return command.tenantId === scope.tenantId && command.companyId === scope.companyId &&
    command.branchId === scope.branchId && command.accountingPeriodId === scope.accountingPeriodId;
}

export type CollectionReversalServerDecision =
  | { allowed: true; command: ReverseCollectionCommand; requestedPermission: string; operation: "COLLECTION" }
  | { allowed: false; status: 400 | 403; code: string };

export function decideCollectionReversalServerContract(
  body: unknown,
  activeScope: ErpScope
): CollectionReversalServerDecision {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { allowed: false, status: 400, code: "INVALID_REQUEST" };
  }
  const raw = (body as { collectionReversalCommand?: unknown }).collectionReversalCommand;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { allowed: false, status: 400, code: "FINANCE_COLLECTION_REVERSAL_COMMAND_REQUIRED" };
  }
  const command = raw as ReverseCollectionCommand;
  const validation = validateReverseCollectionCommand(command);
  if (!validation.ok) return { allowed: false, status: 400, code: validation.reason || "FINANCE_COLLECTION_REVERSAL_INVALID" };
  if (!scopeMatches(command, activeScope)) return { allowed: false, status: 403, code: "FINANCE_COLLECTION_SCOPE_MISMATCH" };
  const permission = resolveFinanceChannelPermission({ channel: command.channel, operation: "COLLECTION", direction: "REVERSE" });
  if (!permission) return { allowed: false, status: 403, code: "FINANCE_COLLECTION_PERMISSION_MAPPING_MISSING" };
  return { allowed: true, command, requestedPermission: permission.permission, operation: "COLLECTION" };
}

export type InstrumentTransitionServerDecision =
  | {
      allowed: true;
      command: TransitionReceivableInstrumentCommand;
      requestedPermission: string;
      operation: "RECEIPT" | "ISSUE";
      direction: "CREATE" | "REVERSE";
    }
  | { allowed: false; status: 400 | 403; code: string };

export function decideInstrumentTransitionServerContract(
  body: unknown,
  activeScope: ErpScope
): InstrumentTransitionServerDecision {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { allowed: false, status: 400, code: "INVALID_REQUEST" };
  }
  const raw = (body as { instrumentTransitionCommand?: unknown }).instrumentTransitionCommand;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { allowed: false, status: 400, code: "FINANCE_INSTRUMENT_TRANSITION_COMMAND_REQUIRED" };
  }
  const command = raw as TransitionReceivableInstrumentCommand;
  const validation = validateTransitionReceivableInstrumentCommand(command);
  if (!validation.ok) return { allowed: false, status: 400, code: validation.reason || "FINANCE_INSTRUMENT_TRANSITION_INVALID" };
  if (!scopeMatches(command, activeScope)) return { allowed: false, status: 403, code: "FINANCE_INSTRUMENT_SCOPE_MISMATCH" };
  const direction = command.toState === "RETURNED" || command.toState === "CANCELLED" ? "REVERSE" : "CREATE";
  const operation = command.toState === "ENDORSED" ||
    (command.toState === "RETURNED" && command.fromState === "ENDORSED") ? "ISSUE" : "RECEIPT";
  const permission = resolveFinanceChannelPermission({
    channel: command.instrumentType,
    operation,
    direction
  });
  if (!permission) return { allowed: false, status: 403, code: "FINANCE_INSTRUMENT_PERMISSION_MAPPING_MISSING" };
  return { allowed: true, command, requestedPermission: permission.permission, operation, direction };
}

export function decideCollectionServerContract(
  body: unknown,
  activeScope: ErpScope
): CollectionServerDecision {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { allowed: false, status: 400, code: "INVALID_REQUEST" };
  }
  const raw = (body as { collectionCommand?: unknown }).collectionCommand;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { allowed: false, status: 400, code: "FINANCE_COLLECTION_COMMAND_REQUIRED" };
  }
  const command = raw as CreateCollectionCommand;
  const validation = validateCreateCollectionCommand(command);
  if (!validation.ok) {
    return { allowed: false, status: 400, code: validation.reason || "FINANCE_COLLECTION_INVALID" };
  }
  if (!sameScope(command, activeScope)) {
    return { allowed: false, status: 403, code: "FINANCE_COLLECTION_SCOPE_MISMATCH" };
  }
  const operation: FinanceChannelOperation =
    command.channel === "CHEQUE" || command.channel === "NOTE" ? "RECEIPT" : "COLLECTION";
  const permission = resolveFinanceChannelPermission({
    channel: command.channel,
    operation,
    direction: "CREATE"
  });
  if (!permission) {
    return { allowed: false, status: 403, code: "FINANCE_COLLECTION_PERMISSION_MAPPING_MISSING" };
  }
  return { allowed: true, command, requestedPermission: permission.permission, operation };
}
