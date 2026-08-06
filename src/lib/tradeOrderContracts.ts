import type { ErpScope } from "@/lib/erpScope";

export type TradeOrderPerspective =
  | "PURCHASE"
  | "SALES";

export type TradeOrderStatus =
  | "DRAFT"
  | "ACCEPTED"
  | "PREPARING"
  | "READY"
  | "SHIPPED"
  | "RECEIVED"
  | "CANCELLED";

export interface TradeOrderLink extends ErpScope {
  id: string;
  idempotencyKey: string;

  perspective: TradeOrderPerspective;

  localDocumentId: string;
  localDocumentType:
    | "PURCHASE_ORDER"
    | "SALES_ORDER";

  counterpartyTenantId?: string;
  counterpartyCompanyId?: string;
  counterpartyDocumentId?: string;

  customerId?: string;
  supplierId?: string;

  status: TradeOrderStatus;

  createdAt: string;
  updatedAt: string;
}

export interface SharedTradeOrderStatusEvent {
  id: string;
  idempotencyKey: string;

  sourceTenantId: string;
  sourceCompanyId: string;

  targetTenantId: string;
  targetCompanyId: string;

  sourceDocumentId: string;
  targetDocumentId?: string;

  status:
    | "ACCEPTED"
    | "PREPARING"
    | "READY"
    | "SHIPPED"
    | "RECEIVED"
    | "CANCELLED";

  occurredAt: string;
}

function hasText(
  value: string | undefined
): boolean {
  return Boolean(value?.trim());
}

export function validateTradeOrderLink(
  link: TradeOrderLink
): string[] {
  const errors: string[] = [];

  const scope = [
    link.tenantId,
    link.companyId,
    link.branchId,
    link.accountingPeriodId
  ];

  if (scope.some(value => !hasText(value))) {
    errors.push("Ticari sipariş kapsamı eksik.");
  }

  if (
    !hasText(link.id) ||
    !hasText(link.idempotencyKey) ||
    !hasText(link.localDocumentId)
  ) {
    errors.push("Ticari sipariş kimliği eksik.");
  }

  if (
    link.perspective === "PURCHASE" &&
    !hasText(link.supplierId)
  ) {
    errors.push(
      "Satın alma perspektifinde tedarikçi zorunludur."
    );
  }

  if (
    link.perspective === "SALES" &&
    !hasText(link.customerId)
  ) {
    errors.push(
      "Satış perspektifinde müşteri zorunludur."
    );
  }

  if (
    Boolean(link.counterpartyTenantId) !==
    Boolean(link.counterpartyCompanyId)
  ) {
    errors.push(
      "Karşı şirket tenant ve company kimlikleri birlikte bulunmalıdır."
    );
  }

  return errors;
}

export function buildSharedTradeOrderStatusEvent(
  link: TradeOrderLink,
  status:
    SharedTradeOrderStatusEvent["status"],
  occurredAt: string
): SharedTradeOrderStatusEvent | null {
  if (
    !link.counterpartyTenantId ||
    !link.counterpartyCompanyId
  ) {
    return null;
  }

  return {
    id:
      `trade-status:${link.id}:${status}:${occurredAt}`,
    idempotencyKey:
      `TRADE_STATUS:${link.id}:${status}:${occurredAt}`,
    sourceTenantId:
      link.tenantId,
    sourceCompanyId:
      link.companyId,
    targetTenantId:
      link.counterpartyTenantId,
    targetCompanyId:
      link.counterpartyCompanyId,
    sourceDocumentId:
      link.localDocumentId,
    targetDocumentId:
      link.counterpartyDocumentId,
    status,
    occurredAt
  };
}