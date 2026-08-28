import type {
  ErpScope
} from "./erpScope";

export type PurchaseDocumentStatus =
  | "PENDING_INFO"
  | "DRAFT"
  | "APPROVED"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "CANCELLED";

export type PurchaseLineKind =
  | "GOODS"
  | "SERVICE";

export type PurchaseQuantityUnit =
  | "mt"
  | "m2"
  | "adet"
  | "paket"
  | "set"
  | "kg"
  | "hizmet";

export type PurchaseTaxRate =
  | 0
  | 1
  | 10
  | 20;

export type PurchasePricingStatus =
  | "INCOMPLETE"
  | "COMPLETE";

export interface PurchaseDocumentLine {
  id: string;
  kind: PurchaseLineKind;
  stockItemId?: string;
  stockCode?: string;
  description: string;
  quantity: number;
  unit: PurchaseQuantityUnit;
  unitPrice: number | null;
  discountRate: number;
  taxRate: PurchaseTaxRate | null;
  taxIncluded: boolean | null;
  pricingStatus: PurchasePricingStatus;
  netAmount: number;
  taxAmount: number;
  grossAmount: number;
  receivedQuantity: number;
}

export interface PurchaseDocumentTotals {
  pricingStatus: PurchasePricingStatus;
  subtotal: number;
  discountTotal: number;
  netTotal: number;
  taxTotal: number;
  grandTotal: number;
  receivedValue: number;
  remainingValue: number;
}

export interface PurchaseDocument extends ErpScope {
  id: string;
  idempotencyKey: string;
  documentNo: string | null;
  supplierId: string;
  supplierName: string | null;
  documentDate: string | null;
  dueDate?: string;
  currency: "TRY";
  status: PurchaseDocumentStatus;
  lines: PurchaseDocumentLine[];
  totals: PurchaseDocumentTotals;
  notes?: string;
  sourceOperationId?: string;
  supplierOrderId?: string;
  supplierReceiptId?: string;
  createdByUserId: string;
  approvedByUserId?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePurchaseDocumentRequest extends ErpScope {
  id: string;
  idempotencyKey: string;
  documentNo?: string | null;
  supplierId: string;
  supplierName?: string | null;
  documentDate?: string | null;
  dueDate?: string;
  lines: Array<{
    id: string;
    kind: PurchaseLineKind;
    stockItemId?: string;
    stockCode?: string;
    description: string;
    quantity: number;
    unit: PurchaseQuantityUnit;
    unitPrice?: number | null;
    discountRate?: number;
    taxRate?: PurchaseTaxRate | null;
    taxIncluded?: boolean | null;
    receivedQuantity?: number;
  }>;
  notes?: string;
  sourceOperationId?: string;
  supplierOrderId?: string;
  supplierReceiptId?: string;
  createdByUserId: string;
  now: string;
}

export type PurchaseDocumentRejectionReason =
  | "SCOPE_REQUIRED"
  | "ID_REQUIRED"
  | "IDEMPOTENCY_KEY_REQUIRED"
  | "SUPPLIER_REQUIRED"
  | "ACTOR_REQUIRED"
  | "INVALID_DOCUMENT_DATE"
  | "INVALID_DUE_DATE"
  | "DUE_DATE_BEFORE_DOCUMENT_DATE"
  | "LINE_REQUIRED"
  | "LINE_ID_REQUIRED"
  | "LINE_DESCRIPTION_REQUIRED"
  | "INVALID_QUANTITY"
  | "INVALID_UNIT_PRICE"
  | "INVALID_DISCOUNT_RATE"
  | "INVALID_TAX_RATE"
  | "INVALID_TAX_INCLUDED"
  | "INVALID_RECEIVED_QUANTITY"
  | "STOCK_ITEM_REQUIRED_FOR_GOODS"
  | "DUPLICATE_DOCUMENT_NO"
  | "IDEMPOTENCY_CONFLICT";

export type CreatePurchaseDocumentResult =
  | { outcome: "CREATED"; document: PurchaseDocument }
  | { outcome: "REPLAY"; document: PurchaseDocument }
  | { outcome: "REJECTED"; reason: PurchaseDocumentRejectionReason };
