"use client";

import { useEffect, useMemo, useState } from "react";
import type { ErpScope } from "@/lib/erpScope";
import type { FinancePermission } from "@/lib/finance/financeAccessPolicy";
import { useAuthStore } from "@/store/useAuthStore";

interface OpeningBalanceWorkspaceProps {
  scope: ErpScope;
  permissions: readonly FinancePermission[];
}

interface CustomerRow {
  id: string;
  name: string;
  customerCode?: string | null;
}

interface AccountsResponse {
  success?: boolean;
  customers?: CustomerRow[];
  error?: string;
}

export function OpeningBalanceWorkspace({
  scope,
  permissions,
}: OpeningBalanceWorkspaceProps) {
  const sessionToken = useAuthStore((state) => state.sessionToken);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [direction, setDirection] = useState<"RECEIVABLE" | "PAYABLE">("RECEIVABLE");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("TRY");
  const [openingDate, setOpeningDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [sourceDocumentId, setSourceDocumentId] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const allowed = permissions.includes("finance.opening_balance.create");

  useEffect(() => {
    if (!allowed || !sessionToken) return;

    let cancelled = false;
    void fetch("/api/finance/accounts", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      cache: "no-store",
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as AccountsResponse | null;
        if (!response.ok || !body?.success) {
          throw new Error(body?.error || "FINANCE_OPENING_CUSTOMERS_READ_FAILED");
        }
        if (!cancelled) setCustomers(body.customers || []);
      })
      .catch(() => {
        if (!cancelled) setMessage("Cari listesi okunamadi.");
      })
      .finally(() => {
        // Fetch completion requires no synchronous effect state transition.
      });

    return () => {
      cancelled = true;
    };
  }, [allowed, sessionToken]);

  const parsedAmount = Number(amount.replace(",", "."));
  const ready = useMemo(
    () =>
      allowed &&
      Boolean(sessionToken) &&
      Boolean(customerId) &&
      Boolean(sourceDocumentId.trim()) &&
      Boolean(openingDate) &&
      /^[A-Z]{3}$/.test(currency.trim().toUpperCase()) &&
      Number.isFinite(parsedAmount) &&
      parsedAmount > 0 &&
      Math.abs(parsedAmount * 100 - Math.round(parsedAmount * 100)) <= 1e-7 &&
      (direction !== "PAYABLE" || currency.trim().toUpperCase() === "TRY"),
    [
      allowed,
      sessionToken,
      customerId,
      sourceDocumentId,
      openingDate,
      currency,
      parsedAmount,
      direction,
    ],
  );

  if (!allowed) return null;

  const submit = async () => {
    if (!ready || !sessionToken) return;

    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/finance/opening-balance", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          openingBalanceCommand: {
            ...scope,
            customerId,
            direction,
            amount: parsedAmount,
            currency: currency.trim().toUpperCase(),
            openingDate,
            dueDate: dueDate || null,
            sourceDocumentId: sourceDocumentId.trim(),
            sourceDocumentType: "OPENING_BALANCE",
            description: description.trim() || null,
          },
        }),
      });

      const body = (await response.json().catch(() => null)) as
        | { outcome?: string; reason?: string; error?: string; operationId?: string }
        | null;

      if (!response.ok) {
        setMessage(body?.reason || body?.error || "Acilis bakiyesi kaydedilemedi.");
        return;
      }

      setMessage(
        body?.outcome === "REPLAY"
          ? "Bu devir belgesi daha once ayni icerikle kaydedilmis."
          : "Devir / acilis bakiyesi canonical finans zincirine kaydedildi.",
      );
    } catch {
      setMessage("Devir / acilis servisine ulasilamadi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/60">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm font-semibold">
          Cari
          <select
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
            disabled={saving}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">Cari seciniz</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.customerCode ? `${customer.customerCode} - ` : ""}
                {customer.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-semibold">
          Yon
          <select
            value={direction}
            onChange={(event) =>
              setDirection(event.target.value as "RECEIVABLE" | "PAYABLE")
            }
            disabled={saving}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="RECEIVABLE">Musteri bize borclu</option>
            <option value="PAYABLE">Biz musteriye borcluyuz</option>
          </select>
        </label>

        <label className="text-sm font-semibold">
          Tutar
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            disabled={saving}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>

        <label className="text-sm font-semibold">
          Para birimi
          <input
            value={currency}
            onChange={(event) => setCurrency(event.target.value.toUpperCase())}
            maxLength={3}
            disabled={saving || direction === "PAYABLE"}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 uppercase dark:border-slate-700 dark:bg-slate-900"
          />
        </label>

        <label className="text-sm font-semibold">
          Acilis tarihi
          <input
            type="date"
            value={openingDate}
            onChange={(event) => setOpeningDate(event.target.value)}
            disabled={saving}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>

        <label className="text-sm font-semibold">
          Vade
          <input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            disabled={saving}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>

        <label className="text-sm font-semibold md:col-span-2">
          Devir belge no / referans
          <input
            value={sourceDocumentId}
            onChange={(event) => setSourceDocumentId(event.target.value)}
            placeholder="DEVIR-2026-001"
            disabled={saving}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>

        <label className="text-sm font-semibold md:col-span-2">
          Aciklama
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            disabled={saving}
            className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
      </div>

      {direction === "PAYABLE" ? (
        <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
          Musteriye borc acilisi canonical payable hattina ACCRUAL olarak yazilir.
          Bu V1 hatta PAYABLE para birimi TRY ile sinirlidir.
        </p>
      ) : null}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          disabled={!ready || saving}
          onClick={() => void submit()}
          className="min-h-10 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Kaydediliyor..." : "Devir / Acilis Bakiyesini Kaydet"}
        </button>
        {message ? <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p> : null}
      </div>
    </div>
  );
}
