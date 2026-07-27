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
      className="mt-5 rounded-xl border border-indigo-200 bg-indigo-50/30 p-4 shadow-sm dark:border-indigo-900 dark:bg-indigo-950/20"
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {GROUP_ORDER.map((group) => {
          const entries = FINANCE_PERMISSION_CATALOG.filter(
            (entry) => entry.group === group,
          );
          if (entries.length === 0) return null;

          return (
            <fieldset
              key={group}
              className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-950/60"
            >
              <legend className="px-1 text-xs font-bold tracking-wide text-indigo-700 dark:text-indigo-300">
                {GROUP_LABELS[group]}
              </legend>
              <div className="space-y-2">
                {entries.map((entry) => (
                  <label
                    key={entry.permission}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-transparent p-2.5 transition-colors hover:border-gray-200 hover:bg-gray-50 dark:hover:border-gray-800 dark:hover:bg-gray-900"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(entry.permission)}
                      disabled={platformBlocked}
                      onChange={() => toggle(entry.permission)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:cursor-not-allowed"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold leading-tight text-gray-800 dark:text-gray-200">
                          {entry.label}
                        </span>

                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                            entry.riskLevel === "CRITICAL"
                              ? "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300"
                              : entry.riskLevel === "HIGH"
                                ? "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300"
                                : entry.riskLevel === "MEDIUM"
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                                  : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                          }`}
                        >
                          {entry.riskLevel === "CRITICAL"
                            ? "Kritik"
                            : entry.riskLevel === "HIGH"
                              ? "Yüksek"
                              : entry.riskLevel === "MEDIUM"
                                ? "Orta"
                                : "Düşük"}
                        </span>

                        {inherited.has(entry.permission) && (
                          <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[9px] font-bold text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300">
                            Rol Yetkisi
                          </span>
                        )}

                        {selected.has(entry.permission) &&
                          !inherited.has(entry.permission) && (
                            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                              Özel
                            </span>
                          )}

                        {entry.isLegacy && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                            Legacy
                          </span>
                        )}
                      </span>

                      <span className="mt-1 block whitespace-normal break-words text-[10px] leading-relaxed text-gray-500 dark:text-gray-400">
                        {entry.description}
                        {inherited.has(entry.permission)
                          ? " Rol varsayılanından gelir; checkbox yalnız kullanıcıya özel açık izni düzenler."
                          : ""}
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
