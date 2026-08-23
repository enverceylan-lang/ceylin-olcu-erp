"use client";
import { STOCK_PERMISSION_CATALOG, getStockRoleDefaults, type StockPermission } from "@/lib/stock/stockPermissionCatalog";

export default function StockPermissionEditor({
  role, selectedPermissions, onChange, isSelf = false,
}: {
  role: string;
  selectedPermissions: readonly StockPermission[];
  onChange: (permissions: StockPermission[]) => void;
  isSelf?: boolean;
}) {
  const selected = new Set(selectedPermissions);
  const inherited = new Set(getStockRoleDefaults(role));
  const blocked = role === "PLATFORM_SUPER_ADMIN";
  const toggle = (permission: StockPermission) => {
    if (blocked) return;
    const next = new Set(selected);
    next.has(permission) ? next.delete(permission) : next.add(permission);
    onChange(STOCK_PERMISSION_CATALOG.map(x => x.permission).filter(x => next.has(x)));
  };
  return (
    <section aria-labelledby="stock-permissions-title" className="mt-5 rounded-xl border border-sky-200 bg-sky-50/30 p-4 shadow-sm dark:border-sky-900 dark:bg-sky-950/20">
      <h3 id="stock-permissions-title" className="font-bold text-gray-900 dark:text-white">Stok Yetkileri</h3>
      <p className="mt-1 text-[11px] text-gray-600 dark:text-gray-400">Görme, fiyat, kart ve Excel yetkileri ayrı yönetilir.</p>
      {isSelf && <p className="mt-2 text-[11px] font-semibold text-amber-700">Kendi stok yetkilerinizi düzenliyorsunuz.</p>}
      {blocked && <p className="mt-2 text-[11px] font-semibold text-red-700">Platform yöneticisine şirket içi stok operasyon yetkisi verilemez.</p>}
      <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
        {STOCK_PERMISSION_CATALOG.map(entry => (
          <label key={entry.permission} className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950/60">
            <input type="checkbox" checked={selected.has(entry.permission)} disabled={blocked} onChange={() => toggle(entry.permission)} className="mt-0.5 h-4 w-4 rounded" />
            <span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">{entry.label}</span>
              {inherited.has(entry.permission) && <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold text-sky-800">Rol Yetkisi</span>}
              <span className="mt-1 block text-[10px] text-gray-500">{entry.description}</span>
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}