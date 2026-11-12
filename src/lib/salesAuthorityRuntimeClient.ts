import type { ErpScope } from "@/lib/erpScope";
import type {
  Sale,
} from "@/store/salesStore";
import { useAuthStore } from "@/store/useAuthStore";
import type {
  SaleReturnDocument,
} from "@/lib/saleReturnService";
import {
  buildApprovedSaleLineSourcePayloadV1,
} from "@/lib/saleLineSourceProducerClient";

import type { MainOperationW1Result } from "@/lib/mainOperationW1";
import { useOperationsStore } from "@/store/useOperationsStore";

type AuthorityResponse = {
  success: boolean;
  error?: string;
  result?: { outcome?: string };
  mainOperation?: MainOperationW1Result;
};

function sessionToken(): string {
  const token =
    useAuthStore.getState().sessionToken?.trim() || "";
  if (!token) {
    throw new Error("SALES_AUTHORITY_SESSION_REQUIRED");
  }
  return token;
}

async function postAuthority(
  path: string,
  body: unknown,
): Promise<AuthorityResponse> {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionToken()}`,
    },
    cache: "no-store",
    body: JSON.stringify(body),
  });

  const payload =
    (await response.json().catch(() => null)) as
      | AuthorityResponse
      | null;

  if (!response.ok || !payload?.success) {
    throw new Error(
      payload?.error ||
        `SALES_AUTHORITY_HTTP_${response.status}`,
    );
  }

  return payload;
}

export async function persistDraftSaleServerAuthority(input: {
  sale: Sale;
  scope: ErpScope;
  sourceStatus: "TASLAK" | "TEKLİF";
}): Promise<void> {
  await postAuthority(
    "/api/sales/authority/persist",
    {
      ...input.scope,
      saleId: input.sale.id,
      customerId: input.sale.customerId,
      customerAddressId: input.sale.customerAddressId || null,
      customerAddressSnapshot: input.sale.customerAddressSnapshot || null,
      saleNumber: input.sale.saleNo || null,
      status: input.sourceStatus,
      totalAmount: Number(input.sale.totalAmount || 0),
      currency: "TRY",
    },
  );
}

export async function approveSaleServerAuthority(input: {
  sale: Sale;
  scope: ErpScope;
  currency?: string;
}) {
  const lineSource =
    buildApprovedSaleLineSourcePayloadV1({
      sale: input.sale,
      scope: input.scope,
      currency: input.currency || "TRY",
    });

  const response = await postAuthority(
    "/api/sales/authority/approve",
    {
      ...input.scope,
      saleId: input.sale.id,
      lineSource,
    },
  );
  return {
    replay: response.result?.outcome === "REPLAY",
    operationMessage: applyMainOperation(input.scope, response.mainOperation),
  };
}

function applyMainOperation(scope: ErpScope, result?: MainOperationW1Result): string | null {
  if (!result?.ok) {
    return `Satış onayı kesinleşmiş olabilir. Merkezi ana operasyon doğrulanamadı (${result?.error ?? "W1_RESPONSE_MISSING"}). Ana operasyonu tekrar deneyin.`;
  }
  const conflicts = useOperationsStore.getState().mergeCentralMainOperations(scope, [result.operation]);
  return conflicts.length ? "Merkezi ana operasyon ile yerel kayıt çelişiyor. Kayıt inceleme gerektiriyor." : null;
}

export async function recoverSaleMainOperation(scope: ErpScope, saleId: string) {
  const response = await postAuthority("/api/sales/authority/approve", {
    ...scope, saleId, recoverMainOperation: true,
  });
  return applyMainOperation(scope, response.mainOperation);
}

export async function persistSaleReturnServerAuthority(input: {
  action: "START" | "APPROVE" | "REJECT" | "COMPLETE";
  saleReturn: SaleReturnDocument;
  scope: ErpScope;
  occurredAt?: string;
  reason?: string;
}): Promise<void> {
  await postAuthority(
    "/api/sales/returns/authority",
    {
      ...input.scope,
      action: input.action,
      saleReturnId: input.saleReturn.id,
      saleId: input.saleReturn.saleId,
      customerId: input.saleReturn.customerId,
      idempotencyKey: input.saleReturn.idempotencyKey,
      amount: input.saleReturn.amount,
      currency: input.saleReturn.currency,
      occurredAt:
        input.occurredAt ||
        input.saleReturn.updatedAt ||
        input.saleReturn.occurredAt,
      reason:
        input.reason ??
        input.saleReturn.reason ??
        undefined,
    },
  );
}