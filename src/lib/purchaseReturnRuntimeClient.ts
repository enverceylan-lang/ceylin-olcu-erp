import type {
  PurchaseReturnRequest,
} from "./purchaseReturnServerContract";

export interface PurchaseServerLine {
  id: string;
  kind: "GOODS" | "SERVICE";
  stockItemId: string | null;
  stockCode: string | null;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountRate: number;
  taxRate: number;
  taxIncluded: boolean;
  netAmount: number;
  taxAmount: number;
  grossAmount: number;
}

export interface PurchaseServerDocument {
  purchaseDocumentId: string;
  documentNo: string;
  supplierId: string;
  supplierName: string | null;
  documentDate: string;
  status: "DRAFT" | "APPROVED";
  grandTotal: number;
  payloadHash: string;
  approvedAt: string | null;
  payableMovementId: string | null;
  lines: PurchaseServerLine[];
}

export interface PurchaseServerReturnLine {
  purchaseReturnId: string;
  purchaseDocumentId: string;
  purchaseDocumentLineId: string;
  quantity: number;
  grossAmount: number;
}

export interface PurchaseServerSnapshot {
  purchases: PurchaseServerDocument[];
  returnLines: PurchaseServerReturnLine[];
}

export interface PurchaseReturnRuntimeResult {
  outcome: "CREATED" | "REPLAY";
  purchaseReturnId: string;
  purchaseDocumentId: string;
  grossAmount: number;
  payableReversalMovementId: string;
  returnedAt: string;
}

async function body<T>(
  response: Response,
  fallback: string,
): Promise<T> {
  const json =
    await response.json()
      .catch(() => null) as
      | {
          success?: boolean;
          result?: T;
          error?: string;
        }
      | null;

  if (
    !response.ok ||
    !json?.success ||
    json.result === undefined
  ) {
    throw new Error(
      json?.error ||
        fallback,
    );
  }

  return json.result;
}

export async function loadPurchaseServerSnapshot():
Promise<PurchaseServerSnapshot> {
  const response =
    await fetch(
      "/api/purchases",
      {
        method: "GET",
        cache: "no-store",
      },
    );

  return body<
    PurchaseServerSnapshot
  >(
    response,
    "PURCHASE_LIST_FAILED",
  );
}

export async function createPurchaseReturnServer(
  request: PurchaseReturnRequest,
): Promise<PurchaseReturnRuntimeResult> {
  const response =
    await fetch(
      "/api/purchases/returns",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        cache: "no-store",
        body:
          JSON.stringify(
            request,
          ),
      },
    );

  return body<
    PurchaseReturnRuntimeResult
  >(
    response,
    "PURCHASE_RETURN_FAILED",
  );
}
