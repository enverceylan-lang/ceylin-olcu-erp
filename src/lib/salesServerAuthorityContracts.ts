import type { ErpScope } from "@/lib/erpScope";
import { validateErpScope } from "@/lib/erpScope";

export interface SaleAuthorityDraftInput extends ErpScope {
  saleId: string;
  customerId: string;
  saleNumber?: string | null;
  status: "TASLAK" | "TEKLİF";
  totalAmount: number;
  currency: string;
}

export interface SaleApprovalAuthorityInput extends ErpScope {
  saleId: string;
}

export type SaleReturnAuthorityAction =
  | "START"
  | "APPROVE"
  | "REJECT"
  | "COMPLETE";

export interface SaleReturnAuthorityInput extends ErpScope {
  action: SaleReturnAuthorityAction;
  saleReturnId: string;
  saleId: string;
  customerId: string;
  idempotencyKey: string;
  amount?: number;
  currency?: string;
  occurredAt: string;
  reason?: string;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function assertSaleAuthorityScope(
  input: ErpScope,
  serverScope: ErpScope,
): void {
  if (!validateErpScope(input).valid) {
    throw new Error("SALE_AUTHORITY_SCOPE_REQUIRED");
  }
  if (
    input.tenantId !== serverScope.tenantId ||
    input.companyId !== serverScope.companyId ||
    input.branchId !== serverScope.branchId ||
    input.accountingPeriodId !== serverScope.accountingPeriodId
  ) {
    throw new Error("SALE_AUTHORITY_SCOPE_MISMATCH");
  }
}

export function assertSaleDraftAuthorityInput(
  input: SaleAuthorityDraftInput,
): void {
  if (
    !text(input.saleId) ||
    !text(input.customerId)
  ) {
    throw new Error("SALE_AUTHORITY_REQUIRED_FIELD_MISSING");
  }
  if (!/^[A-Z]{3}$/.test(text(input.currency).toUpperCase())) {
    throw new Error("SALE_AUTHORITY_CURRENCY_INVALID");
  }
  if (!Number.isFinite(input.totalAmount) || input.totalAmount < 0) {
    throw new Error("SALE_AUTHORITY_AMOUNT_INVALID");
  }
  if (input.status !== "TASLAK" && input.status !== "TEKLİF") {
    throw new Error("SALE_AUTHORITY_DRAFT_STATUS_REQUIRED");
  }
}

export function canServerApproveSale(user: {
  role: string;
  isActive: boolean;
  permissions?: string[] | null;
}): boolean {
  if (!user.isActive) return false;
  const role = text(user.role).toUpperCase();
  if (role === "ADMIN") return true;
  return Array.isArray(user.permissions) &&
    user.permissions.includes("SALE_APPROVE");
}

export function assertSaleReturnAuthorityInput(
  input: SaleReturnAuthorityInput,
): void {
  if (
    !text(input.saleReturnId) ||
    !text(input.saleId) ||
    !text(input.customerId) ||
    !text(input.idempotencyKey) ||
    !text(input.occurredAt)
  ) {
    throw new Error("SALE_RETURN_AUTHORITY_REQUIRED_FIELD_MISSING");
  }
  if (input.action === "START") {
    if (!Number.isFinite(input.amount) || Number(input.amount) <= 0) {
      throw new Error("SALE_RETURN_AUTHORITY_AMOUNT_INVALID");
    }
    if (!/^[A-Z]{3}$/.test(text(input.currency).toUpperCase())) {
      throw new Error("SALE_RETURN_AUTHORITY_CURRENCY_INVALID");
    }
  }
}