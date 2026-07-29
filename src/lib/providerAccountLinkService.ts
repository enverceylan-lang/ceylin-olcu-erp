import type {
  ProviderAccountLink,
  ProviderAccountType
} from "./providerAccountContracts";
import type {
  ErpScope
} from "./erpScope";
import {
  erpScopeMatches
} from "./erpScope";

export interface ProviderLinkUser {
  id: string;
  role: string;
  isActive: boolean;
}

export interface ProviderLinkCustomer {
  id: string;
  cariType?: string;
  isActive?: boolean;
  isArchived?: boolean;
}

export interface CreateProviderAccountLinkRequest
  extends ErpScope {
  id: string;
  idempotencyKey: string;

  user: ProviderLinkUser;
  customer: ProviderLinkCustomer;

  createdByUserId: string;
  now: string;
}

export type ProviderAccountLinkRejectionReason =
  | "SCOPE_REQUIRED"
  | "ID_REQUIRED"
  | "IDEMPOTENCY_KEY_REQUIRED"
  | "ACTOR_REQUIRED"
  | "INVALID_DATE"
  | "USER_INACTIVE"
  | "CUSTOMER_INACTIVE"
  | "ROLE_NOT_SUPPORTED"
  | "CUSTOMER_TYPE_MISMATCH"
  | "ACTIVE_LINK_ALREADY_EXISTS"
  | "IDEMPOTENCY_CONFLICT";

export type CreateProviderAccountLinkResult =
  | {
      outcome: "CREATED";
      link: ProviderAccountLink;
    }
  | {
      outcome: "REPLAY";
      link: ProviderAccountLink;
    }
  | {
      outcome: "REJECTED";
      reason:
        ProviderAccountLinkRejectionReason;
    };

function isNonEmpty(
  value: string | undefined
): boolean {
  return Boolean(
    value?.trim()
  );
}

function hasScope(
  scope: ErpScope
): boolean {
  return (
    isNonEmpty(scope.tenantId) &&
    isNonEmpty(scope.companyId) &&
    isNonEmpty(scope.branchId) &&
    isNonEmpty(
      scope.accountingPeriodId
    )
  );
}

function normalize(
  value: string | undefined
): string {
  return String(value || "")
    .trim()
    .toUpperCase();
}

export function resolveProviderAccountType(
  role: string
): ProviderAccountType | null {
  const normalized =
    normalize(role);

  if (
    normalized === "TAILOR" ||
    normalized === "PRODUCTION"
  ) {
    return "TAILOR";
  }

  if (
    normalized === "INSTALLER" ||
    normalized === "INSTALLATION"
  ) {
    return "INSTALLER";
  }

  return null;
}

function isCustomerActive(
  customer: ProviderLinkCustomer
): boolean {
  return (
    customer.isActive !== false &&
    customer.isArchived !== true
  );
}

function samePayload(
  request: CreateProviderAccountLinkRequest,
  link: ProviderAccountLink,
  providerType: ProviderAccountType
): boolean {
  return (
    link.userId === request.user.id &&
    link.providerCustomerId ===
      request.customer.id &&
    link.providerType ===
      providerType &&
    link.status === "ACTIVE"
  );
}

export function decideCreateProviderAccountLink(
  request: CreateProviderAccountLinkRequest,
  existing:
    readonly ProviderAccountLink[]
): CreateProviderAccountLinkResult {
  if (!hasScope(request)) {
    return {
      outcome: "REJECTED",
      reason: "SCOPE_REQUIRED"
    };
  }

  if (!isNonEmpty(request.id)) {
    return {
      outcome: "REJECTED",
      reason: "ID_REQUIRED"
    };
  }

  if (!isNonEmpty(request.idempotencyKey)) {
    return {
      outcome: "REJECTED",
      reason:
        "IDEMPOTENCY_KEY_REQUIRED"
    };
  }

  if (!isNonEmpty(request.createdByUserId)) {
    return {
      outcome: "REJECTED",
      reason: "ACTOR_REQUIRED"
    };
  }

  const date =
    new Date(request.now);

  if (Number.isNaN(date.getTime())) {
    return {
      outcome: "REJECTED",
      reason: "INVALID_DATE"
    };
  }

  if (!request.user.isActive) {
    return {
      outcome: "REJECTED",
      reason: "USER_INACTIVE"
    };
  }

  if (!isCustomerActive(request.customer)) {
    return {
      outcome: "REJECTED",
      reason: "CUSTOMER_INACTIVE"
    };
  }

  const providerType =
    resolveProviderAccountType(
      request.user.role
    );

  if (!providerType) {
    return {
      outcome: "REJECTED",
      reason: "ROLE_NOT_SUPPORTED"
    };
  }

  if (
    normalize(
      request.customer.cariType
    ) !== providerType
  ) {
    return {
      outcome: "REJECTED",
      reason:
        "CUSTOMER_TYPE_MISMATCH"
    };
  }

  const idempotentLink =
    existing.find(
      link =>
        link.idempotencyKey ===
          request.idempotencyKey &&
        erpScopeMatches(
          link,
          request
        )
    );

  if (idempotentLink) {
    if (
      samePayload(
        request,
        idempotentLink,
        providerType
      )
    ) {
      return {
        outcome: "REPLAY",
        link: idempotentLink
      };
    }

    return {
      outcome: "REJECTED",
      reason:
        "IDEMPOTENCY_CONFLICT"
    };
  }

  const activeUserLink =
    existing.find(
      link =>
        link.userId ===
          request.user.id &&
        link.status === "ACTIVE" &&
        erpScopeMatches(
          link,
          request
        )
    );

  if (activeUserLink) {
    return {
      outcome: "REJECTED",
      reason:
        "ACTIVE_LINK_ALREADY_EXISTS"
    };
  }

  const now =
    date.toISOString();

  const link:
    ProviderAccountLink = {
      tenantId:
        request.tenantId,

      companyId:
        request.companyId,

      branchId:
        request.branchId,

      accountingPeriodId:
        request.accountingPeriodId,

      id:
        request.id.trim(),

      idempotencyKey:
        request.idempotencyKey.trim(),

      userId:
        request.user.id.trim(),

      providerCustomerId:
        request.customer.id.trim(),

      providerType,

      status: "ACTIVE",

      createdByUserId:
        request.createdByUserId.trim(),

      createdAt: now,
      updatedAt: now
    };

  return {
    outcome: "CREATED",
    link
  };
}