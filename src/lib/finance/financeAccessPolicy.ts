import {
  decideFeatureAccess,
  type ErpFeature,
  type ErpPackage,
} from "@/lib/packageFeatures";
import {
  validateErpScope,
  type ErpScope,
  type ErpScopeField,
} from "@/lib/erpScope";

export type FinancePermission =
  | "finance.view"
  | "customerFinance.view"
  | "finance.collection.create"
  | "finance.collection.reverse"
  | "finance.payment.create"
  | "finance.payment.reverse"
  | "finance.transfer.create"
  | "finance.cash.view"
  | "finance.bank.view"
  | "finance.pos.view"
  | "finance.cheque.view"
  | "finance.note.view"
  | "finance.report.view"
  | "finance.reconciliation.view"
  | "finance.account.manage";

export type FinanceCapability =
  | "BASIC_FINANCE"
  | "CUSTOMER_FINANCE"
  | "COLLECTION_CREATE"
  | "COLLECTION_REVERSE"
  | "PAYMENT_CREATE"
  | "PAYMENT_REVERSE"
  | "TRANSFER_CREATE"
  | "CASH_VIEW"
  | "BANK_VIEW"
  | "POS_VIEW"
  | "CHEQUE_VIEW"
  | "NOTE_VIEW"
  | "REPORT_VIEW"
  | "RECONCILIATION_VIEW"
  | "ACCOUNT_MANAGE";

export interface FinanceAccessContext {
  scope: ErpScope;
  customerId?: string;
  saleId?: string;
}

export interface FinanceAccessRequest {
  packageType: ErpPackage;
  permissions: readonly FinancePermission[];
  scope: ErpScope;
  requestedCapability: FinanceCapability;
  financeContext: FinanceAccessContext;
}

export type FinanceAccessReasonCode =
  | "ALLOWED"
  | "MISSING_SCOPE"
  | "SCOPE_DENIED"
  | "PERMISSION_DENIED"
  | "PACKAGE_FEATURE_DENIED";

export interface EvaluatedFinanceScope {
  actorScope: ErpScope | null;
  financeScope: ErpScope | null;
  missingActorScopeFields: ErpScopeField[];
  missingFinanceScopeFields: ErpScopeField[];
}

export interface FinanceAccessDecision {
  allowed: boolean;
  reasonCode: FinanceAccessReasonCode;
  requiredPermission: FinancePermission;
  requiredFeature: ErpFeature;
  evaluatedScope: EvaluatedFinanceScope;
}

interface FinanceCapabilityRequirement {
  permission: FinancePermission;
  feature: Extract<ErpFeature, "basicFinance" | "customerFinance">;
}

const CAPABILITY_REQUIREMENTS: Record<
  FinanceCapability,
  FinanceCapabilityRequirement
> = {
  BASIC_FINANCE: {
    permission: "finance.view",
    feature: "basicFinance",
  },
  CUSTOMER_FINANCE: {
    permission: "customerFinance.view",
    feature: "customerFinance",
  },
  COLLECTION_CREATE: {
    permission: "finance.collection.create",
    feature: "basicFinance",
  },
  COLLECTION_REVERSE: {
    permission: "finance.collection.reverse",
    feature: "basicFinance",
  },
  PAYMENT_CREATE: {
    permission: "finance.payment.create",
    feature: "basicFinance",
  },
  PAYMENT_REVERSE: {
    permission: "finance.payment.reverse",
    feature: "basicFinance",
  },
  TRANSFER_CREATE: {
    permission: "finance.transfer.create",
    feature: "customerFinance",
  },
  CASH_VIEW: {
    permission: "finance.cash.view",
    feature: "customerFinance",
  },
  BANK_VIEW: {
    permission: "finance.bank.view",
    feature: "customerFinance",
  },
  POS_VIEW: {
    permission: "finance.pos.view",
    feature: "customerFinance",
  },
  CHEQUE_VIEW: {
    permission: "finance.cheque.view",
    feature: "customerFinance",
  },
  NOTE_VIEW: {
    permission: "finance.note.view",
    feature: "customerFinance",
  },
  REPORT_VIEW: {
    permission: "finance.report.view",
    feature: "basicFinance",
  },
  RECONCILIATION_VIEW: {
    permission: "finance.reconciliation.view",
    feature: "customerFinance",
  },
  ACCOUNT_MANAGE: {
    permission: "finance.account.manage",
    feature: "customerFinance",
  },
};

function evaluatedScope(
  request: FinanceAccessRequest,
): EvaluatedFinanceScope {
  const actorValidation = validateErpScope(request.scope || {});
  const financeValidation = validateErpScope(
    request.financeContext?.scope || {},
  );
  return {
    actorScope: actorValidation.valid ? { ...request.scope } : null,
    financeScope: financeValidation.valid
      ? { ...request.financeContext.scope }
      : null,
    missingActorScopeFields: actorValidation.missingFields,
    missingFinanceScopeFields: financeValidation.missingFields,
  };
}

export function decideFinanceAccess(
  request: FinanceAccessRequest,
): FinanceAccessDecision {
  const requirement = CAPABILITY_REQUIREMENTS[request.requestedCapability];
  const scopeEvaluation = evaluatedScope(request);
  const base = {
    requiredPermission: requirement.permission,
    requiredFeature: requirement.feature,
    evaluatedScope: scopeEvaluation,
  };

  if (!scopeEvaluation.actorScope || !scopeEvaluation.financeScope) {
    return {
      allowed: false,
      reasonCode: "MISSING_SCOPE",
      ...base,
    };
  }

  const hasPermission = request.permissions.includes(requirement.permission);
  const featureDecision = decideFeatureAccess({
    package: request.packageType,
    feature: requirement.feature,
    roleAllows: hasPermission,
    actorScope: scopeEvaluation.actorScope,
    recordScope: scopeEvaluation.financeScope,
  });

  if (!featureDecision.allowed) {
    const reasonCode: FinanceAccessReasonCode =
      featureDecision.reason === "PACKAGE_LICENSE_DENIED"
        ? "PACKAGE_FEATURE_DENIED"
        : featureDecision.reason === "SCOPE_DENIED"
          ? "SCOPE_DENIED"
          : "PERMISSION_DENIED";
    return {
      allowed: false,
      reasonCode,
      ...base,
    };
  }

  return {
    allowed: true,
    reasonCode: "ALLOWED",
    ...base,
  };
}
