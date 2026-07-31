import type {
  ApprovedSaleReturnWorkflowSourceInput,
  ApprovedSaleWorkflowSourceInput,
  FinanceSaleReturnWorkflowSourceRow,
  FinanceSaleWorkflowSourceRow
} from "@/lib/finance/financeWorkflowSourcePayload";

import {
  buildFinanceSaleReturnWorkflowSourceRow,
  buildFinanceSaleWorkflowSourceRow
} from "@/lib/finance/financeWorkflowSourcePayload";

interface SupabaseWriteResult {
  data:
    Record<string, unknown> | null;
  error:
    { message?: string } | null;
}

interface SupabaseWriteBuilder {
  select(
    columns:
      string
  ): SupabaseWriteBuilder;

  single():
    Promise<SupabaseWriteResult>;
}

type FinanceWorkflowSourceWriteRow =
  | FinanceSaleWorkflowSourceRow
  | FinanceSaleReturnWorkflowSourceRow;

interface SupabaseWorkflowSourceTable {
  upsert(
    values:
      FinanceWorkflowSourceWriteRow,
    options: {
      onConflict:
        string;
      ignoreDuplicates:
        boolean;
    }
  ): SupabaseWriteBuilder;
}

export interface FinanceWorkflowSourceWriteClient {
  from(
    table:
      string
  ): SupabaseWorkflowSourceTable;
}

export type FinanceWorkflowSourceWriteOutcome =
  | {
      outcome:
        "UPSERTED";
    }
  | {
      outcome:
        "FAILED";
      reason:
        | "SALE_SOURCE_WRITE_FAILED"
        | "SALE_RETURN_SOURCE_WRITE_FAILED";
    };

function assertReturnedIdentity(
  data:
    Record<string, unknown> | null,
  expectedField:
    "sale_id" | "sale_return_id",
  expectedValue:
    string
): void {
  if (
    !data ||
    data[expectedField] !==
      expectedValue
  ) {
    throw new Error(
      "FINANCE_WORKFLOW_SOURCE_WRITE_RESULT_INVALID"
    );
  }
}

export class FinanceSupabaseWorkflowSourceWriter {
  constructor(
    private readonly client:
      FinanceWorkflowSourceWriteClient
  ) {}

  async writeApprovedSale(
    input:
      ApprovedSaleWorkflowSourceInput
  ): Promise<FinanceWorkflowSourceWriteOutcome> {
    const row:
      FinanceSaleWorkflowSourceRow =
        buildFinanceSaleWorkflowSourceRow(
          input
        );

    const result =
      await this.client
        .from(
          "finance_sale_workflow_sources"
        )
        .upsert(
          row,
          {
            onConflict:
              [
                "tenant_id",
                "company_id",
                "branch_id",
                "accounting_period_id",
                "sale_id"
              ].join(","),
            ignoreDuplicates:
              false
          }
        )
        .select(
          "sale_id"
        )
        .single();

    if (result.error) {
      return {
        outcome:
          "FAILED",
        reason:
          "SALE_SOURCE_WRITE_FAILED"
      };
    }

    assertReturnedIdentity(
      result.data,
      "sale_id",
      row.sale_id
    );

    return {
      outcome:
        "UPSERTED"
    };
  }

  async writeApprovedSaleReturn(
    input:
      ApprovedSaleReturnWorkflowSourceInput
  ): Promise<FinanceWorkflowSourceWriteOutcome> {
    const row:
      FinanceSaleReturnWorkflowSourceRow =
        buildFinanceSaleReturnWorkflowSourceRow(
          input
        );

    const result =
      await this.client
        .from(
          "finance_sale_return_workflow_sources"
        )
        .upsert(
          row,
          {
            onConflict:
              [
                "tenant_id",
                "company_id",
                "branch_id",
                "accounting_period_id",
                "sale_return_id"
              ].join(","),
            ignoreDuplicates:
              false
          }
        )
        .select(
          "sale_return_id"
        )
        .single();

    if (result.error) {
      return {
        outcome:
          "FAILED",
        reason:
          "SALE_RETURN_SOURCE_WRITE_FAILED"
      };
    }

    assertReturnedIdentity(
      result.data,
      "sale_return_id",
      row.sale_return_id
    );

    return {
      outcome:
        "UPSERTED"
    };
  }
}