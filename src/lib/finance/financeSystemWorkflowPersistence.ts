import {
  erpScopeMatches,
  validateErpScope,
  type ErpScope
} from "@/lib/erpScope";

import type {
  FinanceTransaction
} from "@/lib/finance/financeContracts";

import {
  decideFinancePersistenceAuthorization
} from "@/lib/finance/financePersistenceAuthorizationPolicy";

import {
  persistFinanceTransaction,
  type FinancePersistenceGateway,
  type FinancePersistenceOutcome
} from "@/lib/finance/financePersistenceGateway";

import {
  verifyFinanceSystemWorkflowSource,
  type FinanceSystemWorkflowSourceRepository
} from "@/lib/finance/financeSystemWorkflowSourceVerifier";

export interface FinanceSystemWorkflowContext {
  workflow:
    "SALE_APPROVAL" | "SALE_RETURN_APPROVAL";
  actorUserId:
    string;
  scope:
    ErpScope;
}

export interface FinanceSystemWorkflowPersistenceDependencies {
  gateway:
    FinancePersistenceGateway;
  sourceRepository:
    FinanceSystemWorkflowSourceRepository;
}

export type FinanceSystemWorkflowPersistenceResult =
  | FinancePersistenceOutcome
  | {
      outcome:
        "REJECT";
      reason:
        | "INVALID_SCOPE"
        | "SCOPE_MISMATCH"
        | "ACTOR_MISMATCH"
        | "WORKFLOW_AUTHORIZATION_MISMATCH"
        | "SOURCE_INVALID";
      sourceReason?:
        | "INVALID_SCOPE"
        | "SOURCE_NOT_FOUND"
        | "SOURCE_STATUS_INVALID"
        | "SOURCE_SCOPE_MISMATCH"
        | "SOURCE_CUSTOMER_MISMATCH"
        | "SOURCE_SALE_MISMATCH"
        | "SOURCE_AMOUNT_MISMATCH"
        | "SOURCE_ACTOR_MISMATCH";
    };

export async function persistSystemWorkflowFinanceTransaction(
  transaction:
    FinanceTransaction,
  context:
    FinanceSystemWorkflowContext,
  dependencies:
    FinanceSystemWorkflowPersistenceDependencies
): Promise<FinanceSystemWorkflowPersistenceResult> {
  const transactionScope:
    ErpScope = {
    tenantId:
      transaction.tenantId,
    companyId:
      transaction.companyId,
    branchId:
      transaction.branchId,
    accountingPeriodId:
      transaction.accountingPeriodId
  };

  if (
    !validateErpScope(context.scope).valid ||
    !validateErpScope(transactionScope).valid
  ) {
    return {
      outcome:
        "REJECT",
      reason:
        "INVALID_SCOPE"
    };
  }

  if (
    !erpScopeMatches(
      context.scope,
      transactionScope
    )
  ) {
    return {
      outcome:
        "REJECT",
      reason:
        "SCOPE_MISMATCH"
    };
  }

  if (
    !context.actorUserId.trim() ||
    transaction.createdBy !==
      context.actorUserId
  ) {
    return {
      outcome:
        "REJECT",
      reason:
        "ACTOR_MISMATCH"
    };
  }

  const authorization =
    decideFinancePersistenceAuthorization(
      transaction
    );

  if (
    !authorization.allowed ||
    authorization.authorization.mode !==
      "SYSTEM_WORKFLOW_ONLY" ||
    authorization.authorization.workflow !==
      context.workflow
  ) {
    return {
      outcome:
        "REJECT",
      reason:
        "WORKFLOW_AUTHORIZATION_MISMATCH"
    };
  }

  const sourceVerification =
    await verifyFinanceSystemWorkflowSource(
      transaction,
      context.workflow,
      dependencies.sourceRepository
    );

  if (!sourceVerification.verified) {
    return {
      outcome:
        "REJECT",
      reason:
        "SOURCE_INVALID",
      sourceReason:
        sourceVerification.reason
    };
  }

  return persistFinanceTransaction(
    transaction,
    {
      gateway:
        dependencies.gateway
    }
  );
}