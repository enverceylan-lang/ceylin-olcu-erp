import type {
  FinanceCapability,
  FinancePermission,
} from "./financeAccessPolicy";

export type FinanceChannel =
  | "CASH"
  | "BANK"
  | "POS"
  | "CHEQUE"
  | "NOTE"
  | "TRANSFER";

export type FinanceChannelOperation =
  | "COLLECTION"
  | "PAYMENT"
  | "REFUND"
  | "RECEIPT"
  | "ISSUE"
  | "TRANSFER";

export type FinanceOperationDirection = "CREATE" | "REVERSE";

export interface FinanceChannelPermissionRequest {
  channel: FinanceChannel;
  operation: FinanceChannelOperation;
  direction: FinanceOperationDirection;
}

export interface FinanceChannelPermissionMapping {
  permission: FinancePermission;
  capability: FinanceCapability;
}

const CHANNEL_PERMISSION_MAPPINGS = {
  "CASH:COLLECTION:CREATE": {
    permission: "finance.cash.collection.create",
    capability: "CASH_COLLECTION_CREATE",
  },
  "CASH:COLLECTION:REVERSE": {
    permission: "finance.cash.collection.reverse",
    capability: "CASH_COLLECTION_REVERSE",
  },
  "CASH:PAYMENT:CREATE": {
    permission: "finance.cash.payment.create",
    capability: "CASH_PAYMENT_CREATE",
  },
  "CASH:PAYMENT:REVERSE": {
    permission: "finance.cash.payment.reverse",
    capability: "CASH_PAYMENT_REVERSE",
  },
  "BANK:COLLECTION:CREATE": {
    permission: "finance.bank.collection.create",
    capability: "BANK_COLLECTION_CREATE",
  },
  "BANK:COLLECTION:REVERSE": {
    permission: "finance.bank.collection.reverse",
    capability: "BANK_COLLECTION_REVERSE",
  },
  "BANK:PAYMENT:CREATE": {
    permission: "finance.bank.payment.create",
    capability: "BANK_PAYMENT_CREATE",
  },
  "BANK:PAYMENT:REVERSE": {
    permission: "finance.bank.payment.reverse",
    capability: "BANK_PAYMENT_REVERSE",
  },
  "POS:COLLECTION:CREATE": {
    permission: "finance.pos.collection.create",
    capability: "POS_COLLECTION_CREATE",
  },
  "POS:COLLECTION:REVERSE": {
    permission: "finance.pos.collection.reverse",
    capability: "POS_COLLECTION_REVERSE",
  },
  "POS:REFUND:CREATE": {
    permission: "finance.pos.refund.create",
    capability: "POS_REFUND_CREATE",
  },
  "POS:REFUND:REVERSE": {
    permission: "finance.pos.refund.reverse",
    capability: "POS_REFUND_REVERSE",
  },
  "CHEQUE:RECEIPT:CREATE": {
    permission: "finance.cheque.receipt.create",
    capability: "CHEQUE_RECEIPT_CREATE",
  },
  "CHEQUE:RECEIPT:REVERSE": {
    permission: "finance.cheque.receipt.reverse",
    capability: "CHEQUE_RECEIPT_REVERSE",
  },
  "CHEQUE:ISSUE:CREATE": {
    permission: "finance.cheque.issue.create",
    capability: "CHEQUE_ISSUE_CREATE",
  },
  "CHEQUE:ISSUE:REVERSE": {
    permission: "finance.cheque.issue.reverse",
    capability: "CHEQUE_ISSUE_REVERSE",
  },
  "NOTE:RECEIPT:CREATE": {
    permission: "finance.note.receipt.create",
    capability: "NOTE_RECEIPT_CREATE",
  },
  "NOTE:RECEIPT:REVERSE": {
    permission: "finance.note.receipt.reverse",
    capability: "NOTE_RECEIPT_REVERSE",
  },
  "NOTE:ISSUE:CREATE": {
    permission: "finance.note.issue.create",
    capability: "NOTE_ISSUE_CREATE",
  },
  "NOTE:ISSUE:REVERSE": {
    permission: "finance.note.issue.reverse",
    capability: "NOTE_ISSUE_REVERSE",
  },
  "TRANSFER:TRANSFER:CREATE": {
    permission: "finance.transfer.create",
    capability: "TRANSFER_CREATE",
  },
  "TRANSFER:TRANSFER:REVERSE": {
    permission: "finance.transfer.reverse",
    capability: "TRANSFER_REVERSE",
  },
} as const satisfies Record<
  string,
  FinanceChannelPermissionMapping
>;

export function resolveFinanceChannelPermission(
  request: {
    channel: string;
    operation: string;
    direction: string;
  },
): FinanceChannelPermissionMapping | null {
  const key =
    `${request.channel}:${request.operation}:${request.direction}` as keyof typeof CHANNEL_PERMISSION_MAPPINGS;
  const mapping = CHANNEL_PERMISSION_MAPPINGS[key];
  return mapping ? { ...mapping } : null;
}
