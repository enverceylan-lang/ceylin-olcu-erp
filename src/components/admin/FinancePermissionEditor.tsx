"use client";

import {
  FINANCE_PERMISSION_CATALOG,
  type FinancePermissionGroup,
} from "@/lib/finance/financePermissionCatalog";
import type { FinancePermission } from "@/lib/finance/financeAccessPolicy";
import { getFinanceRoleDefaults } from "@/lib/finance/financeRoleDefaults";

const GROUP_LABELS: Record<FinancePermissionGroup, string> = {
  GENERAL: "Genel görünüm",
  CASH: "Nakit",
  BANK: "Banka / EFT",
  POS: "POS",
  CHEQUE: "Çek",
  NOTE: "Senet",
  TRANSFER: "Transfer",
  REPORT_MANAGEMENT: "Rapor ve yönetim",
  LEGACY: "Legacy uyumluluk",
};

const GROUP_ORDER = Object.keys(GROUP_LABELS) as FinancePermissionGroup[];

export interface FinancePermissionEditorProps {
  role: string;
  selectedPermissions: readonly FinancePermission[];
  onChange: (permissions: FinancePermission[]) => void;
  isSelf?: boolean;
}

export default function FinancePermissionEditor({
  role,
  selectedPermissions,
  onChange,
  isSelf = false,
}: FinancePermissionEditorProps) {
  const selected = new Set(selectedPermissions);
  const inherited = new Set(getFinanceRoleDefaults(role));
  const platformBlocked = role === "PLATFORM_SUPER_ADMIN";

  const toggle = (permission: FinancePermission) => {
    if (platformBlocked) return;
    const next = new Set(selected);
    if (next.has(permission)) {
      next.delete(permission);
    } else {
      next.add(permission);
    }
    onChange(
      FINANCE_PERMISSION_CATALOG
        .map((entry) => entry.permission)
        .filter((entry) => next.has(entry)),
    );
  };

  return (
    <section
      aria-labelledby="finance-permissions-title"
      className="mt-5 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 dark:border-indigo-900 dark:bg-indigo-950/20"
    >
      <div className="mb-4">
        <h3
          id="finance-permissions-title"
          className="font-bold text-gray-900 dark:text-white"
        >
          Finans Yetkileri
        </h3>
        <p className="mt-1 text-[11px] text-gray-600 dark:text-gray-400">
          Seçimler kullanıcıya özel açık izinlerdir. Rol varsayılanları bilgi
          amaçlı gösterilir ve bu listeye otomatik yazılmaz.
        </p>
        {isSelf && (
          <p className="mt-2 rounded-lg bg-amber-100 px-3 py-2 text-[11px] font-semibold text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            Kendi finans yetkilerinizi değiştiriyorsunuz. Kaydetme sonrası mevcut
            oturumunuz geçersiz olabilir.
          </p>
        )}
        {platformBlocked && (
          <p className="mt-2 rounded-lg bg-red-100 px-3 py-2 text-[11px] font-semibold text-red-800 dark:bg-red-950/40 dark:text-red-200">
            Platform yöneticisine şirket içi operasyonel finans yetkisi verilemez.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {GROUP_ORDER.map((group) => {
          const entries = FINANCE_PERMISSION_CATALOG.filter(
            (entry) => entry.group === group,
          );
          if (entries.length === 0) return null;

          return (
            <fieldset
              key={group}
              className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950/60"
            >
              <legend className="px-1 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                {GROUP_LABELS[group]}
              </legend>
              <div className="space-y-2">
                {entries.map((entry) => (
                  <label
                    key={entry.permission}
                    className="flex items-start gap-2 rounded-md p-1.5 hover:bg-gray-50 dark:hover:bg-gray-900"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(entry.permission)}
                      disabled={platformBlocked}
                      onChange={() => toggle(entry.permission)}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block font-semibold text-gray-800 dark:text-gray-200">
                        {entry.label}
                      </span>
                      <span className="block text-[10px] text-gray-500">
                        {entry.description}
                        {inherited.has(entry.permission)
                          ? " • Rol varsayılanında mevcut"
                          : ""}
                        {entry.isLegacy ? " • Legacy" : ""}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          );
        })}
      </div>
    </section>
  );
}
