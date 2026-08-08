import type { ErpScope } from "./erpScope";
import {
  erpScopeMatches,
  validateErpScope
} from "./erpScope";
import type {
  OperationDependencySignal,
  OperationReleaseBlocker
} from "./operationDependencyReleasePolicy";
import {
  decideOperationRelease
} from "./operationDependencyReleasePolicy";

export type OperationKind =
  | "GENERAL"
  | "TAILOR"
  | "SUPPLIER"
  | "INSTALLATION";

export type OperationStatus =
  | "DRAFT"
  | "ASSIGNED"
  | "SENT"
  | "ACCEPTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "PROBLEM"
  | "CANCELLED";

export type OperationPriority =
  | "NORMAL"
  | "PRIORITY"
  | "URGENT";

export type InstallationAssignmentType =
  | "INTERNAL"
  | "EXTERNAL";

export interface OperationParty {
  /*
   * EXTERNAL:
   *   id = providerCustomerId (hakediş/cari kimliği)
   *   userId = giriş yapan kullanıcı kimliği
   *
   * INTERNAL:
   *   id = internal-user:<userId>
   *   userId = şirket içi gerçek kullanıcı kimliği
   *   provider/cari zorunlu değildir.
   *
   * UNASSIGNED:
   *   party oluşturulmaz. İş, atama bekleyen ana operasyonda kalır.
   */
  id: string;
  userId?: string;
  name: string;
  phone?: string;
  assignmentType?: InstallationAssignmentType;
  providerCustomerId?: string;
}

export interface OperationRecord extends ErpScope {
  id: string;
  idempotencyKey: string;
  kind: OperationKind;

  sourceId: string;
  saleId: string;
  parentOperationId?: string;
  customerId: string;
  customerName: string;

  address?: string;
  title: string;
  details: string[];

  party?: OperationParty;

  scheduledAt: string;
  dueAt: string;
  status: OperationStatus;
  priority?: OperationPriority;
  notes?: string;

  createdByUserId: string;
  createdAt: string;
  updatedAt: string;

  sentAt?: string;
  sentByUserId?: string;
  completedAt?: string;
}

export interface AgendaEvent extends ErpScope {
  id: string;
  operationId: string;
  kind: OperationKind;

  title: string;
  customerId: string;
  customerName: string;
  partyName?: string;

  startsAt: string;
  dueAt: string;
  status: OperationStatus;

  address?: string;
  updatedAt: string;
}

export type OperationCreateDecision =
  | {
      outcome: "CREATE";
      operation: OperationRecord;
      agenda: AgendaEvent;
    }
  | {
      outcome: "REPLAY";
      operation: OperationRecord;
    }
  | {
      outcome: "REJECT";
      reason:
        | "INVALID_REQUEST"
        | "IDEMPOTENCY_CONFLICT"
        | "DUPLICATE_ACTIVE_OPERATION";
    };

export type OperationTransitionRejectReason =
  | "ROLE_FORBIDDEN"
  | "ASSIGNMENT_REQUIRED"
  | "INVALID_TRANSITION"
  | "TERMINAL_STATUS_LOCKED"
  | "OPERATION_RELEASE_WAITING"
  | "OPERATION_RELEASE_BLOCKED";

export type OperationTransitionDecision =
  | {
      allowed: true;
      operation: OperationRecord;
      agenda: AgendaEvent;
    }
  | {
      allowed: false;
      reason: OperationTransitionRejectReason;
    };

export interface OperationTransitionContext {
  release?: {
    dependencies: readonly OperationDependencySignal[];
    blockers?: readonly OperationReleaseBlocker[];
  };
}

const RELEASE_GATED_TARGETS = new Set<OperationStatus>([
  "IN_PROGRESS",
  "COMPLETED"
]);

const ALLOWED_TRANSITIONS: Record<
  OperationStatus,
  OperationStatus[]
> = {
  DRAFT: [
    "ASSIGNED",
    "CANCELLED"
  ],
  ASSIGNED: [
    "SENT",
    "ACCEPTED",
    "IN_PROGRESS",
    "COMPLETED",
    "PROBLEM",
    "CANCELLED"
  ],
  SENT: [
    "ACCEPTED",
    "IN_PROGRESS",
    "COMPLETED",
    "PROBLEM",
    "CANCELLED"
  ],
  ACCEPTED: [
    "IN_PROGRESS",
    "COMPLETED",
    "PROBLEM",
    "CANCELLED"
  ],
  IN_PROGRESS: [
    "COMPLETED",
    "PROBLEM",
    "CANCELLED"
  ],
  COMPLETED: [],
  PROBLEM: [
    "ASSIGNED",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED"
  ],
  CANCELLED: []
};

function isIsoDate(value: string): boolean {
  return (
    value.trim().length > 0 &&
    !Number.isNaN(new Date(value).getTime())
  );
}

function samePayload(
  left: OperationRecord,
  right: OperationRecord
): boolean {
  return (
    left.id === right.id &&
    left.kind === right.kind &&
    left.sourceId === right.sourceId &&
    left.saleId === right.saleId &&
    left.customerId === right.customerId &&
    left.party?.id === right.party?.id &&
    left.party?.userId === right.party?.userId &&
    left.party?.assignmentType ===
      right.party?.assignmentType &&
    left.party?.providerCustomerId ===
      right.party?.providerCustomerId &&
    left.scheduledAt === right.scheduledAt &&
    left.dueAt === right.dueAt &&
    erpScopeMatches(left, right)
  );
}

