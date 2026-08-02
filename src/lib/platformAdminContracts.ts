import {
  getPackageDisplayLabel,
  normalizeErpPackage,
  type ErpPackage
} from "./packageFeatures";

export type PlatformAdminRole =
  | "PLATFORM_SUPER_ADMIN"
  | "COMPANY_ADMIN"
  | "SUPPORT"
  | "NONE";

export interface PlatformAdminActor {
  userId: string;
  role: string;
}

export interface PlatformCompanyLicenseRecord {
  tenantId: string;
  companyId: string;

  companyCode: string;
  companySlug: string;
  companyName: string;

  package: ErpPackage;

  licenseActive: boolean;
  licenseStartsAt: string;
  licenseEndsAt?: string;

  branchLimit: number;
  userLimit: number;

  createdAt: string;
  updatedAt: string;
}

export interface PlatformCompanyLicenseView {
  tenantId: string;
  companyId: string;

  companyCode: string;
  companySlug: string;
  companyName: string;

  package: ErpPackage;
  packageLabel:
    | "ECO"
    | "PRO"
    | "PLUS"
    | "ELITE"
    | "PAKET TANIMSIZ";

  licenseActive: boolean;
  licenseStartsAt: string;
  licenseEndsAt?: string;

  branchLimit: number;
  userLimit: number;

  createdAt: string;
  updatedAt: string;
}

export interface PlatformLicenseUpdateRequest {
  tenantId: string;
  companyId: string;

  package:
    | ErpPackage
    | "NORMAL"
    | "STANDARD";

  licenseActive: boolean;
  licenseStartsAt: string;
  licenseEndsAt?: string;

  branchLimit: number;
  userLimit: number;

  changedByUserId: string;
  changedAt: string;
}

export type PlatformLicenseValidation =
  | {
      valid: true;
      normalizedPackage: ErpPackage;
    }
  | {
      valid: false;
      reason:
        | "SCOPE_REQUIRED"
        | "PACKAGE_INVALID"
        | "DATE_INVALID"
        | "DATE_RANGE_INVALID"
        | "BRANCH_LIMIT_INVALID"
        | "USER_LIMIT_INVALID"
        | "AUDIT_FIELDS_REQUIRED";
    };

const FORBIDDEN_PLATFORM_DATA_KEYS =
  new Set([
    "sales",
    "sale",
    "saleAmount",
    "revenue",
    "profit",
    "margin",
    "customer",
    "customers",
    "customerName",
    "customerId",
    "supplier",
    "suppliers",
    "stock",
    "stocks",
    "price",
    "prices",
    "cash",
    "bankBalance",
    "balance",
    "receivable",
    "payable",
    "collection",
    "collections",
    "payment",
    "payments",
    "finance",
    "financeMovements",
    "posMovements"
  ]);

function normalizePlatformRole(
  role: string
): PlatformAdminRole {
  const normalized =
    role.trim().toUpperCase();

  if (
    normalized ===
    "PLATFORM_SUPER_ADMIN"
  ) {
    return "PLATFORM_SUPER_ADMIN";
  }

  if (
    normalized === "COMPANY_ADMIN" ||
    normalized === "ADMIN"
  ) {
    return "COMPANY_ADMIN";
  }

  if (normalized === "SUPPORT") {
    return "SUPPORT";
  }

  return "NONE";
}

function isValidIsoDate(
  value: string | undefined
): boolean {
  if (!value) {
    return false;
  }

  return !Number.isNaN(
    new Date(value).getTime()
  );
}

export function isPlatformSuperAdmin(
  actor: PlatformAdminActor | null
): boolean {
  return (
    actor !== null &&
    normalizePlatformRole(actor.role) ===
      "PLATFORM_SUPER_ADMIN"
  );
}

export function canReadPlatformCompanies(
  actor: PlatformAdminActor | null
): boolean {
  return isPlatformSuperAdmin(actor);
}

export function canChangePlatformLicense(
  actor: PlatformAdminActor | null
): boolean {
  return isPlatformSuperAdmin(actor);
}

