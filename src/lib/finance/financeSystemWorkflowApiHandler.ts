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
  catch (error: unknown) {
    // Do not print error.message, error.stack, RPC payload, actor or ERP scope.
    // Supabase gateway currently concatenates an untrusted DB message into
    // Error.message. Only fixed, allowlisted category strings may be logged.
    let failureClass:
      | "RPC_REJECTED"
      | "RPC_RESULT_INVALID"
      | "RPC_TRANSACTION_ID_MISSING"
      | "RPC_RESPONSE_INVALID"
      | "UNKNOWN" = "UNKNOWN";

    if (error instanceof Error) {
      if (error.message.startsWith("FINANCE_WORKFLOW_ATOMIC_RPC_FAILED:")) {
        failureClass = "RPC_REJECTED";
      } else if (error.message === "FINANCE_WORKFLOW_ATOMIC_RPC_RESULT_INVALID") {
        failureClass = "RPC_RESULT_INVALID";
      } else if (error.message === "FINANCE_WORKFLOW_ATOMIC_TRANSACTION_ID_REQUIRED") {
        failureClass = "RPC_TRANSACTION_ID_MISSING";
      } else if (
        error.message === "FINANCE_WORKFLOW_ATOMIC_CONFLICT_REASON_REQUIRED" ||
        error.message === "FINANCE_WORKFLOW_ATOMIC_UNEXPECTED_REASON"
      ) {
        failureClass = "RPC_RESPONSE_INVALID";
      }
    }

    console.error("FINANCE_SYSTEM_WORKFLOW_FAILURE", { failureClass });
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