import {
  parseCustomerReceivableSnapshot,
  type CustomerReceivableSnapshot,
} from "@/lib/finance/customerReceivableReadContracts";
import { useAuthStore } from "@/store/useAuthStore";

interface ReadCustomerReceivableSnapshotOptions {
  signal?: AbortSignal;
}

export async function readCustomerReceivableSnapshot(
  customerId: string,
  currency: string,
  options: ReadCustomerReceivableSnapshotOptions = {},
): Promise<CustomerReceivableSnapshot> {
  const normalizedCustomerId = customerId.trim();
  const normalizedCurrency = currency.trim().toUpperCase();

  if (!normalizedCustomerId) {
    throw new Error("FINANCE_CUSTOMER_RECEIVABLE_CUSTOMER_REQUIRED");
  }
  if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
    throw new Error("FINANCE_CUSTOMER_RECEIVABLE_CURRENCY_INVALID");
  }

  const sessionToken =
    useAuthStore.getState().sessionToken?.trim();

  if (!sessionToken) {
    throw new Error("UNAUTHORIZED");
  }

  const params = new URLSearchParams({
    customerId: normalizedCustomerId,
    currency: normalizedCurrency,
  });

  const response = await fetch(`/api/finance/customer-receivable?${params.toString()}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
    cache: "no-store",
    signal: options.signal,
  });

  const body = (await response.json().catch(() => null)) as
    | { success?: boolean; error?: unknown; snapshot?: unknown }
    | null;

  if (!response.ok || body?.success !== true) {
    const code =
      typeof body?.error === "string"
        ? body.error
        : `FINANCE_CUSTOMER_RECEIVABLE_READ_HTTP_${response.status}`;
    throw new Error(code);
  }

  const snapshot = parseCustomerReceivableSnapshot(body.snapshot);

  if (snapshot.customerId !== normalizedCustomerId) {
    throw new Error("FINANCE_CUSTOMER_RECEIVABLE_CUSTOMER_MISMATCH");
  }
  if (snapshot.currency !== normalizedCurrency) {
    throw new Error("FINANCE_CUSTOMER_RECEIVABLE_CURRENCY_MISMATCH");
  }

  return snapshot;
}