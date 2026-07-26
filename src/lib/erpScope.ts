export interface ErpScope {
  tenantId: string;
  companyId: string;
  branchId: string;
  accountingPeriodId: string;
}

export type ErpScopeField = keyof ErpScope;

export interface ErpScopeValidation {
  valid: boolean;
  missingFields: ErpScopeField[];
}

export function validateErpScope(scope: Partial<ErpScope>): ErpScopeValidation {
  const fields: ErpScopeField[] = [
    "tenantId",
    "companyId",
    "branchId",
    "accountingPeriodId",
  ];
  const missingFields = fields.filter(
    (field) =>
      typeof scope[field] !== "string" || scope[field]?.trim().length === 0
  );
  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}

export function erpScopeMatches(
  left: ErpScope,
  right: ErpScope
): boolean {
  return (
    left.tenantId === right.tenantId &&
    left.companyId === right.companyId &&
    left.branchId === right.branchId &&
    left.accountingPeriodId === right.accountingPeriodId
  );
}

export function erpScopeKey(scope: ErpScope): string {
  const validation = validateErpScope(scope);
  if (!validation.valid) {
    throw new Error(
      `ERP kapsamı eksik: ${validation.missingFields.join(", ")}`
    );
  }
  return [
    scope.tenantId,
    scope.companyId,
    scope.branchId,
    scope.accountingPeriodId,
  ]
    .map((value) => encodeURIComponent(value))
    .join("|");
}
