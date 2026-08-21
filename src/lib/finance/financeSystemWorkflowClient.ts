import type { FinanceTransaction } from "@/lib/finance/financeContracts";
import type { SalesFinanceOutboxRecord } from "@/lib/localSalesDb";
import { getSaleNetTotal, getSalePaidTotal } from "@/lib/salesFinance";
import { useAuthStore } from "@/store/useAuthStore";

export type FinanceSystemWorkflowClientResult =
  | { outcome: "CREATED" | "REPLAY"; transaction: FinanceTransaction }
  | { outcome: "REJECT"; reason: string };

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
