export type SaleSourceType =
  | "MEASUREMENT"
  | "SALES_PREPARATION"
  | "MANUAL"
  | "SERVICE";

export type SaleDocumentType =
  | "SALE"
  | "SERVICE_ORDER";

export interface SaleSourceReference {
  sourceType: SaleSourceType;

  customerId: string;

  measurementId?: string;
  salesPreparationId?: string;
  serviceRequestId?: string;

  createdByUserId: string;
  createdAt: string;
}

export interface SaleMeasurementBinding {
  saleId: string;
  customerId: string;
  measurementId: string;

  boundByUserId: string;
  boundAt: string;

  bindingSource:
    | "MEASUREMENT_SELECTION"
    | "SALES_PREPARATION_TRANSFER";
}

export interface SaleSourceValidationInput {
  documentType: SaleDocumentType;
  source: SaleSourceReference;
}

export type SaleSourceValidationResult =
  | {
      valid: true;
    }
  | {
      valid: false;
      reason:
        | "CUSTOMER_REQUIRED"
        | "AUDIT_FIELDS_REQUIRED"
        | "MEASUREMENT_REQUIRED"
        | "SALES_PREPARATION_REQUIRED"
        | "SERVICE_REQUEST_REQUIRED"
        | "SALE_SOURCE_INVALID"
        | "SERVICE_SOURCE_INVALID";
    };

function hasText(
  value: string | undefined
): boolean {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}

function isValidDate(
  value: string
): boolean {
  return !Number.isNaN(
    new Date(value).getTime()
  );
}

export function validateSaleSource(
  input: SaleSourceValidationInput
): SaleSourceValidationResult {
  const { documentType, source } = input;

  if (!hasText(source.customerId)) {
    return {
      valid: false,
      reason: "CUSTOMER_REQUIRED"
    };
  }

  if (
    !hasText(source.createdByUserId) ||
    !isValidDate(source.createdAt)
  ) {
    return {
      valid: false,
      reason: "AUDIT_FIELDS_REQUIRED"
    };
  }

  if (
    source.sourceType === "MEASUREMENT" &&
    !hasText(source.measurementId)
  ) {
    return {
      valid: false,
      reason: "MEASUREMENT_REQUIRED"
    };
  }

  if (
    source.sourceType === "SALES_PREPARATION" &&
    (
      !hasText(source.salesPreparationId) ||
      !hasText(source.measurementId)
    )
  ) {
    return {
      valid: false,
      reason: "SALES_PREPARATION_REQUIRED"
    };
  }

  if (
    source.sourceType === "SERVICE" &&
    !hasText(source.serviceRequestId)
  ) {
    return {
      valid: false,
      reason: "SERVICE_REQUEST_REQUIRED"
    };
  }

  if (
    documentType === "SALE" &&
    source.sourceType === "SERVICE"
  ) {
    return {
      valid: false,
      reason: "SALE_SOURCE_INVALID"
    };
  }

  if (
    documentType === "SERVICE_ORDER" &&
    source.sourceType !== "SERVICE" &&
    source.sourceType !== "MANUAL"
  ) {
    return {
      valid: false,
      reason: "SERVICE_SOURCE_INVALID"
    };
  }

  return {
    valid: true
  };
}

export function saleSourceRequiresMeasurement(
  sourceType: SaleSourceType
): boolean {
  return (
    sourceType === "MEASUREMENT" ||
    sourceType === "SALES_PREPARATION"
  );
}

export function buildSaleMeasurementBinding(
  input: SaleMeasurementBinding
): SaleMeasurementBinding {
  if (
    !hasText(input.saleId) ||
    !hasText(input.customerId) ||
    !hasText(input.measurementId) ||
    !hasText(input.boundByUserId) ||
    !isValidDate(input.boundAt)
  ) {
    throw new Error(
      "SALE_MEASUREMENT_BINDING_INVALID"
    );
  }

  return {
    ...input
  };
}

export function getSaleSourceLabel(
  sourceType: SaleSourceType
): string {
  if (sourceType === "MEASUREMENT") {
    return "Ölçüye Bağlı Satış";
  }

  if (
    sourceType ===
    "SALES_PREPARATION"
  ) {
    return "Satışa Hazırlıktan Aktarıldı";
  }

  if (sourceType === "SERVICE") {
    return "Servis / Tamir Kaydı";
  }

  return "Manuel Satış";
}

export function canCreateAutomaticMainOperation(
  source: SaleSourceReference
): boolean {
  return (
    hasText(source.customerId) &&
    hasText(source.createdByUserId) &&
    isValidDate(source.createdAt)
  );
}