import type { FinanceTransaction } from "@/lib/finance/financeContracts";
import type { SalesFinanceOutboxRecord } from "@/lib/localSalesDb";
import type { SaleReturnFinanceOutboxRecord } from "@/lib/localSaleReturnsDb";
import { getSaleNetTotal, getSalePaidTotal } from "@/lib/salesFinance";
import { useAuthStore } from "@/store/useAuthStore";
import type { ErpScope } from "@/lib/erpScope";

export type FinanceSystemWorkflowClientResult =
  | { outcome: "CREATED" | "REPLAY"; transaction: FinanceTransaction }
  | { outcome: "REJECT"; reason: string };

export type FinanceSystemWorkflowReconcileResult =
  | { outcome: "CONFIRMED"; transactionId: string; reason: string; occurredAt: string; serverPayloadHash: string }
  | { outcome: "CONFLICT"; transactionId: string; reason: string; occurredAt: string | null; serverPayloadHash: string }
  | { outcome: "NOT_FOUND"; reason: string }
  | { outcome: "AMBIGUOUS"; transactionId: string; reason: string; occurredAt: string | null; serverPayloadHash: string };

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
    .join(",")}}`;
}

async function sha256(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonical(value));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export { sha256 };

function responseReason(body: unknown): string {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const reason = (body as { reason?: unknown }).reason;
    if (typeof reason === "string" && reason.trim()) return reason;
  }
  return "FINANCE_SYSTEM_WORKFLOW_REQUEST_FAILED";
}

export async function persistApprovedSaleFinanceSource(
  transaction: FinanceTransaction,
  record: SalesFinanceOutboxRecord
): Promise<FinanceSystemWorkflowClientResult> {
  if (transaction.transactionType !== "SALE_CHARGE") {
    return { outcome: "REJECT", reason: "SALE_APPROVAL_ONLY_ACCEPTS_CHARGE" };
  }
  if (!record.approvedByUserId || !record.approvedAt) {
    return { outcome: "REJECT", reason: "SALE_APPROVAL_AUDIT_REQUIRED" };
  }
  if (getSalePaidTotal(record.saleSnapshot) > 0) {
    return {
      outcome: "REJECT",
      reason: "SALE_APPROVAL_EMBEDDED_PAYMENT_REQUIRES_SERVER_COLLECTION"
    };
  }

  const sessionToken = useAuthStore.getState().sessionToken;
  if (!sessionToken) return { outcome: "REJECT", reason: "MISSING_SESSION" };

  const approvedTransaction: FinanceTransaction = {
    ...transaction,
    createdBy: record.approvedByUserId,
    createdAt: record.approvedAt,
    postedAt: record.approvedAt
  };
  const sourceBase = {
    tenantId: record.tenantId,
    companyId: record.companyId,
    branchId: record.branchId,
    accountingPeriodId: record.accountingPeriodId,
    saleId: record.saleId,
    saleNumber: record.saleSnapshot.saleNo,
    customerId: record.saleSnapshot.customerId,
    totalAmount: getSaleNetTotal(record.saleSnapshot),
    openingReceivableAmount: getSaleNetTotal(record.saleSnapshot),
    currency: record.currency,
    approvedByUserId: record.approvedByUserId,
    approvedAt: record.approvedAt,
    sourceVersion: 1,
    generalDueDate: record.saleSnapshot.generalDueDate || null,
    installments: (record.saleSnapshot.installmentPlan?.installments || []).map(item => ({
      installmentId: item.id,
      sequence: item.sequence,
      dueDate: item.dueDate,
      amount: item.amount
    }))
  };
  const source = { ...sourceBase, payloadHash: await sha256(sourceBase) };

  const response = await fetch("/api/finance/system-workflow", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      "Content-Type": "application/json"
    },
    cache: "no-store",
    body: JSON.stringify({ workflow: "SALE_APPROVAL", source, transaction: approvedTransaction })
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || !body || typeof body !== "object" || Array.isArray(body)) {
    return { outcome: "REJECT", reason: responseReason(body) };
  }
  const outcome = (body as { outcome?: unknown }).outcome;
  if (outcome !== "CREATED" && outcome !== "REPLAY") {
    return { outcome: "REJECT", reason: responseReason(body) };
  }
  return { outcome, transaction: approvedTransaction };
}

export async function persistApprovedSaleReturnFinanceSource(
  transaction: FinanceTransaction,
  record: SaleReturnFinanceOutboxRecord
): Promise<FinanceSystemWorkflowClientResult> {
  if (transaction.transactionType !== "REFUND") {
    return { outcome: "REJECT", reason: "SALE_RETURN_APPROVAL_ONLY_ACCEPTS_REFUND" };
  }
  if (!record.saleReturnSnapshot.actorUserId || !record.saleReturnSnapshot.updatedAt) {
    return { outcome: "REJECT", reason: "SALE_RETURN_APPROVAL_AUDIT_REQUIRED" };
  }

  const sessionToken = useAuthStore.getState().sessionToken;
  if (!sessionToken) return { outcome: "REJECT", reason: "MISSING_SESSION" };

  const approvedTransaction: FinanceTransaction = {
    ...transaction,
    createdBy: record.saleReturnSnapshot.actorUserId,
    createdAt: record.saleReturnSnapshot.updatedAt,
    postedAt: record.saleReturnSnapshot.updatedAt
  };

  const sourceBase = {
    tenantId: record.tenantId,
    companyId: record.companyId,
    branchId: record.branchId,
    accountingPeriodId: record.accountingPeriodId,
    saleReturnId: record.saleReturnId,
    saleId: record.saleId,
    customerId: record.customerId,
    amount: record.saleReturnSnapshot.amount,
    currency: record.saleReturnSnapshot.currency,
    actorUserId: record.saleReturnSnapshot.actorUserId,
    approvedAt: record.saleReturnSnapshot.updatedAt,
    sourceVersion: 1
  };
  const source = { ...sourceBase, payloadHash: await sha256(sourceBase) };

  const response = await fetch("/api/finance/system-workflow", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      "Content-Type": "application/json"
    },
    cache: "no-store",
    body: JSON.stringify({ workflow: "SALE_RETURN_APPROVAL", source, transaction: approvedTransaction })
  });
  
  // Network error / timeout / no response -> AMBIGUOUS
  if (!response) {
    throw new Error("AMBIGUOUS:NO_RESPONSE");
  }
  
  // HTTP 5xx -> AMBIGUOUS (server may have processed)
  if (response.status >= 500) {
    throw new Error(`AMBIGUOUS:SERVER_ERROR_${response.status}`);
  }
  
  let responseBody: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    // HTTP 409 -> CONFLICT (different payload)
    if (response.status === 409) {
      return { outcome: "REJECT", reason: "CONFLICT:IDEMPOTENCY_PAYLOAD_CONFLICT" };
    }
    // Other 4xx -> REJECT (client error)
    return { outcome: "REJECT", reason: responseReason(responseBody) };
  }
  
  responseBody = await response.json().catch(() => null);
  if (!responseBody || typeof responseBody !== "object" || Array.isArray(responseBody)) {
    return { outcome: "REJECT", reason: responseReason(responseBody) };
  }
  const outcome = (responseBody as { outcome?: unknown }).outcome;
  if (outcome !== "CREATED" && outcome !== "REPLAY") {
    return { outcome: "REJECT", reason: responseReason(responseBody) };
  }
  return { outcome, transaction: approvedTransaction };
}

export async function reconcileFinanceSystemWorkflow(
  workflow: "SALE_APPROVAL" | "SALE_RETURN_APPROVAL",
  scope: ErpScope,
  sourceId: string,
  idempotencyKey: string,
  transactionId: string,
  auditPayloadHash: string
): Promise<FinanceSystemWorkflowReconcileResult> {
  const sessionToken = useAuthStore.getState().sessionToken;
  if (!sessionToken) return { outcome: "NOT_FOUND", reason: "MISSING_SESSION" };

  const response = await fetch("/api/finance/system-workflow/reconcile", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      "Content-Type": "application/json"
    },
    cache: "no-store",
    body: JSON.stringify({
      workflow,
      scope,
      sourceId,
      idempotencyKey,
      transactionId,
      auditPayloadHash
    })
  });

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || !body || typeof body !== "object" || Array.isArray(body)) {
    return { outcome: "NOT_FOUND", reason: responseReason(body) };
  }

  const data = body as {
    outcome?: string;
    transactionId?: string;
    reason?: string;
    occurredAt?: string;
    serverPayloadHash?: string;
  };

  const outcome = data.outcome;
  if (!outcome) {
    return { outcome: "NOT_FOUND", reason: "NO_OUTCOME_IN_RESPONSE" };
  }

  if (outcome === "CONFIRMED") {
    return {
      outcome: "CONFIRMED",
      transactionId: data.transactionId ?? "",
      reason: data.reason ?? "RECONCILED",
      occurredAt: data.occurredAt ?? "",
      serverPayloadHash: data.serverPayloadHash ?? ""
    };
  }

  if (outcome === "CONFLICT") {
    return {
      outcome: "CONFLICT",
      transactionId: data.transactionId ?? "",
      reason: data.reason ?? "CONFLICT",
      occurredAt: data.occurredAt ?? null,
      serverPayloadHash: data.serverPayloadHash ?? ""
    };
  }

  if (outcome === "NOT_FOUND") {
    return { outcome: "NOT_FOUND", reason: data.reason ?? "NO_SERVER_RECORD" };
  }

  if (outcome === "AMBIGUOUS") {
    return {
      outcome: "AMBIGUOUS",
      transactionId: data.transactionId ?? "",
      reason: data.reason ?? "AMBIGUOUS",
      occurredAt: data.occurredAt ?? null,
      serverPayloadHash: data.serverPayloadHash ?? ""
    };
  }

  return { outcome: "NOT_FOUND", reason: `UNKNOWN_OUTCOME:${outcome}` };
}
