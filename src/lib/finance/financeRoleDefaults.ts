import type { FinancePermission } from "./financeAccessPolicy";

export const FINANCE_PERMISSION_ORDER = [
  "finance.view",
  "customerFinance.view",
  "finance.collection.create",
  "finance.collection.reverse",
  "finance.payment.create",
  "finance.payment.reverse",
  "finance.transfer.create",
  "finance.cash.view",
  "finance.bank.view",
  "finance.pos.view",
  "finance.cheque.view",
  "finance.note.view",
  "finance.report.view",
  "finance.reconciliation.view",
  "finance.account.manage",
] as const satisfies readonly FinancePermission[];

export type FinanceRole =
  | "ADMIN"
  | "ACCOUNTING"
  | "OFFICE"
  | "SALES"
  | "MODERATOR"
  | "FIELD"
  | "TAILOR"
  | "INSTALLER"
  | "PLATFORM_SUPER_ADMIN"
  | "COMPANY_ADMIN";

const ALL_FINANCE_PERMISSIONS = [...FINANCE_PERMISSION_ORDER];

export const FINANCE_ROLE_DEFAULTS: Readonly<
  Record<FinanceRole, readonly FinancePermission[]>
> = {
  ADMIN: ALL_FINANCE_PERMISSIONS,
  ACCOUNTING: [
    "finance.view",
    "customerFinance.view",
    "finance.collection.create",
    "finance.collection.reverse",
    "finance.payment.create",
    "finance.payment.reverse",
    "finance.transfer.create",
    "finance.cash.view",
    "finance.bank.view",
    "finance.pos.view",
    "finance.cheque.view",
    "finance.note.view",
    "finance.report.view",
    "finance.reconciliation.view",
  ],
  OFFICE: [
    "finance.view",
    "customerFinance.view",
    "finance.collection.create",
    "finance.cash.view",
    "finance.bank.view",
    "finance.pos.view",
    "finance.report.view",
  ],
  SALES: ["customerFinance.view"],
  MODERATOR: [],
  FIELD: [],
  TAILOR: [],
  INSTALLER: [],
  PLATFORM_SUPER_ADMIN: [],
  COMPANY_ADMIN: ALL_FINANCE_PERMISSIONS,
};

export function isFinancePermission(
  value: unknown,
): value is FinancePermission {
  return (
    typeof value === "string" &&
    (FINANCE_PERMISSION_ORDER as readonly string[]).includes(value)
  );
}

export function getFinanceRoleDefaults(
  role: string | null | undefined,
): readonly FinancePermission[] {
  if (!role || !(role in FINANCE_ROLE_DEFAULTS)) {
    return [];
  }
  return [...FINANCE_ROLE_DEFAULTS[role as FinanceRole]];
}
