import type { ErpScope } from "./erpScope";

export type InstallationTaskStatus =
  | "READY_FOR_INSTALLATION"
  | "ASSIGNED"
  | "ACCEPTED"
  | "EN_ROUTE"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "DELIVERED"
  | "PROBLEM"
  | "CANCELLED";

export interface InstallationTaskRequest extends ErpScope {
  id: string;
  idempotencyKey: string;
  saleId: string;
  productionOrderId: string;
  customerId: string;
  address: string;
  productionStatus: string;
  qualityChecked: boolean;
  createdByUserId: string;
  createdAt: string;
}

export interface InstallationTask extends InstallationTaskRequest {
  status: InstallationTaskStatus;
  assignedInstallerId?: string;
}

export interface InstallationActor {
  userId: string;
  role: string;
}

export interface InstallationAudit {
  action: "CREATED" | "STATUS_CHANGED";
  actorUserId: string;
  occurredAt: string;
  previousStatus: InstallationTaskStatus | null;
  nextStatus: InstallationTaskStatus;
  taskId: string;
  saleId: string;
  productionOrderId: string;
}

export type InstallationTaskCreationDecision =
  | {
      outcome: "CREATE";
      task: InstallationTask;
      audit: InstallationAudit;
    }
  | { outcome: "REPLAY"; task: InstallationTask }
  | {
      outcome: "REJECT";
      reason:
        | "INVALID_REQUEST"
        | "PRODUCTION_NOT_READY"
        | "QUALITY_CHECK_REQUIRED"
        | "IDEMPOTENCY_CONFLICT"
        | "DUPLICATE_PRODUCTION_ORDER";
    };

export type InstallationTransitionDecision =
  | {
      allowed: true;
      task: InstallationTask;
      audit: InstallationAudit;
    }
  | {
      allowed: false;
      reason:
        | "ROLE_FORBIDDEN"
        | "ASSIGNMENT_REQUIRED"
        | "INSTALLER_REQUIRED"
        | "INVALID_TRANSITION"
        | "TERMINAL_STATUS_LOCKED";
    };

function sameScope(
  left: ErpScope,
  right: ErpScope
): boolean {
  return (
    left.tenantId === right.tenantId &&
    left.companyId === right.companyId &&
    left.branchId === right.branchId &&
    left.accountingPeriodId === right.accountingPeriodId
  );
}

function normalizedRole(role: string): string {
  return role.trim().toLowerCase();
}

function samePayload(
  request: InstallationTaskRequest,
  task: InstallationTask
): boolean {
  return (
    request.id === task.id &&
    request.saleId === task.saleId &&
    request.productionOrderId === task.productionOrderId &&
    request.customerId === task.customerId &&
    request.address === task.address &&
    sameScope(request, task)
  );
}

export function decideInstallationTaskCreation(
  request: InstallationTaskRequest,
  existing: InstallationTask[]
): InstallationTaskCreationDecision {
  const requiredText = [
    request.id,
    request.idempotencyKey,
    request.saleId,
    request.productionOrderId,
    request.customerId,
    request.address,
    request.productionStatus,
    request.createdByUserId,
    request.createdAt,
    request.tenantId,
    request.companyId,
    request.branchId,
    request.accountingPeriodId,
  ];
  if (requiredText.some((value) => value.trim().length === 0)) {
    return { outcome: "REJECT", reason: "INVALID_REQUEST" };
  }
  if (request.productionStatus !== "READY") {
    return { outcome: "REJECT", reason: "PRODUCTION_NOT_READY" };
  }
  if (!request.qualityChecked) {
    return { outcome: "REJECT", reason: "QUALITY_CHECK_REQUIRED" };
  }

  const replay = existing.find(
    (task) =>
      task.idempotencyKey === request.idempotencyKey &&
      sameScope(task, request)
  );
  if (replay) {
    return samePayload(request, replay)
      ? { outcome: "REPLAY", task: replay }
      : { outcome: "REJECT", reason: "IDEMPOTENCY_CONFLICT" };
  }
  if (
    existing.some(
      (task) =>
        task.productionOrderId === request.productionOrderId &&
        task.status !== "CANCELLED" &&
        sameScope(task, request)
    )
  ) {
    return {
      outcome: "REJECT",
      reason: "DUPLICATE_PRODUCTION_ORDER",
    };
  }

  const task: InstallationTask = {
    ...request,
    status: "READY_FOR_INSTALLATION",
  };
  return {
    outcome: "CREATE",
    task,
    audit: {
      action: "CREATED",
      actorUserId: request.createdByUserId,
      occurredAt: request.createdAt,
      previousStatus: null,
      nextStatus: "READY_FOR_INSTALLATION",
      taskId: request.id,
      saleId: request.saleId,
      productionOrderId: request.productionOrderId,
    },
  };
}

