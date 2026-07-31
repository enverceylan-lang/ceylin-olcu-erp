import type {
  FinanceTransaction
} from "@/lib/finance/financeContracts";

import type {
  FinanceCapability,
  FinancePermission
} from "@/lib/finance/financeAccessPolicy";

import type {
  FinanceChannel
} from "@/lib/finance/financeChannelPermissions";

export type FinancePersistenceAuthorizationMode =
  | {
      mode:
        "SYSTEM_WORKFLOW_ONLY";
      workflow:
        "SALE_APPROVAL" | "SALE_RETURN_APPROVAL";
    }
  | {
      mode:
        "USER_FINANCE_OPERATION";
      channel:
        FinanceChannel;
      permission:
        FinancePermission;
      capability:
        FinanceCapability;
    };

export type FinancePersistenceAuthorizationDecision =
  | {
      allowed:
        true;
      authorization:
        FinancePersistenceAuthorizationMode;
    }
  | {
      allowed:
        false;
      reason:
        | "UNSUPPORTED_TRANSACTION_TYPE"
        | "SOURCE_DOCUMENT_MISMATCH"
        | "PROJECTION_SOURCE_MISMATCH"
        | "PAYMENT_METHOD_REQUIRED"
        | "PAYMENT_METHOD_UNSUPPORTED";
    };

function collectionChannel(
  transaction:
    FinanceTransaction
): FinanceChannel | null {
  if (
    transaction.paymentMethod ===
      "CASH"
  ) {
    return "CASH";
  }

  if (
    transaction.paymentMethod ===
      "CREDIT_CARD"
  ) {
    return "POS";
  }

  if (
    transaction.paymentMethod ===
      "EFT" ||
    transaction.paymentMethod ===
      "BANK_TRANSFER"
  ) {
    return "BANK";
  }

  return null;
}

export function decideFinancePersistenceAuthorization(
  transaction:
    FinanceTransaction
): FinancePersistenceAuthorizationDecision {
  if (
    transaction.transactionType ===
      "SALE_CHARGE"
  ) {
    if (
      transaction.sourceDocumentType !==
        "SALE"
    ) {
      return {
        allowed:
          false,
        reason:
          "SOURCE_DOCUMENT_MISMATCH"
      };
    }

    if (
      transaction.projectionSource !==
        "SALE_CHARGE"
    ) {
      return {
        allowed:
          false,
        reason:
          "PROJECTION_SOURCE_MISMATCH"
      };
    }

    return {
      allowed:
        true,
      authorization: {
        mode:
          "SYSTEM_WORKFLOW_ONLY",
        workflow:
          "SALE_APPROVAL"
      }
    };
  }

  if (
    transaction.transactionType ===
      "REFUND"
  ) {
    if (
      transaction.sourceDocumentType !==
        "SALE_RETURN"
    ) {
      return {
        allowed:
          false,
        reason:
          "SOURCE_DOCUMENT_MISMATCH"
      };
    }

    if (
      transaction.projectionSource !==
        "SALE_RETURN"
    ) {
      return {
        allowed:
          false,
        reason:
          "PROJECTION_SOURCE_MISMATCH"
      };
    }

    return {
      allowed:
        true,
      authorization: {
        mode:
          "SYSTEM_WORKFLOW_ONLY",
        workflow:
          "SALE_RETURN_APPROVAL"
      }
    };
  }

  if (
    transaction.transactionType ===
      "COLLECTION"
  ) {
    if (
      transaction.sourceDocumentType !==
        "SALE_PAYMENT"
    ) {
      return {
        allowed:
          false,
        reason:
          "SOURCE_DOCUMENT_MISMATCH"
      };
    }

    if (
      transaction.projectionSource !==
        "SALE_PAYMENT" &&
      transaction.projectionSource !==
        "LEGACY_DOWN_PAYMENT"
    ) {
      return {
        allowed:
          false,
        reason:
          "PROJECTION_SOURCE_MISMATCH"
      };
    }

    if (!transaction.paymentMethod) {
      return {
        allowed:
          false,
        reason:
          "PAYMENT_METHOD_REQUIRED"
      };
    }

    const channel =
      collectionChannel(
        transaction
      );

    if (!channel) {
      return {
        allowed:
          false,
        reason:
          "PAYMENT_METHOD_UNSUPPORTED"
      };
    }

    if (channel === "CASH") {
      return {
        allowed:
          true,
        authorization: {
          mode:
            "USER_FINANCE_OPERATION",
          channel,
          permission:
            "finance.cash.collection.create",
          capability:
            "CASH_COLLECTION_CREATE"
        }
      };
    }

    if (channel === "POS") {
      return {
        allowed:
          true,
        authorization: {
          mode:
            "USER_FINANCE_OPERATION",
          channel,
          permission:
            "finance.pos.collection.create",
          capability:
            "POS_COLLECTION_CREATE"
        }
      };
    }

    return {
      allowed:
        true,
      authorization: {
        mode:
          "USER_FINANCE_OPERATION",
        channel,
        permission:
          "finance.bank.collection.create",
        capability:
          "BANK_COLLECTION_CREATE"
      }
    };
  }

  return {
    allowed:
      false,
    reason:
      "UNSUPPORTED_TRANSACTION_TYPE"
  };
}