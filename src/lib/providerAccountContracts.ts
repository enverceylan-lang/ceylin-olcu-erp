import type {
  ErpScope
} from "./erpScope";

export type ProviderAccountType =
  | "TAILOR"
  | "INSTALLER";

export type ProviderAccountLinkStatus =
  | "ACTIVE"
  | "PASSIVE";

export interface ProviderAccountLink
  extends ErpScope {
  id: string;
  idempotencyKey: string;

  userId: string;
  providerCustomerId: string;

  providerType:
    ProviderAccountType;

  status:
    ProviderAccountLinkStatus;

  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderWorkActor {
  userId: string;
  role: string;

  tenantId: string;
  companyId: string;
  branchId: string;
  accountingPeriodId: string;
}

export interface ProviderWorkLinkSnapshot {
  userId: string;
  providerCustomerId: string;
  providerType:
    ProviderAccountType;
}

export type ProviderWorkVisibilityReason =
  | "VISIBLE_AS_ADMIN"
  | "VISIBLE_AS_PROVIDER"
  | "ROLE_NOT_SUPPORTED"
  | "PROVIDER_LINK_REQUIRED"
  | "PROVIDER_TYPE_MISMATCH"
  | "OPERATION_PARTY_MISMATCH"
  | "SCOPE_MISMATCH"
  | "GENERAL_OPERATION_HIDDEN";