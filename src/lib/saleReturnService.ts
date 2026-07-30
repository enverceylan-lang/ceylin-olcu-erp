import type {
  SaleStatus
} from "@/store/salesStore";
import {
  validateErpScope,
  type ErpScope
} from "@/lib/erpScope";

export type SaleReturnStatus =
  | "BAŞLATILDI"
  | "ONAYLANDI"
  | "TAMAMLANDI"
  | "REDDEDİLDİ";

export type SaleReturnRejectReason =
  | "SCOPE_REQUIRED"
  | "SALE_ID_REQUIRED"
  | "CUSTOMER_ID_REQUIRED"
  | "ACTOR_REQUIRED"
  | "IDEMPOTENCY_KEY_REQUIRED"
  | "CURRENCY_INVALID"
  | "AMOUNT_INVALID"
  | "AMOUNT_EXCEEDS_RETURNABLE"
  | "SALE_STATUS_NOT_RETURNABLE"
  | "OCCURRED_AT_INVALID";

export interface CreateSaleReturnRequest
  extends ErpScope {
  saleId: string;
  customerId: string;
  saleStatus: SaleStatus;
  actorUserId: string;
  amount: number;
  returnableAmount: number;
  currency: string;
  reason?: string;
  occurredAt: string;
  idempotencyKey: string;
}

export interface SaleReturnDocument
  extends ErpScope {
  id: string;
  saleId: string;
  customerId: string;
  status: SaleReturnStatus;
  actorUserId: string;
  amount: number;
  currency: string;
  reason: string | null;
  occurredAt: string;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateSaleReturnResult =
  | {
      outcome: "ACCEPTED";
      saleReturn: SaleReturnDocument;
    }
  | {
      outcome: "REJECTED";
      reason: SaleReturnRejectReason;
    };

const RETURNABLE_SALE_STATUSES:
  readonly SaleStatus[] = [
    "ONAYLANDI",
    "SİPARİŞ",
    "ÜRETİME_GÖNDERİLDİ",
    "MONTAJA_GÖNDERİLDİ",
    "TAMAMLANDI"
  ];

function normalizeRequired(
  value: string
): string {
  return value.trim();
}

function sourceKey(
  value: string
): string {
  return encodeURIComponent(
    value.trim()
  );
}

export function canStartSaleReturn(
  saleStatus: SaleStatus
): boolean {
  return RETURNABLE_SALE_STATUSES.includes(
    saleStatus
  );
}

export function createSaleReturn(
  request: CreateSaleReturnRequest
): CreateSaleReturnResult {
  const scopeValidation =
    validateErpScope({
      tenantId: request.tenantId,
      companyId: request.companyId,
      branchId: request.branchId,
      accountingPeriodId:
        request.accountingPeriodId
    });

  if (!scopeValidation.valid) {
    return {
      outcome: "REJECTED",
      reason: "SCOPE_REQUIRED"
    };
  }

  const saleId =
    normalizeRequired(request.saleId);

  if (!saleId) {
    return {
      outcome: "REJECTED",
      reason: "SALE_ID_REQUIRED"
    };
  }

  const customerId =
    normalizeRequired(
      request.customerId
    );

  if (!customerId) {
    return {
      outcome: "REJECTED",
      reason: "CUSTOMER_ID_REQUIRED"
    };
  }

  const actorUserId =
    normalizeRequired(
      request.actorUserId
    );

  if (!actorUserId) {
    return {
      outcome: "REJECTED",
      reason: "ACTOR_REQUIRED"
    };
  }

  const idempotencyKey =
    normalizeRequired(
      request.idempotencyKey
    );

  if (!idempotencyKey) {
    return {
      outcome: "REJECTED",
      reason:
        "IDEMPOTENCY_KEY_REQUIRED"
    };
  }

  const currency =
    normalizeRequired(
      request.currency
    ).toUpperCase();

  if (!/^[A-Z]{3}$/.test(currency)) {
    return {
      outcome: "REJECTED",
      reason: "CURRENCY_INVALID"
    };
  }

  if (
    !Number.isFinite(request.amount) ||
    request.amount <= 0 ||
    !Number.isFinite(
      request.returnableAmount
    ) ||
    request.returnableAmount < 0
  ) {
    return {
      outcome: "REJECTED",
      reason: "AMOUNT_INVALID"
    };
  }

  if (
    request.amount >
    request.returnableAmount
  ) {
    return {
      outcome: "REJECTED",
      reason:
        "AMOUNT_EXCEEDS_RETURNABLE"
    };
  }

  if (
    !canStartSaleReturn(
      request.saleStatus
    )
  ) {
    return {
      outcome: "REJECTED",
      reason:
        "SALE_STATUS_NOT_RETURNABLE"
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

  const normalizedOccurredAt =
    occurredAt.toISOString();

  const id = [
    "sale-return",
    sourceKey(request.tenantId),
    sourceKey(request.companyId),
    sourceKey(request.branchId),
    sourceKey(
      request.accountingPeriodId
    ),
    sourceKey(idempotencyKey)
  ].join(":");

  return {
    outcome: "ACCEPTED",

    saleReturn: {
      tenantId: request.tenantId,
      companyId: request.companyId,
      branchId: request.branchId,
      accountingPeriodId:
        request.accountingPeriodId,

      id,
      saleId,
      customerId,
      status: "BAŞLATILDI",
      actorUserId,
      amount: request.amount,
      currency,
      reason:
        request.reason?.trim() ||
        null,
      occurredAt:
        normalizedOccurredAt,
      idempotencyKey,
      createdAt:
        normalizedOccurredAt,
      updatedAt:
        normalizedOccurredAt
    }
  };
}