export function buildAgendaEvent(
  operation: OperationRecord
): AgendaEvent {
  return {
    tenantId: operation.tenantId,
    companyId: operation.companyId,
    branchId: operation.branchId,
    accountingPeriodId:
      operation.accountingPeriodId,

    id: `agenda:${operation.id}`,
    operationId: operation.id,
    kind: operation.kind,

    title: operation.title,
    customerId: operation.customerId,
    customerName: operation.customerName,
    partyName: operation.party?.name,

    startsAt: operation.scheduledAt,
    dueAt: operation.dueAt,
    status: operation.status,

    address: operation.address,
    updatedAt: operation.updatedAt
  };
}

export function decideOperationCreation(
  request: OperationRecord,
  existing: OperationRecord[]
): OperationCreateDecision {
  const required = [
    request.id,
    request.idempotencyKey,
    request.sourceId,
    request.saleId,
    request.customerId,
    request.customerName,
    request.title,
    request.createdByUserId,
    request.createdAt,
    request.updatedAt
  ];

  const providerIdentityInvalid =
    (
      request.kind === "TAILOR" ||
      request.kind === "INSTALLATION"
    ) &&
    (
      !request.party?.id?.trim() ||
      !request.party?.userId?.trim()
    );

  if (
    required.some(
      value => value.trim().length === 0
    ) ||
    providerIdentityInvalid ||
    !validateErpScope(request).valid ||
    !isIsoDate(request.scheduledAt) ||
    !isIsoDate(request.dueAt) ||
    new Date(request.dueAt).getTime() <
      new Date(request.scheduledAt).getTime()
  ) {
    return {
      outcome: "REJECT",
      reason: "INVALID_REQUEST"
    };
  }

  const replay = existing.find(
    item =>
      item.idempotencyKey ===
        request.idempotencyKey &&
      erpScopeMatches(item, request)
  );

  if (replay) {
    if (samePayload(request, replay)) {
      return {
        outcome: "REPLAY",
        operation: replay
      };
    }

    return {
      outcome: "REJECT",
      reason: "IDEMPOTENCY_CONFLICT"
    };
  }

  const duplicate = existing.some(
    item =>
      item.kind === request.kind &&
      item.sourceId === request.sourceId &&
      item.status !== "CANCELLED" &&
      erpScopeMatches(item, request)
  );

  if (duplicate) {
    return {
      outcome: "REJECT",
      reason: "DUPLICATE_ACTIVE_OPERATION"
    };
  }

  return {
    outcome: "CREATE",
    operation: request,
    agenda: buildAgendaEvent(request)
  };
}

export function decideOperationTransition(
  operation: OperationRecord,
  target: OperationStatus,
  actor: {
    userId: string;
    role: string;
  },
  occurredAt: string,
  context?: OperationTransitionContext
): OperationTransitionDecision {
  const role = actor.role.trim().toUpperCase();

  const manager =
    role === "COMPANY_ADMIN" ||
    role === "ADMIN" ||
    role === "OFFICE" ||
    role === "MODERATOR";

  const assignedWorker =
    operation.party?.userId === actor.userId;

  if (!manager && !assignedWorker) {
    return {
      allowed: false,
      reason: operation.party
        ? "ASSIGNMENT_REQUIRED"
        : "ROLE_FORBIDDEN"
    };
  }

  if (
    operation.status === "COMPLETED" ||
    operation.status === "CANCELLED"
  ) {
    return {
      allowed: false,
      reason: "TERMINAL_STATUS_LOCKED"
    };
  }

  if (
    !ALLOWED_TRANSITIONS[
      operation.status
    ].includes(target)
  ) {
    return {
      allowed: false,
      reason: "INVALID_TRANSITION"
    };
  }

  if (
    RELEASE_GATED_TARGETS.has(target) &&
    context?.release
  ) {
    const release = decideOperationRelease(
      context.release
    );

    if (!release.released) {
      return {
        allowed: false,
        reason:
          release.state === "BLOCKED"
            ? "OPERATION_RELEASE_BLOCKED"
            : "OPERATION_RELEASE_WAITING"
      };
    }
  }

  const next: OperationRecord = {
    ...operation,
    status: target,
    updatedAt: occurredAt,

    ...(target === "SENT"
      ? {
          sentAt: occurredAt,
          sentByUserId: actor.userId
        }
      : {}),

    ...(target === "COMPLETED"
      ? {
          completedAt: occurredAt
        }
      : {})
  };

  return {
    allowed: true,
    operation: next,
    agenda: buildAgendaEvent(next)
  };
}

export function buildOperationWhatsAppText(
  operation: OperationRecord,
  companyName = "ENVerp"
): string {
  const typeLabel =
    operation.kind === "GENERAL"
      ? "GENEL İŞ TAKİBİ"
      : operation.kind === "TAILOR"
        ? "TERZİ İŞ EMRİ"
        : operation.kind === "SUPPLIER"
          ? "TEDARİKÇİ SİPARİŞİ"
          : "MONTAJ İŞ EMRİ";

  const lines = [
    companyName,
    `*${typeLabel}*`,
    `Müşteri: ${operation.customerName}`,
    `İş: ${operation.title}`,
    `Planlanan: ${new Date(
      operation.scheduledAt
    ).toLocaleString("tr-TR")}`,
    `Termin: ${new Date(
      operation.dueAt
    ).toLocaleString("tr-TR")}`,
    `Öncelik: ${
      operation.priority === "URGENT"
        ? "ACİL"
        : operation.priority === "PRIORITY"
          ? "Öncelikli"
          : "Normal"
    }`,
    operation.address
      ? `Adres: ${operation.address}`
      : "",
    ...operation.details.map(
      detail => `• ${detail}`
    ),
    operation.notes
      ? `Not: ${operation.notes}`
      : ""
  ];

  return lines
    .filter(Boolean)
    .join("\n");
}