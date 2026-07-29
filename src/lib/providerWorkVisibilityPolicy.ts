import type {
  OperationRecord
} from "./operationsWorkflow";
import {
  erpScopeMatches
} from "./erpScope";
import type {
  ProviderAccountType,
  ProviderWorkActor,
  ProviderWorkLinkSnapshot,
  ProviderWorkVisibilityReason
} from "./providerAccountContracts";

export interface ProviderWorkVisibilityDecision {
  visible: boolean;
  reason:
    ProviderWorkVisibilityReason;
}

function normalizeRole(
  value: string
): string {
  return value
    .trim()
    .toUpperCase();
}

function resolveProviderType(
  role: string
): ProviderAccountType | null {
  const normalized =
    normalizeRole(role);

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

function isManagementRole(
  role: string
): boolean {
  const normalized =
    normalizeRole(role);

  return (
    normalized === "ADMIN" ||
    normalized === "MODERATOR" ||
    normalized === "OFFICE"
  );
}

export function decideProviderWorkVisibility(
  actor: ProviderWorkActor,
  operation: OperationRecord,
  link?: ProviderWorkLinkSnapshot
): ProviderWorkVisibilityDecision {
  if (
    !erpScopeMatches(
      actor,
      operation
    )
  ) {
    return {
      visible: false,
      reason: "SCOPE_MISMATCH"
    };
  }

  if (isManagementRole(actor.role)) {
    return {
      visible: true,
      reason: "VISIBLE_AS_ADMIN"
    };
  }

  if (operation.kind === "GENERAL") {
    return {
      visible: false,
      reason: "GENERAL_OPERATION_HIDDEN"
    };
  }

  const providerType =
    resolveProviderType(
      actor.role
    );

  if (!providerType) {
    return {
      visible: false,
      reason: "ROLE_NOT_SUPPORTED"
    };
  }

  if (!link) {
    return {
      visible: false,
      reason: "PROVIDER_LINK_REQUIRED"
    };
  }

  if (
    link.userId !== actor.userId
  ) {
    return {
      visible: false,
      reason: "PROVIDER_LINK_REQUIRED"
    };
  }

  if (
    link.providerType !==
    providerType
  ) {
    return {
      visible: false,
      reason:
        "PROVIDER_TYPE_MISMATCH"
    };
  }

  const expectedKind =
    providerType === "TAILOR"
      ? "TAILOR"
      : "INSTALLATION";

  if (
    operation.kind !==
    expectedKind
  ) {
    return {
      visible: false,
      reason:
        "PROVIDER_TYPE_MISMATCH"
    };
  }

  if (
    !operation.party ||
    operation.party.id !==
      link.providerCustomerId
  ) {
    return {
      visible: false,
      reason:
        "OPERATION_PARTY_MISMATCH"
    };
  }

  return {
    visible: true,
    reason: "VISIBLE_AS_PROVIDER"
  };
}