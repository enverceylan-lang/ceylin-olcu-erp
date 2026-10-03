"use client";

import {
  MEASUREMENT_PERMISSION_CATALOG,
  type MeasurementPermission,
} from "@/lib/measurement/measurementPermissionCatalog";

export default function MeasurementPermissionEditor({
  selectedPermissions,
  onChange,
  isSelf = false,
}: {
  selectedPermissions: readonly MeasurementPermission[];
  onChange: (permissions: MeasurementPermission[]) => void;
  isSelf?: boolean;
}) {
  const selected = new Set(selectedPermissions);

  const toggle = (permission: MeasurementPermission) => {
    const next = new Set(selected);
    if (next.has(permission)) {
      next.delete(permission);
    } else {
      next.add(permission);
    }

    onChange(
      MEASUREMENT_PERMISSION_CATALOG
        .map(entry => entry.permission)
        .filter(permission => next.has(permission)),
    );
  };

  return (
    <section
      aria-labelledby="measurement-permissions-title"
      className="mt-5 rounded-xl border border-violet-200 bg-violet-50/30 p-4 shadow-sm dark:border-violet-900 dark:bg-violet-950/20"
    >
      <h3
        id="measurement-permissions-title"
        className="font-bold text-gray-900 dark:text-white"
      >
        Ölçü Yetkileri
      </h3>
      <p className="mt-1 text-[11px] text-gray-600 dark:text-gray-400">
        Senkronlanmış ölçüler varsayılan olarak salt okunurdur. Bu açık yetki,
        yönetici olmayan kullanıcıya senkronlanmış ölçüyü düzenleme veya
        soft-delete etme hakkı verir.
      </p>

      {isSelf && (
        <p className="mt-2 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
          Kendi ölçü yetkinizi düzenliyorsunuz.
        </p>
      )}

      <div className="mt-4 space-y-2">
        {MEASUREMENT_PERMISSION_CATALOG.map(entry => (
          <label
            key={entry.permission}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950/60"
          >
            <input
              type="checkbox"
              checked={selected.has(entry.permission)}
              onChange={() => toggle(entry.permission)}
              className="mt-0.5 h-4 w-4 rounded"
            />
            <span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {entry.label}
              </span>
              <span className="mt-1 block text-[10px] text-gray-500">
                {entry.description}
              </span>
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}