export function canViewInstallationTask(
  task: InstallationTask,
  actor: InstallationActor
): boolean {
  const role = normalizedRole(actor.role);
  if (role === "admin" || role === "office") return true;
  return role === "installer" && task.assignedInstallerId === actor.userId;
}

export function decideInstallationTransition(
  task: InstallationTask,
  targetStatus: InstallationTaskStatus,
  actor: InstallationActor,
  occurredAt: string,
  assignedInstallerId?: string
): InstallationTransitionDecision {
  const role = normalizedRole(actor.role);
  const isOffice = role === "admin" || role === "office";
  const isAssignedInstaller =
    role === "installer" && task.assignedInstallerId === actor.userId;

  if (!isOffice && !isAssignedInstaller) {
    return {
      allowed: false,
      reason: role === "installer" ? "ASSIGNMENT_REQUIRED" : "ROLE_FORBIDDEN",
    };
  }
  if (task.status === "DELIVERED" || task.status === "CANCELLED") {
    return { allowed: false, reason: "TERMINAL_STATUS_LOCKED" };
  }

  let nextTask: InstallationTask | undefined;
  if (
    task.status === "READY_FOR_INSTALLATION" &&
    targetStatus === "ASSIGNED" &&
    isOffice
  ) {
    if (!assignedInstallerId?.trim()) {
      return { allowed: false, reason: "INSTALLER_REQUIRED" };
    }
    nextTask = {
      ...task,
      status: "ASSIGNED",
      assignedInstallerId,
    };
  } else if (
    task.status === "ASSIGNED" &&
    targetStatus === "ACCEPTED" &&
    isAssignedInstaller
  ) {
    nextTask = { ...task, status: "ACCEPTED" };
  } else if (
    task.status === "ACCEPTED" &&
    targetStatus === "EN_ROUTE" &&
    isAssignedInstaller
  ) {
    nextTask = { ...task, status: "EN_ROUTE" };
  } else if (
    task.status === "EN_ROUTE" &&
    targetStatus === "IN_PROGRESS" &&
    isAssignedInstaller
  ) {
    nextTask = { ...task, status: "IN_PROGRESS" };
  } else if (
    task.status === "IN_PROGRESS" &&
    targetStatus === "COMPLETED" &&
    isAssignedInstaller
  ) {
    nextTask = { ...task, status: "COMPLETED" };
  } else if (
    task.status === "COMPLETED" &&
    targetStatus === "DELIVERED" &&
    isOffice
  ) {
    nextTask = { ...task, status: "DELIVERED" };
  } else if (
    targetStatus === "PROBLEM" &&
    (isOffice || isAssignedInstaller)
  ) {
    nextTask = { ...task, status: "PROBLEM" };
  } else if (targetStatus === "CANCELLED" && isOffice) {
    nextTask = { ...task, status: "CANCELLED" };
  }

  if (!nextTask) {
    return { allowed: false, reason: "INVALID_TRANSITION" };
  }

  return {
    allowed: true,
    task: nextTask,
    audit: {
      action: "STATUS_CHANGED",
      actorUserId: actor.userId,
      occurredAt,
      previousStatus: task.status,
      nextStatus: targetStatus,
      taskId: task.id,
      saleId: task.saleId,
      productionOrderId: task.productionOrderId,
    },
  };
}
