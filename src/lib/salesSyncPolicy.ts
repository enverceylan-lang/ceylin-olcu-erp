import type {
  Sale,
  SalePayment
} from "@/store/salesStore";
import { getSaleRemainingBalance } from "@/lib/salesFinance";

export interface SaleSyncEnvelope {
  sale: Sale;
  version: number;
  deviceId: string;
}

export type SaleSyncMergeResult =
  | {
      status: "MERGED" | "UNCHANGED";
      envelope: SaleSyncEnvelope;
    }
  | {
      status: "CONFLICT";
      reason:
        | "SALE_ID_MISMATCH"
        | "OWNER_MISMATCH"
        | "SAME_VERSION_DIFFERENT_SALE"
        | "PAYMENT_ID_COLLISION";
    };

function isValidDate(value: string | undefined): boolean {
  return (
    typeof value === "string" &&
    Number.isFinite(Date.parse(value))
  );
}

function paymentFingerprint(payment: SalePayment): string {
  return JSON.stringify({
    amount: Number(payment.amount),
    paidAt: payment.paidAt,
    method: payment.method,
    installmentId: payment.installmentId || "",
    note: payment.note || "",
    receivedBy: payment.receivedBy || ""
  });
}

function saleFingerprint(sale: Sale): string {
  const {
    payments: _payments,
    remainingBalance: _remainingBalance,
    ...core
  } = sale;

  void _payments;
  void _remainingBalance;

  return JSON.stringify(core);
}

export function validateSaleSyncEnvelope(
  envelope: SaleSyncEnvelope
): string[] {
  const errors: string[] = [];
  const { sale, version, deviceId } = envelope;

  if (!sale.id?.trim()) errors.push("SALE_ID_REQUIRED");
  if (!sale.customerId?.trim()) {
    errors.push("CUSTOMER_ID_REQUIRED");
  }
  if (!sale.saleNo?.trim()) errors.push("SALE_NO_REQUIRED");
  if (!sale.createdByUserId?.trim()) {
    errors.push("OWNER_USER_ID_REQUIRED");
  }
  if (!Number.isSafeInteger(version) || version < 1) {
    errors.push("VERSION_INVALID");
  }
  if (!deviceId?.trim()) errors.push("DEVICE_ID_REQUIRED");
  if (!isValidDate(sale.updatedAt)) {
    errors.push("UPDATED_AT_INVALID");
  }
  if (
    sale.isDeleted &&
    !isValidDate(sale.deletedAt)
  ) {
    errors.push("DELETED_AT_REQUIRED");
  }

  const paymentIds = new Set<string>();

  for (const payment of sale.payments || []) {
    if (!payment.id?.trim()) {
      errors.push("PAYMENT_ID_REQUIRED");
      continue;
    }
    if (paymentIds.has(payment.id)) {
      errors.push("PAYMENT_ID_DUPLICATE");
    }
    paymentIds.add(payment.id);

    if (!Number.isFinite(payment.amount) || payment.amount <= 0) {
      errors.push("PAYMENT_AMOUNT_INVALID");
    }
    if (!isValidDate(payment.paidAt)) {
      errors.push("PAYMENT_DATE_INVALID");
    }
  }

  return [...new Set(errors)];
}

export function mergeSaleSyncEnvelopes(
  local: SaleSyncEnvelope,
  remote: SaleSyncEnvelope
): SaleSyncMergeResult {
  if (local.sale.id !== remote.sale.id) {
    return {
      status: "CONFLICT",
      reason: "SALE_ID_MISMATCH"
    };
  }

  if (
    local.sale.createdByUserId !==
    remote.sale.createdByUserId
  ) {
    return {
      status: "CONFLICT",
      reason: "OWNER_MISMATCH"
    };
  }

  const payments = new Map<string, SalePayment>();

  for (
    const payment of
      [
        ...(local.sale.payments || []),
        ...(remote.sale.payments || [])
      ]
  ) {
    const existing = payments.get(payment.id);

    if (
      existing &&
      paymentFingerprint(existing) !==
        paymentFingerprint(payment)
    ) {
      return {
        status: "CONFLICT",
        reason: "PAYMENT_ID_COLLISION"
      };
    }

    payments.set(payment.id, payment);
  }

  if (local.version === remote.version) {
    if (
      saleFingerprint(local.sale) !==
      saleFingerprint(remote.sale)
    ) {
      return {
        status: "CONFLICT",
        reason: "SAME_VERSION_DIFFERENT_SALE"
      };
    }

    const mergedSale: Sale = {
      ...local.sale,
      payments: [...payments.values()]
    };

    mergedSale.remainingBalance =
      getSaleRemainingBalance(mergedSale);

    return {
      status:
        payments.size ===
        (local.sale.payments || []).length
          ? "UNCHANGED"
          : "MERGED",
      envelope: {
        ...local,
        sale: mergedSale
      }
    };
  }

  const winner =
    local.version > remote.version ? local : remote;

  const mergedSale: Sale = {
    ...winner.sale,
    payments: [...payments.values()]
  };

  mergedSale.remainingBalance =
    getSaleRemainingBalance(mergedSale);

  return {
    status: "MERGED",
    envelope: {
      ...winner,
      sale: mergedSale
    }
  };
}
