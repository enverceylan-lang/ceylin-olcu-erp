import type {
  SaleStatus
} from "@/store/salesStore";

export type SaleStatusTransitionRejectReason =
  | "ACTOR_REQUIRED"
  | "OCCURRED_AT_INVALID"
  | "SAME_STATUS"
  | "LEGACY_DRAFT_STATUS_NOT_ALLOWED"
  | "APPROVED_SALE_REQUIRES_RETURN"
  | "TRANSITION_NOT_ALLOWED";

export interface SaleStatusTransitionRequest {
  saleId: string;
  fromStatus: SaleStatus;
  toStatus: SaleStatus;
  actorUserId: string;
  occurredAt: string;
  reason?: string;
}

export interface SaleStatusTransitionAudit {
  id: string;
  saleId: string;
  fromStatus: SaleStatus;
  toStatus: SaleStatus;
  actorUserId: string;
  occurredAt: string;
  reason: string | null;
}

export type SaleStatusTransitionResult =
  | {
      outcome: "ACCEPTED";
      audit: SaleStatusTransitionAudit;
    }
  | {
      outcome: "REJECTED";
      reason:
        SaleStatusTransitionRejectReason;
    };

const NEXT_STATUSES:
  Readonly<Record<
    SaleStatus,
    readonly SaleStatus[]
  >> = {
    TASLAK: [
      "ONAYLANDI",
      "İPTAL"
    ],

    TEKLİF: [
      "ONAYLANDI",
      "İPTAL"
    ],

    ONAYLANDI: [
      "SİPARİŞ"
    ],

    SİPARİŞ: [
      "ÜRETİME_GÖNDERİLDİ"
    ],

    ÜRETİME_GÖNDERİLDİ: [
      "MONTAJA_GÖNDERİLDİ"
    ],

    MONTAJA_GÖNDERİLDİ: [
      "TAMAMLANDI"
    ],

    TAMAMLANDI: [],

    İPTAL: []
  };

const APPROVED_OR_LATER:
  readonly SaleStatus[] = [
    "ONAYLANDI",
    "SİPARİŞ",
    "ÜRETİME_GÖNDERİLDİ",
    "MONTAJA_GÖNDERİLDİ",
    "TAMAMLANDI"
  ];

function sourceKey(
  value: string
): string {
  return encodeURIComponent(value);
}

export function getAllowedSaleStatusTransitions(
  currentStatus: SaleStatus
): readonly SaleStatus[] {
  return NEXT_STATUSES[currentStatus];
}

export function canTransitionSaleStatus(
  fromStatus: SaleStatus,
  toStatus: SaleStatus
): boolean {
  return NEXT_STATUSES[
    fromStatus
  ].includes(toStatus);
}

export function requestSaleStatusTransition(
  request: SaleStatusTransitionRequest
): SaleStatusTransitionResult {
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
      reason: "OCCURRED_AT_INVALID"
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
    request.toStatus === "İPTAL" &&
    APPROVED_OR_LATER.includes(
      request.fromStatus
    )
  ) {
    return {
      outcome: "REJECTED",
      reason:
        "APPROVED_SALE_REQUIRES_RETURN"
    };
  }

  if (
    !canTransitionSaleStatus(
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

  const auditId = [
    "sale-status-transition",
    sourceKey(request.saleId),
    sourceKey(request.fromStatus),
    sourceKey(request.toStatus),
    sourceKey(request.occurredAt),
    sourceKey(actorUserId)
  ].join(":");

  return {
    outcome: "ACCEPTED",

    audit: {
      id: auditId,
      saleId: request.saleId,
      fromStatus:
        request.fromStatus,
      toStatus:
        request.toStatus,
      actorUserId,
      occurredAt:
        request.occurredAt,
      reason:
        request.reason?.trim() ||
        null
    }
  };
}