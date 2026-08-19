import type { Product } from "@/store/useStore";
import type { SaleItem } from "@/store/salesStore";

function normalizeToken(value: unknown): string {
  return String(value || "")
    .trim()
    .toLocaleUpperCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/İ/g, "I")
    .replace(/[^A-Z0-9]+/g, "");
}

const TYPE_ALIASES: Record<string, string> = {
  TUL: "TUL",
  TULPERDE: "TUL",
  GUNESLIK: "GUNESLIK",
  GUNESLIKPERDE: "GUNESLIK",
  FON: "FON",
  FONPERDE: "FON",
  RUSTIK: "RUSTIK",
  RUSTIKPERDE: "RUSTIK",
  TAVANRUSTIK: "TAVAN_RUSTIK",
  STOR: "STOR",
  STORPERDE: "STOR",
  ZEBRA: "ZEBRA",
  ZEBRASTOR: "ZEBRA",
  ZEBRAPERDE: "ZEBRA",
  DIKEYSTOR: "DIKEY_STOR",
  DIKEYTUL: "DIKEY_TUL",
  AHSAPJALUZI: "AHSAP_JALUZI",
  JALUZI: "JALUZI",
  METALJALUZI: "JALUZI",
  PICASSO: "PICASSO",
  PLICELL: "PLICELL",
  BIRIZ: "BIRIZ",
};

function canonicalProductType(value: unknown): string | null {
  return TYPE_ALIASES[normalizeToken(value)] || null;
}

export function isStockAllowedForMeasuredSaleItem(
  product: Product,
  item: Pick<SaleItem, "measurementId" | "productType">,
): boolean {
  if (!String(item.measurementId || "").trim()) return false;
  if (product.productKind === "SERVICE") return false;

  const required = canonicalProductType(item.productType);
  const stockType = canonicalProductType(product.category);

  if (!required || !stockType) return false;
  return required === stockType;
}

export function isExternalSaleStockAllowed(
  product: Product,
): boolean {
  if (product.productKind === "SERVICE") return false;
  return normalizeToken(product.unit) === "ADET";
}