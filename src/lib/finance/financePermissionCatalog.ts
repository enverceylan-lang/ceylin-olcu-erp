import type { FinancePermission } from "./financeAccessPolicy";
import {
  FINANCE_PERMISSION_ORDER,
  isFinancePermission,
} from "./financeRoleDefaults";
import type {
  FinanceChannel,
  FinanceChannelOperation,
  FinanceOperationDirection,
} from "./financeChannelPermissions";

export type FinancePermissionGroup =
  | "GENERAL"
  | "CASH"
  | "BANK"
  | "POS"
  | "CHEQUE"
  | "NOTE"
  | "TRANSFER"
  | "REPORT_MANAGEMENT"
  | "LEGACY";

export type FinancePermissionRiskLevel =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export interface FinancePermissionCatalogEntry {
  permission: FinancePermission;
  group: FinancePermissionGroup;
  label: string;
  description: string;
  channel: FinanceChannel | null;
  operation: FinanceChannelOperation | "VIEW" | "MANAGE" | null;
  direction: FinanceOperationDirection | null;
  riskLevel: FinancePermissionRiskLevel;
  isLegacy: boolean;
}

type CatalogMetadata = Omit<
  FinancePermissionCatalogEntry,
  "permission"
>;

const metadata: Record<FinancePermission, CatalogMetadata> = {
  "finance.view": m("GENERAL", "Finans ekranını görebilir", "Temel finans görünümüne erişir.", null, "VIEW", null, "LOW"),
  "customerFinance.view": m("GENERAL", "Cari finansı görebilir", "Müşteri cari finans özetini görebilir.", null, "VIEW", null, "LOW"),
  "finance.collection.create": legacy("Genel tahsilat oluşturabilir"),
  "finance.collection.reverse": legacy("Genel tahsilatı ters kayıt yapabilir"),
  "finance.payment.create": legacy("Genel ödeme oluşturabilir"),
  "finance.payment.reverse": legacy("Genel ödemeyi ters kayıt yapabilir"),
  "finance.transfer.create": m("TRANSFER", "Hesaplar arası transfer yapabilir", "Kapsam içindeki hesaplar arasında transfer oluşturur.", "TRANSFER", "TRANSFER", "CREATE", "HIGH"),
  "finance.transfer.reverse": m("TRANSFER", "Transferi ters kayıt yapabilir", "Mevcut transfer için ters kayıt oluşturur.", "TRANSFER", "TRANSFER", "REVERSE", "CRITICAL"),
  "finance.cash.collection.create": m("CASH", "Nakit tahsilat alabilir", "Kasaya nakit tahsilat kaydedebilir.", "CASH", "COLLECTION", "CREATE", "MEDIUM"),
  "finance.cash.collection.reverse": m("CASH", "Nakit tahsilatı ters kayıt yapabilir", "Nakit tahsilat için ters kayıt oluşturabilir.", "CASH", "COLLECTION", "REVERSE", "HIGH"),
  "finance.cash.payment.create": m("CASH", "Kasadan ödeme yapabilir", "Kasadan para çıkışı kaydedebilir.", "CASH", "PAYMENT", "CREATE", "HIGH"),
  "finance.cash.payment.reverse": m("CASH", "Kasa ödemesini ters kayıt yapabilir", "Kasa ödemesi için ters kayıt oluşturabilir.", "CASH", "PAYMENT", "REVERSE", "CRITICAL"),
  "finance.bank.collection.create": m("BANK", "Gelen EFT kaydedebilir", "Banka hesabına gelen tahsilatı kaydedebilir.", "BANK", "COLLECTION", "CREATE", "MEDIUM"),
  "finance.bank.collection.reverse": m("BANK", "Gelen EFT'yi ters kayıt yapabilir", "Banka tahsilatı için ters kayıt oluşturabilir.", "BANK", "COLLECTION", "REVERSE", "HIGH"),
  "finance.bank.payment.create": m("BANK", "Giden EFT yapabilir", "Banka hesabından ödeme kaydedebilir.", "BANK", "PAYMENT", "CREATE", "HIGH"),
  "finance.bank.payment.reverse": m("BANK", "Giden EFT'yi ters kayıt yapabilir", "Banka ödemesi için ters kayıt oluşturabilir.", "BANK", "PAYMENT", "REVERSE", "CRITICAL"),
  "finance.pos.collection.create": m("POS", "POS tahsilatı kaydedebilir", "POS üzerinden gelen tahsilatı kaydedebilir.", "POS", "COLLECTION", "CREATE", "MEDIUM"),
  "finance.pos.collection.reverse": m("POS", "POS tahsilatını ters kayıt yapabilir", "POS tahsilatı için ters kayıt oluşturabilir.", "POS", "COLLECTION", "REVERSE", "HIGH"),
  "finance.pos.refund.create": m("POS", "POS iadesi yapabilir", "POS üzerinden müşteriye iade kaydedebilir.", "POS", "REFUND", "CREATE", "HIGH"),
  "finance.pos.refund.reverse": m("POS", "POS iadesini ters kayıt yapabilir", "POS iadesi için ters kayıt oluşturabilir.", "POS", "REFUND", "REVERSE", "CRITICAL"),
  "finance.cheque.receipt.create": m("CHEQUE", "Gelen çeki kaydedebilir", "Teslim alınan çeki kaydedebilir.", "CHEQUE", "RECEIPT", "CREATE", "MEDIUM"),
  "finance.cheque.receipt.reverse": m("CHEQUE", "Gelen çeki ters kayıt yapabilir", "Çek teslim alımını ters kayıt yapabilir.", "CHEQUE", "RECEIPT", "REVERSE", "HIGH"),
  "finance.cheque.issue.create": m("CHEQUE", "Çek çıkışı yapabilir", "Verilen çeki kaydedebilir.", "CHEQUE", "ISSUE", "CREATE", "HIGH"),
  "finance.cheque.issue.reverse": m("CHEQUE", "Çek çıkışını ters kayıt yapabilir", "Çek çıkışını ters kayıt yapabilir.", "CHEQUE", "ISSUE", "REVERSE", "CRITICAL"),
  "finance.note.receipt.create": m("NOTE", "Gelen senedi kaydedebilir", "Teslim alınan senedi kaydedebilir.", "NOTE", "RECEIPT", "CREATE", "MEDIUM"),
  "finance.note.receipt.reverse": m("NOTE", "Gelen senedi ters kayıt yapabilir", "Senet teslim alımını ters kayıt yapabilir.", "NOTE", "RECEIPT", "REVERSE", "HIGH"),
  "finance.note.issue.create": m("NOTE", "Senet çıkışı yapabilir", "Verilen senedi kaydedebilir.", "NOTE", "ISSUE", "CREATE", "HIGH"),
  "finance.note.issue.reverse": m("NOTE", "Senet çıkışını ters kayıt yapabilir", "Senet çıkışını ters kayıt yapabilir.", "NOTE", "ISSUE", "REVERSE", "CRITICAL"),
  "finance.cash.view": m("CASH", "Kasayı görebilir", "Kasa hesaplarını ve hareketlerini görüntüler.", "CASH", "VIEW", null, "LOW"),
  "finance.bank.view": m("BANK", "Banka hesaplarını görebilir", "Banka hesaplarını ve hareketlerini görüntüler.", "BANK", "VIEW", null, "LOW"),
  "finance.pos.view": m("POS", "POS hesaplarını görebilir", "POS hesaplarını ve hareketlerini görüntüler.", "POS", "VIEW", null, "LOW"),
  "finance.cheque.view": m("CHEQUE", "Çekleri görebilir", "Çek kayıtlarını görüntüler.", "CHEQUE", "VIEW", null, "LOW"),
  "finance.note.view": m("NOTE", "Senetleri görebilir", "Senet kayıtlarını görüntüler.", "NOTE", "VIEW", null, "LOW"),
  "finance.report.view": m("REPORT_MANAGEMENT", "Finans raporlarını görebilir", "Finans raporlarını görüntüler.", null, "VIEW", null, "LOW"),
  "finance.reconciliation.view": m("REPORT_MANAGEMENT", "Mutabakatı görebilir", "Finans mutabakat ekranlarını görüntüler.", null, "VIEW", null, "MEDIUM"),
  "finance.account.manage": m("REPORT_MANAGEMENT", "Finans hesaplarını yönetebilir", "Kasa, banka ve diğer finans hesaplarını yönetebilir.", null, "MANAGE", null, "CRITICAL"),
};

function m(
  group: FinancePermissionGroup,
  label: string,
  description: string,
  channel: FinanceChannel | null,
  operation: CatalogMetadata["operation"],
  direction: FinanceOperationDirection | null,
  riskLevel: FinancePermissionRiskLevel,
): CatalogMetadata {
  return {
    group,
    label,
    description,
    channel,
    operation,
    direction,
    riskLevel,
    isLegacy: false,
  };
}

function legacy(label: string): CatalogMetadata {
  return {
    group: "LEGACY",
    label,
    description: "Yalnız eski akışlarla uyumluluk için korunur; kanal yetkisi üretmez.",
    channel: null,
    operation: null,
    direction: null,
    riskLevel: "HIGH",
    isLegacy: true,
  };
}

export const FINANCE_PERMISSION_CATALOG: readonly FinancePermissionCatalogEntry[] =
  FINANCE_PERMISSION_ORDER.map((permission) => ({
    permission,
    ...metadata[permission],
  }));

export function isKnownFinanceLikePermission(value: unknown): boolean {
  return (
    typeof value === "string" &&
    value.startsWith("finance.") &&
    !isFinancePermission(value)
  );
}
