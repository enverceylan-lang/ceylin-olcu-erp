import {
  parseFinanceOverviewSnapshot,
  type FinanceOverviewSnapshot,
} from "@/lib/finance/financeOverviewReadContracts";
import type { ErpScope } from "@/lib/erpScope";
import { erpScopeMatches } from "@/lib/erpScope";
import { useAuthStore } from "@/store/useAuthStore";

interface ReadFinanceOverviewOptions {
  signal?: AbortSignal;
}

export async function readFinanceOverviewSnapshot(
  expectedScope: ErpScope,
  currency: string,
  options: ReadFinanceOverviewOptions = {},
): Promise<FinanceOverviewSnapshot> {
  const normalizedCurrency = currency.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
    throw new Error("FINANCE_OVERVIEW_CURRENCY_INVALID");
  }

  const sessionToken =
    useAuthStore.getState().sessionToken?.trim();

  if (!sessionToken) {
    throw new Error("UNAUTHORIZED");
  }

  const params = new URLSearchParams({
    currency: normalizedCurrency,
  });

  const response = await fetch(
    `/api/finance/overview?${params.toString()}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
      cache: "no-store",
      signal: options.signal,
    },
  );

  const body = (await response.json().catch(() => null)) as
    | { success?: boolean; error?: unknown; snapshot?: unknown }
    | null;

  if (!response.ok || body?.success !== true) {
    const code =
      typeof body?.error === "string"
        ? body.error
        : `FINANCE_OVERVIEW_READ_HTTP_${response.status}`;
    throw new Error(code);
  }

  const snapshot = parseFinanceOverviewSnapshot(body.snapshot);

  if (!erpScopeMatches(expectedScope, snapshot.scope)) {
    throw new Error("FINANCE_OVERVIEW_SCOPE_MISMATCH");
  }

  if (snapshot.currency !== normalizedCurrency) {
    throw new Error("FINANCE_OVERVIEW_CURRENCY_MISMATCH");
  }

  return snapshot;
}
