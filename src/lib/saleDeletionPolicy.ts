import type {
  SaleStatus
} from "@/store/salesStore";

export const APPROVED_SALE_DELETE_ERROR =
  "APPROVED_SALE_CANNOT_BE_DELETED_RETURN_REQUIRED";

const NON_DELETABLE_STATUSES:
  readonly SaleStatus[] = [
    "ONAYLANDI",
    "SİPARİŞ",
    "ÜRETİME_GÖNDERİLDİ",
    "MONTAJA_GÖNDERİLDİ",
    "TAMAMLANDI"
  ];

export function canDeleteSale(
  status: SaleStatus
): boolean {
  return !NON_DELETABLE_STATUSES.includes(
    status
  );
}

export function assertSaleCanBeDeleted(
  status: SaleStatus
): void {
  if (canDeleteSale(status)) {
    return;
  }

  throw new Error(
    APPROVED_SALE_DELETE_ERROR
  );
}