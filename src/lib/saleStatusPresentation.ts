export type SalePresentationStatus =
  | "OFFER"
  | "APPROVED"
  | "IN_OPERATION"
  | "COMPLETED"
  | "CANCELLED";

export interface SaleStatusPresentation {
  normalizedStatus: SalePresentationStatus;
  label: string;
  rowBorderClass: string;
  badgeClass: string;
  stripColorClass: string;
}

export function getSaleStatusPresentation(
  rawStatus: string | null | undefined
): SaleStatusPresentation {
  const status = String(rawStatus ?? "")
    .trim()
    .toLocaleUpperCase("tr-TR");

  if (status === "COMPLETED" || status === "TAMAMLANDI") {
    return {
      normalizedStatus: "COMPLETED",
      label: "Tamamlandı",
      rowBorderClass: "border-l-4 border-l-emerald-500",
      badgeClass:
        "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 " +
        "dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800",
      stripColorClass: "bg-emerald-500 dark:bg-emerald-400"
    };
  }

  if (
    status === "CANCELLED" ||
    status === "İPTAL" ||
    status === "IPTAL" ||
    status === "İPTAL_EDİLDİ" ||
    status === "IPTAL_EDILDI"
  ) {
    return {
      normalizedStatus: "CANCELLED",
      label: "İptal",
      rowBorderClass: "border-l-4 border-l-red-500",
      badgeClass:
        "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200 " +
        "dark:bg-red-950/40 dark:text-red-300 dark:ring-red-800",
      stripColorClass: "bg-red-500 dark:bg-red-400"
    };
  }

  if (
    status === "IN_OPERATION" ||
    status === "OPERASYONDA" ||
    status === "ÜRETİME_GÖNDERİLDİ" ||
    status === "URETIME_GONDERILDI" ||
    status === "MONTAJA_GÖNDERİLDİ" ||
    status === "MONTAJA_GONDERILDI"
  ) {
    return {
      normalizedStatus: "IN_OPERATION",
      label: "Operasyonda",
      rowBorderClass: "border-l-4 border-l-amber-500",
      badgeClass:
        "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 " +
        "dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800",
      stripColorClass: "bg-amber-500 dark:bg-amber-400"
    };
  }

  if (status === "APPROVED" || status === "ONAYLANDI") {
    return {
      normalizedStatus: "APPROVED",
      label: "Onaylandı",
      rowBorderClass: "border-l-4 border-l-blue-500",
      badgeClass:
        "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200 " +
        "dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-800",
      stripColorClass: "bg-blue-500 dark:bg-blue-400"
    };
  }

  return {
    normalizedStatus: "OFFER",
    label: "Teklif",
    rowBorderClass:
      "border-l-4 border-l-gray-400 dark:border-l-gray-500",
    badgeClass:
      "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200 " +
      "dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
    stripColorClass: "bg-slate-400 dark:bg-slate-500"
  };
}