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
  | "finance.transfer.reverse"
  | "finance.cash.collection.create"
  | "finance.cash.collection.reverse"
  | "finance.cash.payment.create"
  | "finance.cash.payment.reverse"
  | "finance.bank.collection.create"
  | "finance.bank.collection.reverse"
  | "finance.bank.payment.create"
  | "finance.bank.payment.reverse"
  | "finance.pos.collection.create"
  | "finance.pos.collection.reverse"
  | "finance.pos.refund.create"
  | "finance.pos.refund.reverse"
  | "finance.cheque.receipt.create"
  | "finance.cheque.receipt.reverse"
  | "finance.cheque.issue.create"
  | "finance.cheque.issue.reverse"
  | "finance.note.receipt.create"
  | "finance.note.receipt.reverse"
  | "finance.note.issue.create"
  | "finance.note.issue.reverse"
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
  | "TRANSFER_REVERSE"
  | "CASH_COLLECTION_CREATE"
  | "CASH_COLLECTION_REVERSE"
  | "CASH_PAYMENT_CREATE"
  | "CASH_PAYMENT_REVERSE"
  | "BANK_COLLECTION_CREATE"
  | "BANK_COLLECTION_REVERSE"
  | "BANK_PAYMENT_CREATE"
  | "BANK_PAYMENT_REVERSE"
  | "POS_COLLECTION_CREATE"
  | "POS_COLLECTION_REVERSE"
  | "POS_REFUND_CREATE"
  | "POS_REFUND_REVERSE"
  | "CHEQUE_RECEIPT_CREATE"
  | "CHEQUE_RECEIPT_REVERSE"
  | "CHEQUE_ISSUE_CREATE"
  | "CHEQUE_ISSUE_REVERSE"
  | "NOTE_RECEIPT_CREATE"
  | "NOTE_RECEIPT_REVERSE"
  | "NOTE_ISSUE_CREATE"
  | "NOTE_ISSUE_REVERSE"
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
  TRANSFER_REVERSE: {
    permission: "finance.transfer.reverse",
    feature: "customerFinance",
  },
  CASH_COLLECTION_CREATE: {
    permission: "finance.cash.collection.create",
    feature: "customerFinance",
  },
  CASH_COLLECTION_REVERSE: {
    permission: "finance.cash.collection.reverse",
    feature: "customerFinance",
  },
  CASH_PAYMENT_CREATE: {
    permission: "finance.cash.payment.create",
    feature: "customerFinance",
  },
  CASH_PAYMENT_REVERSE: {
    permission: "finance.cash.payment.reverse",
    feature: "customerFinance",
  },
  BANK_COLLECTION_CREATE: {
    permission: "finance.bank.collection.create",
    feature: "customerFinance",
  },
  BANK_COLLECTION_REVERSE: {
    permission: "finance.bank.collection.reverse",
    feature: "customerFinance",
  },
  BANK_PAYMENT_CREATE: {
    permission: "finance.bank.payment.create",
    feature: "customerFinance",
  },
  BANK_PAYMENT_REVERSE: {
    permission: "finance.bank.payment.reverse",
    feature: "customerFinance",
  },
  POS_COLLECTION_CREATE: {
    permission: "finance.pos.collection.create",
    feature: "customerFinance",
  },
  POS_COLLECTION_REVERSE: {
    permission: "finance.pos.collection.reverse",
    feature: "customerFinance",
  },
  POS_REFUND_CREATE: {
    permission: "finance.pos.refund.create",
    feature: "customerFinance",
  },
  POS_REFUND_REVERSE: {
    permission: "finance.pos.refund.reverse",
    feature: "customerFinance",
  },
  CHEQUE_RECEIPT_CREATE: {
    permission: "finance.cheque.receipt.create",
    feature: "customerFinance",
  },
  CHEQUE_RECEIPT_REVERSE: {
    permission: "finance.cheque.receipt.reverse",
    feature: "customerFinance",
  },
  CHEQUE_ISSUE_CREATE: {
    permission: "finance.cheque.issue.create",
    feature: "customerFinance",
  },
  CHEQUE_ISSUE_REVERSE: {
    permission: "finance.cheque.issue.reverse",
    feature: "customerFinance",
  },
  NOTE_RECEIPT_CREATE: {
    permission: "finance.note.receipt.create",
    feature: "customerFinance",
  },
  NOTE_RECEIPT_REVERSE: {
    permission: "finance.note.receipt.reverse",
    feature: "customerFinance",
  },
  NOTE_ISSUE_CREATE: {
    permission: "finance.note.issue.create",
    feature: "customerFinance",
  },
  NOTE_ISSUE_REVERSE: {
    permission: "finance.note.issue.reverse",
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
