import type {
  FinanceTransaction
} from "@/lib/finance/financeContracts";

import {
  buildFinanceSupabasePersistencePayload,
  type FinanceSupabasePersistencePayload
} from "@/lib/finance/financeSupabasePayload";

export type FinancePersistenceOutcome =
  | {
      outcome: "CREATED";
      transactionId: string;
    }
  | {
      outcome: "REPLAY";
      transactionId: string;
    }
  | {
      outcome: "CONFLICT";
      transactionId: string;
      reason:
        | "IDEMPOTENCY_PAYLOAD_CONFLICT"
        | "TRANSACTION_ID_CONFLICT"
        | "SOURCE_DOCUMENT_CONFLICT";
    };

export interface FinancePersistenceGateway {
  persist(
    payload:
      FinanceSupabasePersistencePayload
  ): Promise<FinancePersistenceOutcome>;
}

export interface PersistFinanceTransactionDependencies {
  gateway:
    FinancePersistenceGateway;
}

function assertMatchingTransactionId(
  result:
    FinancePersistenceOutcome,
  expectedTransactionId:
    string
): void {
  if (
    result.transactionId !==
    expectedTransactionId
  ) {
    throw new Error(
      "FINANCE_PERSISTENCE_TRANSACTION_ID_MISMATCH"
    );
  }
}

export async function persistFinanceTransaction(
  transaction:
    FinanceTransaction,
  dependencies:
    PersistFinanceTransactionDependencies
): Promise<FinancePersistenceOutcome> {
  const payload =
    buildFinanceSupabasePersistencePayload(
      transaction
    );

  const result =
    await dependencies.gateway.persist(
      payload
    );

  assertMatchingTransactionId(
    result,
    transaction.transactionId
  );

  return result;
}