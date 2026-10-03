export const MEASUREMENT_SYNCED_MUTATE_PERMISSION =
  "measurement.synced.mutate" as const;

export type MeasurementPermission =
  typeof MEASUREMENT_SYNCED_MUTATE_PERMISSION;

export const MEASUREMENT_PERMISSION_CATALOG = [
  {
    permission: MEASUREMENT_SYNCED_MUTATE_PERMISSION,
    label: "Senkronlanmış ölçüleri düzenle / sil",
    description:
      "Sunucuya senkronlanmış ölçü kayıtlarını düzenleme ve soft-delete yetkisi verir.",
  },
] as const;

export function isMeasurementPermission(
  value: unknown,
): value is MeasurementPermission {
  return value === MEASUREMENT_SYNCED_MUTATE_PERMISSION;
}

export function mergeSelectedMeasurementPermissions(args: {
  existingPermissions: unknown;
  selectedMeasurementPermissions: unknown;
}): { ok: true; permissions: string[] } | {
  ok: false;
  code: "INVALID_MEASUREMENT_PERMISSION";
} {
  const existing = Array.isArray(args.existingPermissions)
    ? args.existingPermissions.map(String)
    : [];
  const selected = Array.isArray(args.selectedMeasurementPermissions)
    ? args.selectedMeasurementPermissions.map(String)
    : [];

  if (selected.some(permission => !isMeasurementPermission(permission))) {
    return {
      ok: false,
      code: "INVALID_MEASUREMENT_PERMISSION",
    };
  }

  const retained = existing.filter(
    permission => !isMeasurementPermission(permission),
  );

  return {
    ok: true,
    permissions: Array.from(new Set([...retained, ...selected])),
  };
}

export function canMutateSyncedMeasurement(user: {
  role?: string | null;
  permissions?: readonly string[] | null;
} | null | undefined): boolean {
  if (!user) return false;

  if (String(user.role || "").trim().toUpperCase() === "ADMIN") {
    return true;
  }

  return (user.permissions || []).includes(
    MEASUREMENT_SYNCED_MUTATE_PERMISSION,
  );
}

export function isMeasurementServerSynced(
  measurement: { version?: number | null } | null | undefined,
): boolean {
  return Number(measurement?.version || 0) >= 1;
}
