import {
  decideOperationTransition,
  type OperationRecord,
  type OperationStatus
} from "./operationsWorkflow";

export type OperationAttentionReasonCode =
  | "OVERDUE"
  | "DUE_SOON"
  | "PROBLEM"
  | "URGENT";

export interface OperationAttentionReason {
  code: OperationAttentionReasonCode;
  severity:
    | "INFO"
    | "WARNING"
    | "CRITICAL";
  message: string;
}

export interface OperationCommandCenterSummary {
  total: number;
  active: number;
  critical: number;
  dueSoon: number;
  problem: number;
  completed: number;
}

const OPERATION_STATUS_CANDIDATES:
  OperationStatus[] = [
    "ASSIGNED",
    "SENT",
    "ACCEPTED",
    "IN_PROGRESS",
    "COMPLETED",
    "PROBLEM",
    "CANCELLED"
  ];

function normalizeSearchValue(
  value: unknown
): string {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR");
}

export function matchesOperationSearch(
  operation: OperationRecord,
  query: string
): boolean {
  const normalizedQuery =
    normalizeSearchValue(query);

  if (!normalizedQuery) {
    return true;
  }

  const haystack = [
    operation.title,
    operation.customerName,
    operation.kind,
    operation.status,
    operation.party?.name,
    operation.notes,
    ...(operation.details ?? [])
  ]
    .map(normalizeSearchValue)
    .join(" ");

  return haystack.includes(
    normalizedQuery
  );
}

export function deriveOperationAttention(
  operation: OperationRecord,
  now: Date
): OperationAttentionReason[] {
  if (
    operation.status === "COMPLETED" ||
    operation.status === "CANCELLED"
  ) {
    return [];
  }

  const reasons:
    OperationAttentionReason[] = [];

  const nowMs = now.getTime();
  const dueMs =
    new Date(
      operation.dueAt
    ).getTime();

  if (
    Number.isFinite(dueMs) &&
    dueMs < nowMs
  ) {
    reasons.push({
      code: "OVERDUE",
      severity: "CRITICAL",
      message: "Termin geçti"
    });
  } else if (
    Number.isFinite(dueMs) &&
    dueMs <=
      nowMs + 24 * 60 * 60 * 1000
  ) {
    reasons.push({
      code: "DUE_SOON",
      severity: "WARNING",
      message: "Termin 24 saat içinde"
    });
  }

  if (
    operation.status === "PROBLEM"
  ) {
    reasons.push({
      code: "PROBLEM",
      severity: "CRITICAL",
      message: "Operasyonda sorun bildirildi"
    });
  }

  if (
    operation.priority === "URGENT"
  ) {
    reasons.push({
      code: "URGENT",
      severity: "CRITICAL",
      message: "Acil öncelik"
    });
  }

  return reasons;
}

export function buildOperationCommandCenterSummary(
  operations: OperationRecord[],
  now: Date
): OperationCommandCenterSummary {
  let active = 0;
  let critical = 0;
  let dueSoon = 0;
  let problem = 0;
  let completed = 0;

  for (const operation of operations) {
    if (
      operation.status === "COMPLETED"
    ) {
      completed += 1;
      continue;
    }

    if (
      operation.status === "CANCELLED"
    ) {
      continue;
    }

    active += 1;

    const reasons =
      deriveOperationAttention(
        operation,
        now
      );

    if (
      reasons.some(
        item =>
          item.severity === "CRITICAL"
      )
    ) {
      critical += 1;
    }

    if (
      reasons.some(
        item =>
          item.code === "DUE_SOON"
      )
    ) {
      dueSoon += 1;
    }

    if (
      reasons.some(
        item =>
          item.code === "PROBLEM"
      )
    ) {
      problem += 1;
    }
  }

  return {
    total: operations.length,
    active,
    critical,
    dueSoon,
    problem,
    completed
  };
}

export interface OperationReadinessProjection {
  code:
    | "READY"
    | "WAITING"
    | "BLOCKED"
    | "COMPLETE"
    | "CLOSED";
  label: string;
  message: string;
}

export interface OperationRiskProjection {
  level:
    | "LOW"
    | "MEDIUM"
    | "HIGH";
  label: string;
  reasons: OperationAttentionReason[];
}

