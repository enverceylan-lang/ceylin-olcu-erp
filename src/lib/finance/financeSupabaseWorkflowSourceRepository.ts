import type { ErpScope } from "@/lib/erpScope";

import type {
  ApprovedSaleReturnSource,
  ApprovedSaleSource,
  FinanceSystemWorkflowSourceRepository
} from "@/lib/finance/financeSystemWorkflowSourceVerifier";

interface MaybeSingleResult {
  data: Record<string, unknown> | null;
  error: { message?: string } | null;
}

interface FilterBuilder {
  match(values: Record<string, string>): FilterBuilder;
  eq(column: string, value: string): FilterBuilder;
  maybeSingle(): Promise<MaybeSingleResult>;
}

interface TableClient {
  select(columns: string): FilterBuilder;
}

export interface FinanceWorkflowSourceSupabaseClient {
  from(table: string): TableClient;
}

function scopeColumns(scope: ErpScope): Record<string, string> {
  return {
    tenant_id: scope.tenantId,
    company_id: scope.companyId,
    branch_id: scope.branchId,
    accounting_period_id: scope.accountingPeriodId
  };
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`FINANCE_WORKFLOW_SOURCE_${field}_INVALID`);
  }

  return value;
}

function requiredPositiveNumber(value: unknown, field: string): number {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    throw new Error(`FINANCE_WORKFLOW_SOURCE_${field}_INVALID`);
  }

  return numberValue;
}

function mapSale(row: Record<string, unknown>): ApprovedSaleSource {
  return {
    tenantId: requiredString(row.tenant_id, "TENANT_ID"),
    companyId: requiredString(row.company_id, "COMPANY_ID"),
    branchId: requiredString(row.branch_id, "BRANCH_ID"),
    accountingPeriodId: requiredString(
      row.accounting_period_id,
      "ACCOUNTING_PERIOD_ID"
    ),
    id: requiredString(row.sale_id, "SALE_ID"),
    customerId: requiredString(row.customer_id, "CUSTOMER_ID"),
    status: requiredString(row.status, "STATUS"),
    totalAmount: requiredPositiveNumber(row.total_amount, "TOTAL_AMOUNT"),
    approvedByUserId: requiredString(
      row.approved_by_user_id,
      "APPROVED_BY_USER_ID"
    )
  };
}

function mapSaleReturn(
  row: Record<string, unknown>
): ApprovedSaleReturnSource {
  return {
    tenantId: requiredString(row.tenant_id, "TENANT_ID"),
    companyId: requiredString(row.company_id, "COMPANY_ID"),
    branchId: requiredString(row.branch_id, "BRANCH_ID"),
    accountingPeriodId: requiredString(
      row.accounting_period_id,
      "ACCOUNTING_PERIOD_ID"
    ),
    id: requiredString(row.sale_return_id, "SALE_RETURN_ID"),
    saleId: requiredString(row.sale_id, "SALE_ID"),
    customerId: requiredString(row.customer_id, "CUSTOMER_ID"),
    status: requiredString(row.status, "STATUS"),
    amount: requiredPositiveNumber(row.amount, "AMOUNT"),
    actorUserId: requiredString(row.actor_user_id, "ACTOR_USER_ID")
  };
}

export class FinanceSupabaseWorkflowSourceRepository
  implements FinanceSystemWorkflowSourceRepository {
  constructor(
    private readonly client: FinanceWorkflowSourceSupabaseClient
  ) {}

  async loadApprovedSale(
    scope: ErpScope,
    saleId: string
  ): Promise<ApprovedSaleSource | null> {
    const result = await this.client
      .from("finance_sale_workflow_sources")
      .select(
        [
          "tenant_id",
          "company_id",
          "branch_id",
          "accounting_period_id",
          "sale_id",
          "customer_id",
          "status",
          "total_amount",
          "approved_by_user_id"
        ].join(",")
      )
      .match(scopeColumns(scope))
      .eq("sale_id", saleId)
      .maybeSingle();

    if (result.error) {
      throw new Error("FINANCE_WORKFLOW_SOURCE_SALE_READ_FAILED");
    }

    return result.data ? mapSale(result.data) : null;
  }

  async loadApprovedSaleReturn(
    scope: ErpScope,
    saleReturnId: string
  ): Promise<ApprovedSaleReturnSource | null> {
    const result = await this.client
      .from("finance_sale_return_workflow_sources")
      .select(
        [
          "tenant_id",
          "company_id",
          "branch_id",
          "accounting_period_id",
          "sale_return_id",
          "sale_id",
          "customer_id",
          "status",
          "amount",
          "actor_user_id"
        ].join(",")
      )
      .match(scopeColumns(scope))
      .eq("sale_return_id", saleReturnId)
      .maybeSingle();

    if (result.error) {
      throw new Error("FINANCE_WORKFLOW_SOURCE_RETURN_READ_FAILED");
    }

    return result.data ? mapSaleReturn(result.data) : null;
  }
}