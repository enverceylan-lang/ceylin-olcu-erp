import type { FinancePermission } from "./financeAccessPolicy";

export type FinanceNavigationSection =
  | "Genel Bakış"
  | "Tahsilat"
  | "Ödeme"
  | "Hesaplar"
  | "Raporlar"
  | "Devir / Açılış";

export type FinanceCollectionItem =
  | "Kasa / Nakit"
  | "POS / Kart"
  | "Banka / EFT / Havale"
  | "Müşteri Çeki"
  | "Müşteri Senedi";

export type FinancePaymentItem =
  | "Kasa / Nakit"
  | "Banka / EFT / Havale"
  | "K.Kartı ile Ödeme"
  | "Çek ile Ödeme"
  | "Senet ile Ödeme";

const COLLECTION_PERMISSION_BY_ITEM: Record<
  FinanceCollectionItem,
  FinancePermission
> = {
  "Kasa / Nakit": "finance.cash.collection.create",
  "POS / Kart": "finance.pos.collection.create",
  "Banka / EFT / Havale": "finance.bank.collection.create",
  "Müşteri Çeki": "finance.cheque.receipt.create",
  "Müşteri Senedi": "finance.note.receipt.create",
};

const PAYMENT_PERMISSION_BY_ITEM: Partial<
  Record<FinancePaymentItem, FinancePermission>
> = {
  "Kasa / Nakit": "finance.cash.payment.create",
  "Banka / EFT / Havale": "finance.bank.payment.create",
  "Çek ile Ödeme": "finance.cheque.issue.create",
  "Senet ile Ödeme": "finance.note.issue.create",
};

const FINANCE_CENTER_PERMISSIONS = new Set<FinancePermission>([
  "finance.view",
  "finance.cash.collection.create",
  "finance.bank.collection.create",
  "finance.pos.collection.create",
  "finance.cheque.receipt.create",
  "finance.note.receipt.create",
  "finance.cash.payment.create",
  "finance.bank.payment.create",
  "finance.cheque.issue.create",
  "finance.note.issue.create",
  "finance.cash.view",
  "finance.bank.view",
  "finance.pos.view",
  "finance.cheque.view",
  "finance.note.view",
  "finance.report.view",
  "finance.reconciliation.view",
  "finance.account.manage",
  "finance.opening_balance.create",
]);

function has(
  permissions: readonly FinancePermission[],
  permission: FinancePermission,
): boolean {
  return permissions.includes(permission);
}

export function canOpenFinanceCenter(
  permissions: readonly FinancePermission[],
): boolean {
  return permissions.some((permission) =>
    FINANCE_CENTER_PERMISSIONS.has(permission),
  );
}

export function canViewFinanceOverview(
  permissions: readonly FinancePermission[],
): boolean {
  return has(permissions, "finance.view");
}

export function visibleFinanceCollectionItems(
  permissions: readonly FinancePermission[],
): FinanceCollectionItem[] {
  return (Object.keys(COLLECTION_PERMISSION_BY_ITEM) as FinanceCollectionItem[])
    .filter((item) => has(permissions, COLLECTION_PERMISSION_BY_ITEM[item]));
}

export function canCreateFinanceCollectionItem(
  permissions: readonly FinancePermission[],
  item: string,
): item is FinanceCollectionItem {
  if (!(item in COLLECTION_PERMISSION_BY_ITEM)) return false;

  const typedItem = item as FinanceCollectionItem;
  return has(permissions, COLLECTION_PERMISSION_BY_ITEM[typedItem]);
}

export function visibleFinancePaymentItems(
  permissions: readonly FinancePermission[],
): FinancePaymentItem[] {
  const items: FinancePaymentItem[] = [
    "Kasa / Nakit",
    "Banka / EFT / Havale",
    "K.Kartı ile Ödeme",
    "Çek ile Ödeme",
    "Senet ile Ödeme",
  ];

  return items.filter((item) => {
    if (item === "K.Kartı ile Ödeme") {
      // Dedicated company-card payment authority does not exist yet.
      // Do not infer authority from POS/refund or legacy generic payment.
      return false;
    }

    const permission = PAYMENT_PERMISSION_BY_ITEM[item];
    return permission ? has(permissions, permission) : false;
  });
}

export function visibleFinanceSections(
  permissions: readonly FinancePermission[],
): FinanceNavigationSection[] {
  const sections: FinanceNavigationSection[] = [];

  if (canViewFinanceOverview(permissions)) {
    sections.push("Genel Bakış");
  }

  if (visibleFinanceCollectionItems(permissions).length > 0) {
    sections.push("Tahsilat");
  }

  if (visibleFinancePaymentItems(permissions).length > 0) {
    sections.push("Ödeme");
  }

  if (
    has(permissions, "finance.cash.view") ||
    has(permissions, "finance.bank.view") ||
    has(permissions, "finance.pos.view") ||
    has(permissions, "finance.cheque.view") ||
    has(permissions, "finance.note.view") ||
    has(permissions, "finance.account.manage")
  ) {
    sections.push("Hesaplar");
  }

  if (
    has(permissions, "finance.report.view") ||
    has(permissions, "finance.reconciliation.view")
  ) {
    sections.push("Raporlar");
  }

  if (has(permissions, "finance.opening_balance.create")) {
    sections.push("Devir / Açılış");
  }

  return sections;
}

export function defaultFinanceSection(
  permissions: readonly FinancePermission[],
): FinanceNavigationSection | null {
  return visibleFinanceSections(permissions)[0] ?? null;
}