import type { SaleItem } from "@/store/salesStore";

export interface SaleApprovalStockIdentityIssue {
  saleItemId: string;
  roomName: string;
  windowName: string;
  productType: string;
  productGroup: string;
}

export interface SaleApprovalStockIdentityValidation {
  allowed: boolean;
  missingItems: SaleApprovalStockIdentityIssue[];
}

function normalizeGroup(value: string | undefined): string {
  return String(value || "")
    .trim()
    .toLocaleUpperCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function saleItemRequiresStockIdentity(
  item: Pick<SaleItem, "productGroup">
): boolean {
  const group = normalizeGroup(item.productGroup);

  return !(
    group.startsWith("0003") ||
    group.includes("HIZMET")
  );
}

export function validateSaleApprovalStockIdentity(
  items: readonly SaleItem[],
): SaleApprovalStockIdentityValidation {
  const missingItems = items
    .filter(
      item =>
        saleItemRequiresStockIdentity(item) &&
        !String(item.stockItemId || "").trim(),
    )
    .map(item => ({
      saleItemId: item.id,
      roomName: item.roomName,
      windowName: item.windowName,
      productType: item.productType,
      productGroup: item.productGroup,
    }));

  return {
    allowed: missingItems.length === 0,
    missingItems,
  };
}

export function saleApprovalStockIdentityMessage(
  validation: SaleApprovalStockIdentityValidation,
): string {
  const first = validation.missingItems[0];

  if (!first) {
    return "";
  }

  const location = [first.roomName, first.windowName]
    .map(value => String(value || "").trim())
    .filter(Boolean)
    .join(" / ");

  const product =
    String(first.productType || first.productGroup || "Ürün").trim() ||
    "Ürün";

  const label = [location, product]
    .filter(Boolean)
    .join(" — ");

  return [
    "Satış onaylanamadı.",
    `${label}: stok kartı seçilmemiş.`,
    "Satılmayacak ürün varsa Satışa Hazırlık ekranından seçimini kaldırın;",
    "satılacak ürün için stok kartını seçin.",
  ].join(" ");
}
