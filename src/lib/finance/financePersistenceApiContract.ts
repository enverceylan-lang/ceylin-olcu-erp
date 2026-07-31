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

import type {
  FinanceCapability,
  FinancePermission
} from "@/lib/finance/financeAccessPolicy";

import type {
  FinanceChannel
} from "@/lib/finance/financeChannelPermissions";

export interface FinancePersistenceApiActor {
  id:
    string;
}

export interface FinancePersistenceApiRequest {
  transaction:
    FinanceTransaction;
}

export type FinancePersistenceApiContractDecision =
  | {
      allowed:
        true;
      transaction:
        FinanceTransaction;
      guardInput: {
        channel:
          FinanceChannel;
        operation:
          "COLLECTION";
        direction:
          "CREATE";
        requestedPermission:
          FinancePermission;
        requestedCapability:
          FinanceCapability;
      };
    }
  | {
      allowed:
        false;
      status:
        400 | 403 | 409;
      code:
        | "INVALID_REQUEST"
        | "INVALID_SCOPE"
        | "SCOPE_MISMATCH"
        | "ACTOR_MISMATCH"
        | "SYSTEM_WORKFLOW_ENDPOINT_REQUIRED"
        | "TRANSACTION_AUTHORIZATION_DENIED";
    };

function isFinanceTransaction(
  value:
    unknown
): value is FinanceTransaction {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

export function decideFinancePersistenceApiContract(
  body:
    unknown,
  actor:
    FinancePersistenceApiActor,
  activeScope:
    ErpScope
): FinancePersistenceApiContractDecision {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return {
      allowed:
        false,
      status:
        400,
      code:
        "INVALID_REQUEST"
    };
  }

  const transaction =
    (
      body as {
        transaction?: unknown;
      }
    ).transaction;

  if (!isFinanceTransaction(transaction)) {
    return {
      allowed:
        false,
      status:
        400,
      code:
        "INVALID_REQUEST"
    };
  }

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
    !validateErpScope(activeScope).valid ||
    !validateErpScope(transactionScope).valid
  ) {
    return {
      allowed:
        false,
      status:
        400,
      code:
        "INVALID_SCOPE"
    };
  }

  if (
    !erpScopeMatches(
      activeScope,
      transactionScope
    )
  ) {
    return {
      allowed:
        false,
      status:
        403,
      code:
        "SCOPE_MISMATCH"
    };
  }

  if (
    transaction.createdBy !==
      actor.id
  ) {
    return {
      allowed:
        false,
      status:
        403,
      code:
        "ACTOR_MISMATCH"
    };
  }

  const authorization =
    decideFinancePersistenceAuthorization(
      transaction
    );

  if (!authorization.allowed) {
    return {
      allowed:
        false,
      status:
        400,
      code:
        "TRANSACTION_AUTHORIZATION_DENIED"
    };
  }

  if (
    authorization.authorization.mode ===
      "SYSTEM_WORKFLOW_ONLY"
  ) {
    return {
      allowed:
        false,
      status:
        409,
      code:
        "SYSTEM_WORKFLOW_ENDPOINT_REQUIRED"
    };
  }

  return {
    allowed:
      true,
    transaction,
    guardInput: {
      channel:
        authorization.authorization.channel,
      operation:
        "COLLECTION",
      direction:
        "CREATE",
      requestedPermission:
        authorization.authorization.permission,
      requestedCapability:
        authorization.authorization.capability
    }
  };
}