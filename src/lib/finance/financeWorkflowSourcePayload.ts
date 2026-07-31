import {
  validateErpScope,
  type ErpScope
} from "@/lib/erpScope";

export interface ApprovedSaleWorkflowSourceInput
  extends ErpScope {
  saleId: string;
  customerId: string;
  totalAmount: number;
  currency: string;
  approvedByUserId: string;
  approvedAt: string;
  sourceVersion: number;
  payloadHash: string;
}

export interface ApprovedSaleReturnWorkflowSourceInput
  extends ErpScope {
  saleReturnId: string;
  saleId: string;
  customerId: string;
  amount: number;
  currency: string;
  actorUserId: string;
  approvedAt: string;
  sourceVersion: number;
  payloadHash: string;
}

export interface FinanceSaleWorkflowSourceRow {
  tenant_id: string;
  company_id: string;
  branch_id: string;
  accounting_period_id: string;
  sale_id: string;
  customer_id: string;
  status: "ONAYLANDI";
  total_amount: number;
  currency: string;
  approved_by_user_id: string;
  approved_at: string;
  source_version: number;
  payload_hash: string;
}

export interface FinanceSaleReturnWorkflowSourceRow {
  tenant_id: string;
  company_id: string;
  branch_id: string;
  accounting_period_id: string;
  sale_return_id: string;
  sale_id: string;
  customer_id: string;
  status: "ONAYLANDI";
  amount: number;
  currency: string;
  actor_user_id: string;
  approved_at: string;
  source_version: number;
  payload_hash: string;
}

function requiredText(
  value: string,
  field: string
): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(
      `FINANCE_WORKFLOW_SOURCE_${field}_REQUIRED`
    );
  }

  return normalized;
}

function positiveAmount(
  value: number,
  field: string
): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(
      `FINANCE_WORKFLOW_SOURCE_${field}_INVALID`
    );
  }

  return value;
}

function positiveVersion(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(
      "FINANCE_WORKFLOW_SOURCE_VERSION_INVALID"
    );
  }

  return value;
}

function normalizedCurrency(value: string): string {
  const currency = value.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error(
      "FINANCE_WORKFLOW_SOURCE_CURRENCY_INVALID"
    );
  }

  return currency;
}

function normalizedTimestamp(
  value: string,
  field: string
): string {
  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    throw new Error(
      `FINANCE_WORKFLOW_SOURCE_${field}_INVALID`
    );
  }

  return new Date(timestamp).toISOString();
}

function assertScope(scope: ErpScope): void {
  const validation = validateErpScope(scope);

  if (!validation.valid) {
    throw new Error(
      `FINANCE_WORKFLOW_SOURCE_SCOPE_REQUIRED:${validation.missingFields.join(",")}`
    );
  }
}

export function buildFinanceSaleWorkflowSourceRow(
  input: ApprovedSaleWorkflowSourceInput
): FinanceSaleWorkflowSourceRow {
  assertScope(input);

  return {
    tenant_id: input.tenantId,
    company_id: input.companyId,
    branch_id: input.branchId,
    accounting_period_id: input.accountingPeriodId,
    sale_id: requiredText(input.saleId, "SALE_ID"),
    customer_id: requiredText(input.customerId, "CUSTOMER_ID"),
    status: "ONAYLANDI",
    total_amount: positiveAmount(
      input.totalAmount,
      "TOTAL_AMOUNT"
    ),
    currency: normalizedCurrency(input.currency),
    approved_by_user_id: requiredText(
      input.approvedByUserId,
      "APPROVED_BY_USER_ID"
    ),
    approved_at: normalizedTimestamp(
      input.approvedAt,
      "APPROVED_AT"
    ),
    source_version: positiveVersion(input.sourceVersion),
    payload_hash: requiredText(
      input.payloadHash,
      "PAYLOAD_HASH"
    )
  };
}

export function buildFinanceSaleReturnWorkflowSourceRow(
  input: ApprovedSaleReturnWorkflowSourceInput
): FinanceSaleReturnWorkflowSourceRow {
  assertScope(input);

  return {
    tenant_id: input.tenantId,
    company_id: input.companyId,
    branch_id: input.branchId,
    accounting_period_id: input.accountingPeriodId,
    sale_return_id: requiredText(
      input.saleReturnId,
      "SALE_RETURN_ID"
    ),
    sale_id: requiredText(input.saleId, "SALE_ID"),
    customer_id: requiredText(input.customerId, "CUSTOMER_ID"),
    status: "ONAYLANDI",
    amount: positiveAmount(input.amount, "AMOUNT"),
    currency: normalizedCurrency(input.currency),
    actor_user_id: requiredText(
      input.actorUserId,
      "ACTOR_USER_ID"
    ),
    approved_at: normalizedTimestamp(
      input.approvedAt,
      "APPROVED_AT"
    ),
    source_version: positiveVersion(input.sourceVersion),
    payload_hash: requiredText(
      input.payloadHash,
      "PAYLOAD_HASH"
    )
  };
}