export function validatePlatformLicenseUpdate(
  request: PlatformLicenseUpdateRequest
): PlatformLicenseValidation {
  if (
    request.tenantId.trim().length === 0 ||
    request.companyId.trim().length === 0
  ) {
    return {
      valid: false,
      reason: "SCOPE_REQUIRED"
    };
  }

  const normalizedPackage =
    normalizeErpPackage(request.package);

  if (!normalizedPackage) {
    return {
      valid: false,
      reason: "PACKAGE_INVALID"
    };
  }

  if (
    !isValidIsoDate(
      request.licenseStartsAt
    ) ||
    (
      request.licenseEndsAt !==
        undefined &&
      !isValidIsoDate(
        request.licenseEndsAt
      )
    )
  ) {
    return {
      valid: false,
      reason: "DATE_INVALID"
    };
  }

  if (
    request.licenseEndsAt &&
    new Date(
      request.licenseEndsAt
    ).getTime() <
      new Date(
        request.licenseStartsAt
      ).getTime()
  ) {
    return {
      valid: false,
      reason: "DATE_RANGE_INVALID"
    };
  }

  if (
    !Number.isInteger(
      request.branchLimit
    ) ||
    request.branchLimit < 1 ||
    request.branchLimit > 1000
  ) {
    return {
      valid: false,
      reason: "BRANCH_LIMIT_INVALID"
    };
  }

  if (
    !Number.isInteger(
      request.userLimit
    ) ||
    request.userLimit < 1 ||
    request.userLimit > 100000
  ) {
    return {
      valid: false,
      reason: "USER_LIMIT_INVALID"
    };
  }

  if (
    request.changedByUserId
      .trim().length === 0 ||
    !isValidIsoDate(request.changedAt)
  ) {
    return {
      valid: false,
      reason:
        "AUDIT_FIELDS_REQUIRED"
    };
  }

  return {
    valid: true,
    normalizedPackage
  };
}

export function isLicenseEffectiveAt(
  license: Pick<
    PlatformCompanyLicenseRecord,
    | "licenseActive"
    | "licenseStartsAt"
    | "licenseEndsAt"
  >,
  at: string
): boolean {
  if (
    !license.licenseActive ||
    !isValidIsoDate(
      license.licenseStartsAt
    ) ||
    !isValidIsoDate(at)
  ) {
    return false;
  }

  const target =
    new Date(at).getTime();

  const starts =
    new Date(
      license.licenseStartsAt
    ).getTime();

  if (target < starts) {
    return false;
  }

  if (!license.licenseEndsAt) {
    return true;
  }

  return (
    target <=
    new Date(
      license.licenseEndsAt
    ).getTime()
  );
}

export function buildPlatformCompanyLicenseView(
  record: PlatformCompanyLicenseRecord
): PlatformCompanyLicenseView {
  return {
    tenantId: record.tenantId,
    companyId: record.companyId,

    companyCode: record.companyCode,
    companySlug: record.companySlug,
    companyName: record.companyName,

    package: record.package,
    packageLabel:
      getPackageDisplayLabel(
        record.package
      ),

    licenseActive:
      record.licenseActive,

    licenseStartsAt:
      record.licenseStartsAt,

    licenseEndsAt:
      record.licenseEndsAt,

    branchLimit:
      record.branchLimit,

    userLimit:
      record.userLimit,

    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

export function assertPlatformMetadataOnly(
  value: unknown
): void {
  const visited =
    new Set<object>();

  function visit(
    current: unknown,
    path: string
  ): void {
    if (
      current === null ||
      typeof current !== "object"
    ) {
      return;
    }

    if (visited.has(current)) {
      return;
    }

    visited.add(current);

    if (Array.isArray(current)) {
      current.forEach(
        (item, index) =>
          visit(
            item,
            `${path}[${index}]`
          )
      );

      return;
    }

    for (
      const [
        key,
        nestedValue
      ] of Object.entries(current)
    ) {
      if (
        FORBIDDEN_PLATFORM_DATA_KEYS.has(
          key
        )
      ) {
        throw new Error(
          `PLATFORM_OPERATIONAL_DATA_FORBIDDEN:${path}.${key}`
        );
      }

      visit(
        nestedValue,
        `${path}.${key}`
      );
    }
  }

  visit(value, "$");
}