import type { FinancePermission } from "./financeAccessPolicy";

export const FINANCE_PERMISSION_ORDER = [
  "finance.view",
  "customerFinance.view",
  "finance.collection.create",
  "finance.collection.reverse",
  "finance.payment.create",
  "finance.payment.reverse",
  "finance.transfer.create",
  "finance.transfer.reverse",
  "finance.cash.collection.create",
  "finance.cash.collection.reverse",
  "finance.cash.payment.create",
  "finance.cash.payment.reverse",
  "finance.bank.collection.create",
  "finance.bank.collection.reverse",
  "finance.bank.payment.create",
  "finance.bank.payment.reverse",
  "finance.pos.collection.create",
  "finance.pos.collection.reverse",
  "finance.pos.refund.create",
  "finance.pos.refund.reverse",
  "finance.cheque.receipt.create",
  "finance.cheque.receipt.reverse",
  "finance.cheque.issue.create",
  "finance.cheque.issue.reverse",
  "finance.note.receipt.create",
  "finance.note.receipt.reverse",
  "finance.note.issue.create",
  "finance.note.issue.reverse",
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
    "finance.transfer.reverse",
    "finance.cash.collection.create",
    "finance.cash.collection.reverse",
    "finance.cash.payment.create",
    "finance.cash.payment.reverse",
    "finance.bank.collection.create",
    "finance.bank.collection.reverse",
    "finance.bank.payment.create",
    "finance.bank.payment.reverse",
    "finance.pos.collection.create",
    "finance.pos.collection.reverse",
    "finance.pos.refund.create",
    "finance.pos.refund.reverse",
    "finance.cheque.receipt.create",
    "finance.cheque.receipt.reverse",
    "finance.cheque.issue.create",
    "finance.cheque.issue.reverse",
    "finance.note.receipt.create",
    "finance.note.receipt.reverse",
    "finance.note.issue.create",
    "finance.note.issue.reverse",
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
    "finance.cash.collection.create",
    "finance.bank.collection.create",
    "finance.pos.collection.create",
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
