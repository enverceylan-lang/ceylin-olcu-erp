import type {
  FinanceTransaction
} from "@/lib/finance/financeContracts";

import type {
  ApprovedSaleReturnWorkflowSourceInput,
  ApprovedSaleWorkflowSourceInput
} from "@/lib/finance/financeWorkflowSourcePayload";

import {
  FinanceSupabaseWorkflowSourceWriter,
  type FinanceWorkflowSourceWriteClient
} from "@/lib/finance/financeSupabaseWorkflowSourceWriter";

import {
  persistSupabaseSystemWorkflowFinance,
  type FinanceSupabaseSystemWorkflowClient
} from "@/lib/finance/financeSupabaseSystemWorkflowOrchestrator";

import type {
  FinanceSystemWorkflowContext,
  FinanceSystemWorkflowPersistenceResult
} from "@/lib/finance/financeSystemWorkflowPersistence";

export type FinanceSupabaseWorkflowCoordinatorClient =
  FinanceWorkflowSourceWriteClient &
  FinanceSupabaseSystemWorkflowClient;

export type FinanceSupabaseWorkflowCoordinatorInput =
  | {
      workflow:
        "SALE_APPROVAL";
      source:
        ApprovedSaleWorkflowSourceInput;
      transaction:
        FinanceTransaction;
      context:
        FinanceSystemWorkflowContext;
    }
  | {
      workflow:
        "SALE_RETURN_APPROVAL";
      source:
        ApprovedSaleReturnWorkflowSourceInput;
      transaction:
        FinanceTransaction;
      context:
        FinanceSystemWorkflowContext;
    };

export type FinanceSupabaseWorkflowCoordinatorResult =
  | FinanceSystemWorkflowPersistenceResult
  | {
      outcome:
        "SOURCE_WRITE_FAILED";
      reason:
        | "SALE_SOURCE_WRITE_FAILED"
        | "SALE_RETURN_SOURCE_WRITE_FAILED";
    };

export async function persistSupabaseWorkflowSourceAndFinance(
  input:
    FinanceSupabaseWorkflowCoordinatorInput,
  client:
    FinanceSupabaseWorkflowCoordinatorClient
): Promise<FinanceSupabaseWorkflowCoordinatorResult> {
  if (
    input.context.workflow !==
      input.workflow
  ) {
    return {
      outcome:
        "REJECT",
      reason:
        "WORKFLOW_AUTHORIZATION_MISMATCH"
    };
  }

  const writer =
    new FinanceSupabaseWorkflowSourceWriter(
      client
    );

  const sourceWrite =
    input.workflow ===
      "SALE_APPROVAL"
      ? await writer.writeApprovedSale(
          input.source
        )
      : await writer.writeApprovedSaleReturn(
          input.source
        );

  if (
    sourceWrite.outcome ===
      "FAILED"
  ) {
    return {
      outcome:
        "SOURCE_WRITE_FAILED",
      reason:
        sourceWrite.reason
    };
  }

  return persistSupabaseSystemWorkflowFinance(
    input.transaction,
    input.context,
    client
  );
}