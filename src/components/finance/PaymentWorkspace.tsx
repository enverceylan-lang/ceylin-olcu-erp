"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import type { ErpScope } from "@/lib/erpScope";
import type { FinancePermission } from "@/lib/finance/financeAccessPolicy";
import { useAuthStore } from "@/store/useAuthStore";

interface PaymentWorkspaceProps {
  activeItem: string;
  scope: ErpScope;
  permissions: readonly FinancePermission[];
}

interface CounterpartyRow {
  id: string;
  name: string;
  customerCode?: string | null;
  cariType: "SUPPLIER" | "TAILOR" | "INSTALLER";
}

interface CashRow {
  id: string;
  cash_name: string;
  currency: string;
  is_active: boolean;
}

interface BankRow {
  id: string;
  bank_name: string;
  account_name: string;
  currency: string;
  is_active: boolean;
}

type PaymentChannel = "CASH" | "BANK";

const CHANNEL_BY_ITEM: Record<string, PaymentChannel> = {
  "Kasa / Nakit": "CASH",
  "Banka / EFT / Havale": "BANK",
};

function userMessage(value: unknown, fallback: string): string {
  const raw =
    value instanceof Error
      ? value.message
      : value && typeof value === "object" && !Array.isArray(value)
        ? (() => {
            const record = value as { reason?: unknown; error?: unknown };
            if (typeof record.reason === "string") return record.reason;
            if (typeof record.error === "string") return record.error;
            return "";
          })()
        : typeof value === "string"
          ? value
          : "";

  if (
    raw === "UNAUTHORIZED" ||
    raw === "MISSING_SESSION" ||
    raw === "FINANCE_ACCESS_DENIED" ||
    raw === "PERMISSION_DENIED"
  ) {
    return "Bu ödeme işlemi için yetkiniz bulunmuyor.";
  }

  if (raw.includes("ATOMIC_AUTHORITY_REQUIRED")) {
    return "Bu ödeme kanalı henüz güvenli ödeme yetkisine bağlanmadı.";
  }

  return fallback;
}

