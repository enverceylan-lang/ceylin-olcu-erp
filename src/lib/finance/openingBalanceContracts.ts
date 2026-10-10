import type { ErpScope } from "@/lib/erpScope";

export type OpeningBalanceDirection = "RECEIVABLE" | "PAYABLE";

export interface OpeningBalanceCommand extends ErpScope {
  operationId: string;
  idempotencyKey: string;
  customerId: string;
  direction: OpeningBalanceDirection;
  amount: number;
  currency: string;
  openingDate: string;
  dueDate: string | null;
  sourceDocumentId: string;
  sourceDocumentType: "OPENING_BALANCE";
  description: string | null;
}

export type OpeningBalanceContractDecision =
  | { allowed: true; command: Omit<OpeningBalanceCommand, keyof ErpScope> }
  | { allowed: false; code: string; status: 400 | 422 };

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function isoDate(value: unknown): string | null {
  const parsed = text(value);
  return parsed && /^\d{4}-\d{2}-\d{2}$/.test(parsed) ? parsed : null;
}

export function decideOpeningBalanceServerContract(
  body: unknown,
): OpeningBalanceContractDecision {
  const root = record(body);
  const raw = record(root?.openingBalanceCommand);
  if (!raw) {
    return { allowed: false, code: "FINANCE_OPENING_BALANCE_COMMAND_REQUIRED", status: 400 };
  }

  const customerId = text(raw.customerId);
  const sourceDocumentId = text(raw.sourceDocumentId);
  const direction =
    raw.direction === "RECEIVABLE" || raw.direction === "PAYABLE"
      ? raw.direction
      : null;
  const amount = typeof raw.amount === "number" ? raw.amount : Number.NaN;
  const currency = text(raw.currency)?.toUpperCase() ?? null;
  const openingDate = isoDate(raw.openingDate);
  const dueDate = raw.dueDate === null || raw.dueDate === "" ? null : isoDate(raw.dueDate);
  const description = raw.description === null || raw.description === undefined
    ? null
    : text(raw.description);

  if (
    !customerId ||
    !sourceDocumentId ||
    !direction ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-7 ||
    !currency ||
    !/^[A-Z]{3}$/.test(currency) ||
    !openingDate ||
    (raw.dueDate !== null && raw.dueDate !== "" && !dueDate)
  ) {
    return { allowed: false, code: "FINANCE_OPENING_BALANCE_COMMAND_INVALID", status: 422 };
  }

  if (direction === "PAYABLE" && currency !== "TRY") {
    return { allowed: false, code: "FINANCE_OPENING_PAYABLE_CURRENCY_UNSUPPORTED", status: 422 };
  }

  const stableIdentity = `OPENING_BALANCE:${sourceDocumentId}`;

  return {
    allowed: true,
    command: {
      operationId: stableIdentity,
      idempotencyKey: stableIdentity,
      customerId,
      direction,
      amount,
      currency,
      openingDate,
      dueDate,
      sourceDocumentId,
      sourceDocumentType: "OPENING_BALANCE",
      description,
    },
  };
}
