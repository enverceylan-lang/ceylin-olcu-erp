export const MEDIA_FINALIZED_EDIT_PERMISSION =
  "media.finalized.edit";

export interface MediaLifecycleUser {
  role?: string | null;
  permissions?: readonly string[] | null;
}

function normalizeMediaRole(
  role: string | null | undefined,
): string {
  const normalized = String(role || "")
    .trim()
    .toUpperCase();

  if (normalized === "MEASUREMENT") return "FIELD";
  if (normalized === "INSTALLATION") return "INSTALLER";

  return normalized;
}

export function canEditFinalizedMedia(
  user: MediaLifecycleUser,
): boolean {
  const role = normalizeMediaRole(user.role);

  if (role === "ADMIN") return true;

  return Boolean(
    user.permissions?.includes(
      MEDIA_FINALIZED_EDIT_PERMISSION,
    ),
  );
}

export function canCreateMeasurementMedia(
  user: MediaLifecycleUser,
): boolean {
  const role = normalizeMediaRole(user.role);

  return (
    role === "ADMIN" ||
    role === "MODERATOR" ||
    role === "OFFICE" ||
    role === "SALES" ||
    role === "FIELD"
  );
}

export function canCreateInstallationMedia(
  user: MediaLifecycleUser,
): boolean {
  const role = normalizeMediaRole(user.role);

  return (
    role === "ADMIN" ||
    role === "MODERATOR" ||
    role === "INSTALLER"
  );
}

export function canAccessAdminManagedMedia(
  user: MediaLifecycleUser,
): boolean {
  const role = normalizeMediaRole(user.role);

  return (
    role === "ADMIN" ||
    role === "MODERATOR" ||
    role === "OFFICE"
  );
}

export function canMutateMeasurementMedia(
  user: MediaLifecycleUser,
  finalized: boolean,
): boolean {
  if (finalized) {
    return canEditFinalizedMedia(user);
  }

  return canCreateMeasurementMedia(user);
}