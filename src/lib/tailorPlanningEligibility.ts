import type {
  SaleStatus
} from "@/store/salesStore";

const TAILOR_PLANNING_STATUSES =
  new Set<SaleStatus>([
    "ONAYLANDI",
    "SİPARİŞ",
    "ÜRETİME_GÖNDERİLDİ"
  ]);

export function shouldPublishTailorPlanning(
  status: SaleStatus
): boolean {
  return TAILOR_PLANNING_STATUSES.has(
    status
  );
}