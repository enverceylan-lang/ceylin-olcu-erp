import type {
  SaleStatus
} from "@/store/salesStore";

const OPERATIONAL_STATUSES:
  readonly SaleStatus[] = [
    "ONAYLANDI",
    "SİPARİŞ",
    "ÜRETİME_GÖNDERİLDİ",
    "MONTAJA_GÖNDERİLDİ",
    "TAMAMLANDI"
  ];

export function shouldSyncMainOperationForSaleStatus(
  status: SaleStatus
): boolean {
  return OPERATIONAL_STATUSES.includes(status);
}