export interface OperationTimelineItem {
  code:
    | "CREATED"
    | "SENT"
    | "UPDATED"
    | "COMPLETED";
  label: string;
  occurredAt: string;
}

export function deriveOperationReadiness(
  operation: OperationRecord
): OperationReadinessProjection {
  if (operation.status === "COMPLETED") {
    return {
      code: "COMPLETE",
      label: "Tamamlandı",
      message: "Operasyon tamamlanmış durumda."
    };
  }

  if (operation.status === "CANCELLED") {
    return {
      code: "CLOSED",
      label: "Kapalı",
      message: "Operasyon iptal edilerek kapatılmış."
    };
  }

  if (operation.status === "PROBLEM") {
    return {
      code: "BLOCKED",
      label: "Engelli",
      message: "Sorun çözülmeden normal akışa devam edilmemeli."
    };
  }

  const assignmentRequired =
    operation.kind === "TAILOR" ||
    operation.kind === "INSTALLATION";

  if (
    assignmentRequired &&
    !operation.party?.userId
  ) {
    return {
      code: "BLOCKED",
      label: "Atama Bekliyor",
      message: "İşi yürütecek kişi henüz kesin olarak atanmış değil."
    };
  }

  if (
    operation.status === "DRAFT" ||
    operation.status === "ASSIGNED"
  ) {
    return {
      code: "WAITING",
      label: "Hazırlanıyor",
      message: "Operasyon yürütme öncesi hazırlık aşamasında."
    };
  }

  return {
    code: "READY",
    label: "Yürütülebilir",
    message: "Mevcut kayıt, aktif operasyon akışında ilerleyebilir."
  };
}

export function deriveOperationRisk(
  operation: OperationRecord,
  now: Date
): OperationRiskProjection {
  const reasons =
    deriveOperationAttention(
      operation,
      now
    );

  if (
    reasons.some(
      item =>
        item.severity === "CRITICAL"
    )
  ) {
    return {
      level: "HIGH",
      label: "Yüksek Risk",
      reasons
    };
  }

  if (
    reasons.some(
      item =>
        item.severity === "WARNING"
    )
  ) {
    return {
      level: "MEDIUM",
      label: "Dikkat",
      reasons
    };
  }

  return {
    level: "LOW",
    label: "Normal",
    reasons
  };
}

export function buildOperationTimeline(
  operation: OperationRecord
): OperationTimelineItem[] {
  const items: OperationTimelineItem[] = [
    {
      code: "CREATED",
      label: "Operasyon oluşturuldu",
      occurredAt: operation.createdAt
    }
  ];

  if (operation.sentAt) {
    items.push({
      code: "SENT",
      label: "İş gönderildi",
      occurredAt: operation.sentAt
    });
  }

  if (
    operation.updatedAt &&
    operation.updatedAt !==
      operation.createdAt &&
    operation.updatedAt !==
      operation.sentAt &&
    operation.updatedAt !==
      operation.completedAt
  ) {
    items.push({
      code: "UPDATED",
      label: "Kayıt güncellendi",
      occurredAt: operation.updatedAt
    });
  }

  if (operation.completedAt) {
    items.push({
      code: "COMPLETED",
      label: "Operasyon tamamlandı",
      occurredAt: operation.completedAt
    });
  }

  return items
    .filter(
      item =>
        item.occurredAt.trim().length > 0 &&
        !Number.isNaN(
          new Date(
            item.occurredAt
          ).getTime()
        )
    )
    .sort(
      (left, right) =>
        new Date(
          left.occurredAt
        ).getTime() -
        new Date(
          right.occurredAt
        ).getTime()
    );
}
export function resolveNextAllowedOperationStatus(
  operation: OperationRecord,
  actor: {
    userId: string;
    role: string;
  } | null,
  occurredAt: string
): OperationStatus | null {
  if (!actor) {
    return null;
  }

  for (
    const candidate
    of OPERATION_STATUS_CANDIDATES
  ) {
    if (
      candidate === operation.status
    ) {
      continue;
    }

    const decision =
      decideOperationTransition(
        operation,
        candidate,
        actor,
        occurredAt
      );

    if (decision.allowed) {
      return candidate;
    }
  }

  return null;
}