import type {
  SaleReturnStatus
} from "@/lib/saleReturnService";

export type SaleReturnStatusRejectReason =
  | "RETURN_ID_REQUIRED"
  | "ACTOR_REQUIRED"
  | "OCCURRED_AT_INVALID"
  | "SAME_STATUS"
  | "TRANSITION_NOT_ALLOWED";

export interface SaleReturnStatusRequest {
  saleReturnId: string;
  fromStatus: SaleReturnStatus;
  toStatus: SaleReturnStatus;
  actorUserId: string;
  occurredAt: string;
  reason?: string;
}

export interface SaleReturnStatusAudit {
  id: string;
  saleReturnId: string;
  fromStatus: SaleReturnStatus;
  toStatus: SaleReturnStatus;
  actorUserId: string;
  occurredAt: string;
  reason: string | null;
}

export type SaleReturnStatusResult =
  | {
      outcome: "ACCEPTED";
      audit: SaleReturnStatusAudit;
    }
  | {
      outcome: "REJECTED";
      reason:
        SaleReturnStatusRejectReason;
    };

const NEXT_STATUSES:
  Readonly<Record<
    SaleReturnStatus,
    readonly SaleReturnStatus[]
  >> = {
    BAŞLATILDI: [
      "ONAYLANDI",
      "REDDEDİLDİ"
    ],

    ONAYLANDI: [
      "TAMAMLANDI"
    ],

    TAMAMLANDI: [],
    REDDEDİLDİ: []
  };

function sourceKey(
  value: string
): string {
  return encodeURIComponent(
    value.trim()
  );
}

export function getAllowedSaleReturnStatuses(
  status: SaleReturnStatus
): readonly SaleReturnStatus[] {
  return NEXT_STATUSES[status];
}

export function canTransitionSaleReturnStatus(
  fromStatus: SaleReturnStatus,
  toStatus: SaleReturnStatus
): boolean {
  return NEXT_STATUSES[
    fromStatus
  ].includes(toStatus);
}

export function requestSaleReturnStatusTransition(
  request: SaleReturnStatusRequest
): SaleReturnStatusResult {
  const saleReturnId =
    request.saleReturnId.trim();

  if (!saleReturnId) {
    return {
      outcome: "REJECTED",
      reason: "RETURN_ID_REQUIRED"
    };
  }

  const actorUserId =
    request.actorUserId.trim();

  if (!actorUserId) {
    return {
      outcome: "REJECTED",
      reason: "ACTOR_REQUIRED"
    };
  }

  const occurredAt =
    new Date(request.occurredAt);

  if (
    Number.isNaN(
      occurredAt.getTime()
    )
  ) {
    return {
      outcome: "REJECTED",
      reason:
        "OCCURRED_AT_INVALID"
    };
  }

  if (
    request.fromStatus ===
    request.toStatus
  ) {
    return {
      outcome: "REJECTED",
      reason: "SAME_STATUS"
    };
  }

  if (
    !canTransitionSaleReturnStatus(
      request.fromStatus,
      request.toStatus
    )
  ) {
    return {
      outcome: "REJECTED",
      reason:
        "TRANSITION_NOT_ALLOWED"
    };
  }

  const normalizedOccurredAt =
    occurredAt.toISOString();

  const auditId = [
    "sale-return-status",
    sourceKey(saleReturnId),
    sourceKey(request.fromStatus),
    sourceKey(request.toStatus),
    sourceKey(normalizedOccurredAt),
    sourceKey(actorUserId)
  ].join(":");

  return {
    outcome: "ACCEPTED",

    audit: {
      id: auditId,
      saleReturnId,
      fromStatus:
        request.fromStatus,
      toStatus:
        request.toStatus,
      actorUserId,
      occurredAt:
        normalizedOccurredAt,
      reason:
        request.reason?.trim() ||
        null
    }
  };
}