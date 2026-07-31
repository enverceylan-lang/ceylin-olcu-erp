import type {
  FinanceTransaction
} from "@/lib/finance/financeContracts";

import {
  persistSystemWorkflowFinanceTransaction,
  type FinanceSystemWorkflowContext,
  type FinanceSystemWorkflowPersistenceResult
} from "@/lib/finance/financeSystemWorkflowPersistence";

import {
  FinanceSupabaseGatewayAdapter,
  type FinanceSupabaseRpcClient
} from "@/lib/finance/financeSupabaseGatewayAdapter";

import {
  FinanceSupabaseWorkflowSourceRepository,
  type FinanceWorkflowSourceSupabaseClient
} from "@/lib/finance/financeSupabaseWorkflowSourceRepository";

export type FinanceSupabaseSystemWorkflowClient =
  FinanceSupabaseRpcClient &
  FinanceWorkflowSourceSupabaseClient;

export async function persistSupabaseSystemWorkflowFinance(
  transaction: FinanceTransaction,
  context: FinanceSystemWorkflowContext,
  client: FinanceSupabaseSystemWorkflowClient
): Promise<FinanceSystemWorkflowPersistenceResult> {
  const gateway =
    new FinanceSupabaseGatewayAdapter(
      client
    );

  const sourceRepository =
    new FinanceSupabaseWorkflowSourceRepository(
      client
    );

  return persistSystemWorkflowFinanceTransaction(
    transaction,
    context,
    {
      gateway,
      sourceRepository
    }
  );
}