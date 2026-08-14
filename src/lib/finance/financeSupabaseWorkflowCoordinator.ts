import type {
  FinanceTransaction
} from "@/lib/finance/financeContracts";
import type {
  FinanceWorkflowSourceWriteClient
} from "@/lib/finance/financeSupabaseWorkflowSourceWriter";
import type {
  FinanceWorkflowSourceSupabaseClient
} from "@/lib/finance/financeSupabaseWorkflowSourceRepository";
import type {
  FinanceSystemWorkflowSourceRepository
} from "@/lib/finance/financeSystemWorkflowSourceVerifier";
import {
  persistSystemWorkflowFinanceTransaction,
  type FinanceSystemWorkflowContext,
  type FinanceSystemWorkflowPersistenceResult
} from "@/lib/finance/financeSystemWorkflowPersistence";
import {
  buildFinanceSaleReturnWorkflowSourceRow,
  buildFinanceSaleWorkflowSourceRow,
  type ApprovedSaleReturnWorkflowSourceInput,
  type ApprovedSaleWorkflowSourceInput
} from "@/lib/finance/financeWorkflowSourcePayload";
import {
  FinanceSupabaseWorkflowAtomicGateway,
  type FinanceWorkflowAtomicRpcClient
} from "@/lib/finance/financeSupabaseWorkflowAtomicGateway";

export type FinanceSupabaseWorkflowCoordinatorClient =
  FinanceWorkflowAtomicRpcClient &
  FinanceWorkflowSourceWriteClient &
  FinanceWorkflowSourceSupabaseClient;

export type FinanceSupabaseWorkflowCoordinatorInput =
  | {
      workflow: "SALE_APPROVAL";
      source: ApprovedSaleWorkflowSourceInput;
      transaction: FinanceTransaction;
      context: FinanceSystemWorkflowContext;
    }
  | {
      workflow: "SALE_RETURN_APPROVAL";
      source: ApprovedSaleReturnWorkflowSourceInput;
      transaction: FinanceTransaction;
      context: FinanceSystemWorkflowContext;
    };

export type FinanceSupabaseWorkflowCoordinatorResult =
  FinanceSystemWorkflowPersistenceResult;

function sourceRepositoryFromInput(
  input: FinanceSupabaseWorkflowCoordinatorInput
): FinanceSystemWorkflowSourceRepository {
  return {
    async loadApprovedSale(_scope, saleId) {
      if (
        input.workflow !== "SALE_APPROVAL" ||
        input.source.saleId !== saleId
      ) {
        return null;
      }

      return {
        tenantId: input.source.tenantId,
        companyId: input.source.companyId,
        branchId: input.source.branchId,
        accountingPeriodId: input.source.accountingPeriodId,
        id: input.source.saleId,
        customerId: input.source.customerId,
        status: "ONAYLANDI",
        totalAmount: input.source.totalAmount,
        approvedByUserId: input.source.approvedByUserId
      };
    },

    async loadApprovedSaleReturn(_scope, saleReturnId) {
      if (
        input.workflow !== "SALE_RETURN_APPROVAL" ||
        input.source.saleReturnId !== saleReturnId
      ) {
        return null;
      }

      return {
        tenantId: input.source.tenantId,
        companyId: input.source.companyId,
        branchId: input.source.branchId,
        accountingPeriodId: input.source.accountingPeriodId,
        id: input.source.saleReturnId,
        saleId: input.source.saleId,
        customerId: input.source.customerId,
        status: "ONAYLANDI",
        amount: input.source.amount,
        actorUserId: input.source.actorUserId
      };
    }
  };
}

export async function persistSupabaseWorkflowSourceAndFinance(
  input: FinanceSupabaseWorkflowCoordinatorInput,
  client: FinanceSupabaseWorkflowCoordinatorClient
): Promise<FinanceSupabaseWorkflowCoordinatorResult> {
  if (input.context.workflow !== input.workflow) {
    return {
      outcome: "REJECT",
      reason: "WORKFLOW_AUTHORIZATION_MISMATCH"
    };
  }

  const sourceRow =
    input.workflow === "SALE_APPROVAL"
      ? buildFinanceSaleWorkflowSourceRow(input.source)
      : buildFinanceSaleReturnWorkflowSourceRow(input.source);

  const gateway =
    new FinanceSupabaseWorkflowAtomicGateway(
      client,
      input.workflow,
      sourceRow
    );

  return persistSystemWorkflowFinanceTransaction(
    input.transaction,
    input.context,
    {
      gateway,
      sourceRepository: sourceRepositoryFromInput(input)
    }
  );
}