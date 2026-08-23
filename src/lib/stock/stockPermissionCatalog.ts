export const STOCK_PERMISSION_CATALOG = [
  { permission: "stock.view", label: "Stok modülünü gör", description: "Stok ekranına erişebilir.", riskLevel: "LOW" },
  { permission: "stock.view_physical", label: "Fiziksel ürünleri gör", description: "Fiziksel stok kartlarını görebilir.", riskLevel: "LOW" },
  { permission: "stock.view_service", label: "Hizmet kartlarını gör", description: "Hizmet kartlarını görebilir.", riskLevel: "LOW" },
  { permission: "stock.view_purchase_price", label: "Alış fiyatlarını gör", description: "Tedarik / alış fiyatlarını görebilir.", riskLevel: "HIGH" },
  { permission: "stock.view_sale_price", label: "Satış fiyatlarını gör", description: "Satış fiyatlarını görebilir.", riskLevel: "MEDIUM" },
  { permission: "stock.create", label: "Stok kartı aç", description: "Yeni fiziksel ürün veya hizmet kartı oluşturabilir.", riskLevel: "HIGH" },
  { permission: "stock.edit", label: "Stok kartı düzenle", description: "Mevcut stok / hizmet kartını düzenleyebilir.", riskLevel: "HIGH" },
  { permission: "stock.excel_export", label: "Excel şablonu / dışa aktar", description: "Stok Excel şablonunu ve yetkili olduğu veriyi dışa aktarabilir.", riskLevel: "HIGH" },
  { permission: "stock.excel_import", label: "Excel'den içe aktar", description: "Doğrulama ve önizleme sonrasında toplu stok / hizmet kartı oluşturabilir.", riskLevel: "CRITICAL" },
] as const;

export type StockPermission = (typeof STOCK_PERMISSION_CATALOG)[number]["permission"];
const STOCK_PERMISSION_SET = new Set<string>(STOCK_PERMISSION_CATALOG.map(x => x.permission));

export function isStockPermission(value: unknown): value is StockPermission {
  return typeof value === "string" && STOCK_PERMISSION_SET.has(value);
}
export function isKnownStockLikePermission(value: unknown): boolean {
  return typeof value === "string" && value.startsWith("stock.") && !isStockPermission(value);
}
export function getStockRoleDefaults(role: string | null | undefined): StockPermission[] {
  const normalized = String(role ?? "").trim().toUpperCase();
  return normalized === "ADMIN" || normalized === "COMPANY_ADMIN"
    ? STOCK_PERMISSION_CATALOG.map(x => x.permission)
    : [];
}
export type StockPermissionMergeResult =
  | { ok: true; permissions: string[] }
  | { ok: false; code: "INVALID_STOCK_PERMISSIONS" | "UNKNOWN_STOCK_PERMISSION" | "PLATFORM_STOCK_DENIED" };

export function mergeSelectedStockPermissions(input: {
  existingPermissions: readonly unknown[] | null | undefined;
  selectedStockPermissions: unknown;
  targetRole: string | null | undefined;
}): StockPermissionMergeResult {
  if (!Array.isArray(input.selectedStockPermissions)) return { ok: false, code: "INVALID_STOCK_PERMISSIONS" };
  if (input.selectedStockPermissions.some(v => !isStockPermission(v))) return { ok: false, code: "UNKNOWN_STOCK_PERMISSION" };
  const selected = input.selectedStockPermissions as StockPermission[];
  if (String(input.targetRole ?? "").trim().toUpperCase() === "PLATFORM_SUPER_ADMIN" && selected.length > 0) {
    return { ok: false, code: "PLATFORM_STOCK_DENIED" };
  }
  const preserved = Array.isArray(input.existingPermissions)
    ? input.existingPermissions.filter((v): v is string => typeof v === "string" && !v.startsWith("stock."))
    : [];
  return { ok: true, permissions: [...preserved, ...selected] };
}
export function hasStockPermission(input: {
  role: string | null | undefined;
  permissions: readonly unknown[] | null | undefined;
  requested: StockPermission;
}): boolean {
  if (getStockRoleDefaults(input.role).includes(input.requested)) return true;
  if (!Array.isArray(input.permissions)) return false;
  return input.permissions.some(v => isStockPermission(v) && v === input.requested);
}