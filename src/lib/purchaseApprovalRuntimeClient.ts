import type {
  PurchaseApprovalRequest,
  PurchaseDraftPersistRequest,
  PurchasePrice1Update,
} from "./purchaseApprovalServerContract";

export interface PurchaseDraftRuntimeResult {
  outcome:
    | "CREATED"
    | "UPDATED"
    | "REPLAY";
  purchaseDocumentId: string;
  payloadHash: string;
  updatedAt: string;
}

export interface PurchaseApprovalRuntimeResult {
  outcome:
    | "CREATED"
    | "REPLAY";
  purchaseDocumentId: string;
  payableMovementId: string;
  price1Updates:
    PurchasePrice1Update[];
  approvedAt: string;
}

async function readResult<T>(
  response: Response,
  fallback: string,
): Promise<T> {
  const body =
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
    !body?.success ||
    !body.result
  ) {
    throw new Error(
      body?.error ||
        fallback,
    );
  }

  return body.result;
}

export async function persistPurchaseDraftServer(
  request:
    PurchaseDraftPersistRequest,
): Promise<
  PurchaseDraftRuntimeResult
> {
  const response =
    await fetch(
      "/api/purchases/draft",
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

  return readResult<
    PurchaseDraftRuntimeResult
  >(
    response,
    "PURCHASE_DRAFT_PERSIST_FAILED",
  );
}

export async function approvePurchaseDocumentServer(
  request:
    PurchaseApprovalRequest,
): Promise<
  PurchaseApprovalRuntimeResult
> {
  const response =
    await fetch(
      "/api/purchases/approve",
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

  return readResult<
    PurchaseApprovalRuntimeResult
  >(
    response,
    "PURCHASE_APPROVAL_FAILED",
  );
}
