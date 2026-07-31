import {
  erpScopeMatches,
  validateErpScope,
  type ErpScope
} from "@/lib/erpScope";

import {
  parseFinanceSystemWorkflowApiRequest
} from "@/lib/finance/financeSystemWorkflowApiContract";

import {
  persistSupabaseWorkflowSourceAndFinance,
  type FinanceSupabaseWorkflowCoordinatorClient,
  type FinanceSupabaseWorkflowCoordinatorResult
} from "@/lib/finance/financeSupabaseWorkflowCoordinator";

export interface FinanceSystemWorkflowApiActor {
  userId:
    string;
  scope:
    ErpScope;
}

type FinanceSystemWorkflowConflictResult =
  Exclude<
    FinanceSupabaseWorkflowCoordinatorResult,
    | {
        outcome:
          "CREATED";
      }
    | {
        outcome:
          "REPLAY";
      }
  >;

export type FinanceSystemWorkflowApiHandlerResult =
  | {
      status:
        200 | 201;
      body:
        FinanceSupabaseWorkflowCoordinatorResult;
    }
  | {
      status:
        409;
      body:
        FinanceSystemWorkflowConflictResult;
    }
  | {
      status:
        400 | 403 | 500;
      body: {
        outcome:
          "REJECT";
        reason:
          string;
      };
    };

function sourceScope(
  source:
    {
      tenantId:
        string;
      companyId:
        string;
      branchId:
        string;
      accountingPeriodId:
        string;
    }
): ErpScope {
  return {
    tenantId:
      source.tenantId,
    companyId:
      source.companyId,
    branchId:
      source.branchId,
    accountingPeriodId:
      source.accountingPeriodId
  };
}

export async function handleFinanceSystemWorkflowApi(
  body:
    unknown,
  actor:
    FinanceSystemWorkflowApiActor,
  client:
    FinanceSupabaseWorkflowCoordinatorClient
): Promise<FinanceSystemWorkflowApiHandlerResult> {
  const parsed =
    parseFinanceSystemWorkflowApiRequest(
      body
    );

  if (!parsed.valid) {
    return {
      status:
        400,
      body: {
        outcome:
          "REJECT",
        reason:
          parsed.reason
      }
    };
  }

  if (
    !actor.userId.trim() ||
    !validateErpScope(actor.scope).valid
  ) {
    return {
      status:
        403,
      body: {
        outcome:
          "REJECT",
        reason:
          "ACTOR_CONTEXT_INVALID"
      }
    };
  }

  const transactionScope:
    ErpScope = {
    tenantId:
      parsed.value.transaction.tenantId,
    companyId:
      parsed.value.transaction.companyId,
    branchId:
      parsed.value.transaction.branchId,
    accountingPeriodId:
      parsed.value.transaction.accountingPeriodId
  };

  if (
    !erpScopeMatches(
      actor.scope,
      transactionScope
    ) ||
    !erpScopeMatches(
      actor.scope,
      sourceScope(parsed.value.source)
    )
  ) {
    return {
      status:
        403,
      body: {
        outcome:
          "REJECT",
        reason:
          "SCOPE_MISMATCH"
      }
    };
  }

  const sourceActorId =
    parsed.value.workflow ===
      "SALE_APPROVAL"
      ? parsed.value.source
          .approvedByUserId
      : parsed.value.source
          .actorUserId;

  if (
    parsed.value.transaction.createdBy !==
      actor.userId ||
    sourceActorId !==
      actor.userId
  ) {
    return {
      status:
        403,
      body: {
        outcome:
          "REJECT",
        reason:
          "ACTOR_MISMATCH"
      }
    };
  }

  try {
    const result =
      await persistSupabaseWorkflowSourceAndFinance(
        {
          ...parsed.value,
          context: {
            workflow:
              parsed.value.workflow,
            actorUserId:
              actor.userId,
            scope:
              actor.scope
          }
        },
        client
      );

    if (
      result.outcome ===
        "CREATED"
    ) {
      return {
        status:
          201,
        body:
          result
      };
    }

    if (
      result.outcome ===
        "REPLAY"
    ) {
      return {
        status:
          200,
        body:
          result
      };
    }

    return {
      status:
        409,
      body:
        result
    };
  }
  catch {
    return {
      status:
        500,
      body: {
        outcome:
          "REJECT",
        reason:
          "SYSTEM_WORKFLOW_PERSISTENCE_FAILED"
      }
    };
  }
}