export function PaymentWorkspace({
  activeItem,
  scope,
  permissions,
}: PaymentWorkspaceProps) {
  const sessionToken = useAuthStore((state) => state.sessionToken);
  const channel = CHANNEL_BY_ITEM[activeItem];

  const channelAllowed = useMemo(() => {
    if (channel === "CASH") {
      return permissions.includes("finance.cash.payment.create");
    }
    if (channel === "BANK") {
      return permissions.includes("finance.bank.payment.create");
    }
    return false;
  }, [channel, permissions]);

  const [counterparties, setCounterparties] = useState<CounterpartyRow[]>([]);
  const [cashAccounts, setCashAccounts] = useState<CashRow[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankRow[]>([]);
  const [counterpartyId, setCounterpartyId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const readSources = useCallback(async (): Promise<Record<string, unknown>> => {
    if (!channelAllowed) {
      throw new Error("FINANCE_ACCESS_DENIED");
    }
    if (!sessionToken) {
      throw new Error("MISSING_SESSION");
    }

    const response = await fetch("/api/finance/accounts", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      cache: "no-store",
    });
    const body: unknown = await response.json().catch(() => null);

    if (
      !response.ok ||
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      throw new Error(
        userMessage(body, "Ödeme kaynakları şu anda alınamadı."),
      );
    }

    return body as Record<string, unknown>;
  }, [channelAllowed, sessionToken]);

  useEffect(() => {
    let cancelled = false;

    void readSources()
      .then((data) => {
        if (cancelled) return;
        setCounterparties((data.counterparties || []) as CounterpartyRow[]);
        setCashAccounts(
          ((data.cashAccounts || []) as CashRow[]).filter(
            (item) => item.is_active,
          ),
        );
        setBankAccounts(
          ((data.bankAccounts || []) as BankRow[]).filter(
            (item) => item.is_active,
          ),
        );
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(
          userMessage(reason, "Ödeme kaynakları şu anda alınamadı."),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [readSources]);

  const accounts = useMemo(() => {
    if (channel === "CASH") {
      return cashAccounts.map((item) => ({
        id: item.id,
        label: item.cash_name,
        currency: item.currency,
      }));
    }
    if (channel === "BANK") {
      return bankAccounts.map((item) => ({
        id: item.id,
        label: `${item.bank_name} · ${item.account_name}`,
        currency: item.currency,
      }));
    }
    return [];
  }, [bankAccounts, cashAccounts, channel]);

  if (!channel || !channelAllowed) return null;

  const selectedCounterparty =
    counterparties.find((item) => item.id === counterpartyId) || null;
  const selectedAccount =
    accounts.find((item) => item.id === accountId) || null;
  const parsedAmount = Number(amount.replace(",", "."));
  const ready = Boolean(
    selectedCounterparty &&
      selectedAccount &&
      Number.isFinite(parsedAmount) &&
      parsedAmount > 0,
  );

  const submit = async () => {
    if (!ready || !selectedCounterparty || !selectedAccount || !sessionToken) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const operationId = crypto.randomUUID();
      const occurredAt = new Date().toISOString();
      const sourceDocumentId = `COUNTERPARTY_PAYMENT:${operationId}`;

      const payload = {
        tenantId: scope.tenantId,
        companyId: scope.companyId,
        branchId: scope.branchId,
        accountingPeriodId: scope.accountingPeriodId,
        operationId,
        idempotencyKey: `PAYMENT:${operationId}`,
        kind: "PAYMENT",
        channel,
        action: "CREATE",
        amount: parsedAmount,
        currency: selectedAccount.currency,
        paymentMethod: channel,
        accounts: {
          financeAccountId: null,
          cashAccountId: channel === "CASH" ? selectedAccount.id : null,
          bankAccountId: channel === "BANK" ? selectedAccount.id : null,
          posAccountId: null,
          counterAccountId: null,
          sourceBankAccountId: null,
          destinationBankAccountId: null,
        },
        source: {
          customerId: null,
          counterpartyId: selectedCounterparty.id,
          saleId: null,
          sourceDocumentId,
          sourceDocumentType: "COUNTERPARTY_PAYMENT",
        },
        occurredAt,
        description: description.trim() || null,
        reversalOfTransactionId: null,
        counterpartyType: selectedCounterparty.cariType,
      };

      const response = await fetch("/api/finance/operations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const body: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          userMessage(body, "Ödeme kaydı oluşturulamadı."),
        );
      }

      setAmount("");
      setDescription("");
      setSuccess(
        channel === "CASH"
          ? "Nakit ödeme güvenli biçimde kaydedildi."
          : "Banka ödemesi güvenli biçimde kaydedildi.",
      );
    } catch (reason: unknown) {
      setError(userMessage(reason, "Ödeme kaydı oluşturulamadı."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden="true" />
        <div>
          <h3 className="font-bold text-slate-950 dark:text-white">
            {channel === "CASH" ? "Nakit Ödeme" : "Banka Ödemesi"}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Ödeme, kasa/banka hareketi ile cari borç hareketini tek işlemde oluşturur.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-5 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Ödeme kaynakları hazırlanıyor...
        </div>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Ödeme yapılan cari
            <select
              value={counterpartyId}
              onChange={(event) => setCounterpartyId(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">Cari seçin</option>
              {counterparties.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.customerCode ? ` · ${item.customerCode}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {channel === "CASH" ? "Kasa" : "Banka hesabı"}
            <select
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">Hesap seçin</option>
              {accounts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label} · {item.currency}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Tutar
            <input
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0,00"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>

          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Açıklama
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="İsteğe bağlı"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
        </div>
      )}

      {error ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-200">
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-200">
          {success}
        </p>
      ) : null}

      <button
        type="button"
        disabled={!ready || saving || loading}
        onClick={() => void submit()}
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            Kaydediliyor...
          </>
        ) : (
          "Ödemeyi Kaydet"
        )}
      </button>
    </section>
  );
}
