import type {
  OperationParty
} from "@/lib/operationsWorkflow";

export type InstallationAssignmentMode =
  | "UNASSIGNED"
  | "INTERNAL"
  | "EXTERNAL";

export interface InstallationAssignableUser {
  id: string;
  name: string;
  phone?: string;
  role?: string;
  isActive: boolean;
  providerCustomerId?: string;
  providerType?: "TAILOR" | "INSTALLER";
}

export type InstallationAssignmentDecision =
  | {
      mode: "UNASSIGNED";
      party: undefined;
    }
  | {
      mode: "INTERNAL";
      party: OperationParty;
    }
  | {
      mode: "EXTERNAL";
      party: OperationParty;
    }
  | {
      mode: "REJECTED";
      reason:
        | "USER_INACTIVE"
        | "USER_ID_MISSING"
        | "USER_NAME_MISSING"
        | "EXTERNAL_PROVIDER_ID_MISSING";
    };

function text(
  value: string | undefined
): string {
  return String(value || "").trim();
}

export function resolveInstallationAssignment(
  user:
    | InstallationAssignableUser
    | null
    | undefined
): InstallationAssignmentDecision {
  if (!user) {
    return {
      mode: "UNASSIGNED",
      party: undefined
    };
  }

  if (!user.isActive) {
    return {
      mode: "REJECTED",
      reason: "USER_INACTIVE"
    };
  }

  const userId = text(user.id);

  if (!userId) {
    return {
      mode: "REJECTED",
      reason: "USER_ID_MISSING"
    };
  }

  const name = text(user.name);

  if (!name) {
    return {
      mode: "REJECTED",
      reason: "USER_NAME_MISSING"
    };
  }

  const providerCustomerId =
    text(user.providerCustomerId);

  const isExternalInstaller =
    user.providerType === "INSTALLER";

  if (isExternalInstaller) {
    if (!providerCustomerId) {
      return {
        mode: "REJECTED",
        reason:
          "EXTERNAL_PROVIDER_ID_MISSING"
      };
    }

    return {
      mode: "EXTERNAL",
      party: {
        id: providerCustomerId,
        userId,
        name,
        phone:
          text(user.phone) || undefined,
        assignmentType: "EXTERNAL",
        providerCustomerId
      }
    };
  }

  return {
    mode: "INTERNAL",
    party: {
      id: `internal-user:${userId}`,
      userId,
      name,
      phone:
        text(user.phone) || undefined,
      assignmentType: "INTERNAL"
    }
  };
}

export function isInstallationAssignableUser(
  user: InstallationAssignableUser
): boolean {
  if (!user.isActive) {
    return false;
  }

  const normalizedRole =
    text(user.role).toUpperCase();

  /*
   * ADMIN kendi montajını yapabilir.
   * INSTALLER rolü şirket içi çalışan veya dış provider olabilir.
   * Diğer roller montaj işine otomatik atanmaz; rolü INSTALLER
   * verilmeden montaj ekranı yetkisi zaten yoktur.
   */
  return (
    normalizedRole === "ADMIN" ||
    normalizedRole === "COMPANY_ADMIN" ||
    normalizedRole === "INSTALLER" ||
    normalizedRole === "INSTALLATION"
  );
}