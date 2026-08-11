import type {
  ErpScope
} from "./erpScope";
import type {
  AgendaEvent,
  OperationKind,
  OperationRecord
} from "./operationsWorkflow";

export interface OperationAccessActor {
  userId: string;
  role: string;
}

function normalizeAccessRole(
  role: string
): string {
  const normalized =
    role.trim().toUpperCase();

  if (normalized === "SALES") {
    return "OFFICE";
  }

  if (normalized === "MEASUREMENT") {
    return "FIELD";
  }

  if (normalized === "PRODUCTION") {
    return "TAILOR";
  }

  if (normalized === "INSTALLATION") {
    return "INSTALLER";
  }

  return normalized;
}

function sameScope(
  record: ErpScope,
  scope: ErpScope
): boolean {
  return (
    record.tenantId === scope.tenantId &&
    record.companyId === scope.companyId &&
    record.branchId === scope.branchId &&
    record.accountingPeriodId ===
      scope.accountingPeriodId
  );
}

export function canCreateOperation(
  actor: OperationAccessActor | null
): boolean {
  if (!actor) {
    return false;
  }

  const role =
    normalizeAccessRole(actor.role);

  return (
    role === "ADMIN" ||
    role === "COMPANY_ADMIN" ||
    role === "MODERATOR" ||
    role === "OFFICE"
  );
}

export function canViewAllScopedOperations(
  actor: OperationAccessActor | null
): boolean {
  return canCreateOperation(actor);
}

export function canViewOperation(
  operation: OperationRecord,
  scope: ErpScope,
  actor: OperationAccessActor | null
): boolean {
  if (!actor || !sameScope(operation, scope)) {
    return false;
  }

  if (canViewAllScopedOperations(actor)) {
    return true;
  }

  const role =
    normalizeAccessRole(actor.role);

  if (
    role === "TAILOR" &&
    operation.kind !== "TAILOR"
  ) {
    return false;
  }

  if (
    role === "INSTALLER" &&
    operation.kind !== "INSTALLATION"
  ) {
    return false;
  }

  if (
    role !== "TAILOR" &&
    role !== "INSTALLER"
  ) {
    return false;
  }

  return operation.party?.userId === actor.userId;
}

export function canViewAgendaEvent(
  event: AgendaEvent,
  operation: OperationRecord | undefined,
  scope: ErpScope,
  actor: OperationAccessActor | null
): boolean {
  if (!operation) {
    return false;
  }

  if (
    event.operationId !== operation.id ||
    !sameScope(event, scope)
  ) {
    return false;
  }

  return canViewOperation(
    operation,
    scope,
    actor
  );
}

export function canAssignOperationKind(
  actor: OperationAccessActor | null,
  kind: OperationKind
): boolean {
  if (!canCreateOperation(actor)) {
    return false;
  }

  return (
    kind === "TAILOR" ||
    kind === "SUPPLIER" ||
    kind === "INSTALLATION"
  );
}

export function canAdvanceOperation(
  operation: OperationRecord,
  actor: OperationAccessActor | null
): boolean {
  if (!actor) {
    return false;
  }

  if (canViewAllScopedOperations(actor)) {
    return true;
  }

  return (
    operation.party?.userId === actor.userId &&
    (
      normalizeAccessRole(actor.role) ===
        "TAILOR" ||
      normalizeAccessRole(actor.role) ===
        "INSTALLER"
    )
  );
}