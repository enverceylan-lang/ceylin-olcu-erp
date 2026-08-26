"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Loader2, ShieldCheck } from "lucide-react";
import type { ErpScope } from "@/lib/erpScope";
import type { CollectionChannel } from "@/lib/finance/collectionContracts";
import type { FinancePermission } from "@/lib/finance/financeAccessPolicy";
import { canCreateFinanceCollectionItem } from "@/lib/finance/financeNavigationPolicy";
import { useAuthStore } from "@/store/useAuthStore";

interface CollectionWorkspaceProps {
  activeItem: string;
  scope: ErpScope;
  permissions: readonly FinancePermission[];
}

interface CustomerRow { id: string; name: string; customerCode?: string | null }
interface CounterpartyRow extends CustomerRow { cariType: "SUPPLIER" | "TAILOR" | "INSTALLER" }
interface CashRow { id: string; cash_name: string; currency: string; is_active: boolean }
interface BankRow { id: string; bank_name: string; account_name: string; currency: string; is_active: boolean }
interface PosRow { id: string; pos_name: string; currency: string; is_active: boolean }
interface InstrumentRow {
  id: string; customer_id: string; instrument_type: "CHEQUE" | "NOTE";
  instrument_number: string; drawer_name: string; bank_name?: string | null;
  due_date: string; amount: number; currency: string;
  state: "PORTFOLIO" | "DEPOSITED" | "ENDORSED" | "COLLECTED" | "RETURNED" | "CANCELLED";
}

const CHANNEL_BY_ITEM: Record<string, CollectionChannel> = {
  "Kasa / Nakit": "CASH",
  "POS / Kart": "POS",
  "Banka / EFT / Havale": "BANK",
  "Müşteri Çeki": "CHEQUE",
  "Müşteri Senedi": "NOTE"
};

function rawMessage(value: unknown, fallback: string): string {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as { reason?: unknown; error?: unknown };
    if (typeof record.reason === "string" && record.reason) return record.reason;
    if (typeof record.error === "string" && record.error) return record.error;
  }
  return fallback;
}

function userMessage(value: unknown, fallback: string): string {
  const raw = rawMessage(value, fallback);

  if (
    raw === "UNAUTHORIZED" ||
    raw === "MISSING_SESSION" ||
    raw === "FINANCE_ACCESS_DENIED" ||
    raw.includes("PERMISSION_DENIED")
  ) {
    return "Bu finans işlemi için yetkiniz bulunmuyor.";
  }

  if (raw === "FINANCE_COLLECTION_SOURCE_READ_FAILED") {
    return "Tahsilat için gerekli hesap ve cari bilgileri yüklenemedi.";
  }

  if (raw === "FINANCE_COLLECTION_CREATE_FAILED") {
    return "Tahsilat kaydedilemedi. Bilgileri kontrol edip tekrar deneyin.";
  }

  if (raw === "FINANCE_INSTRUMENT_TRANSITION_FAILED") {
    return "Çek / senet işlemi tamamlanamadı.";
  }

  if (/^[A-Z][A-Z0-9_:.-]+$/.test(raw)) {
    return "Finans işlemi tamamlanamadı. Yetki ve işlem bilgilerini kontrol edin.";
  }

  return raw;
}

export function CollectionWorkspace({
  activeItem,
  scope,
  permissions,
}: CollectionWorkspaceProps) {
  const sessionToken = useAuthStore((state) => state.sessionToken);
  const channel = CHANNEL_BY_ITEM[activeItem];
  const channelAllowed = canCreateFinanceCollectionItem(
    permissions,
    activeItem,
  );
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [counterparties, setCounterparties] = useState<CounterpartyRow[]>([]);
  const [cashAccounts, setCashAccounts] = useState<CashRow[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankRow[]>([]);
  const [posAccounts, setPosAccounts] = useState<PosRow[]>([]);
  const [instruments, setInstruments] = useState<InstrumentRow[]>([]);
  const [serverNow, setServerNow] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [installmentCount, setInstallmentCount] = useState("1");
  const [description, setDescription] = useState("");
  const [instrumentBank, setInstrumentBank] = useState<Record<string, string>>({});
  const [instrumentReason, setInstrumentReason] = useState<Record<string, string>>({});
  const [instrumentCounterparty, setInstrumentCounterparty] = useState<Record<string, string>>({});
  const [instrument, setInstrument] = useState({
    instrumentNumber: "", drawerName: "", bankName: "", bankBranch: "",
    accountNumber: "", issueDate: "", issuePlace: "", guarantorName: "", dueDate: ""
  });

  const readSources = useCallback(async (): Promise<Record<string, unknown>> => {
    if (!channelAllowed) {
      throw new Error("FINANCE_ACCESS_DENIED");
    }
    if (!sessionToken) throw new Error("MISSING_SESSION");
    const response = await fetch("/api/finance/accounts", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      cache: "no-store"
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok || !body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error(userMessage(body, "FINANCE_COLLECTION_SOURCE_READ_FAILED"));
    }
    return body as Record<string, unknown>;
  }, [channelAllowed, sessionToken]);

  const applySources = useCallback((data: Record<string, unknown>) => {
    setCustomers((data.customers || []) as CustomerRow[]);
    setCounterparties((data.counterparties || []) as CounterpartyRow[]);
    setCashAccounts(((data.cashAccounts || []) as CashRow[]).filter(item => item.is_active));
    setBankAccounts(((data.bankAccounts || []) as BankRow[]).filter(item => item.is_active));
    setPosAccounts(((data.posAccounts || []) as PosRow[]).filter(item => item.is_active));
    setInstruments((data.receivableInstruments || []) as InstrumentRow[]);
    setServerNow(typeof data.serverNow === "string" ? data.serverNow : null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void readSources().then((data) => {
      if (!cancelled) applySources(data);
    }).catch((reason: unknown) => {
      if (!cancelled) {
        setError(
          userMessage(
            reason instanceof Error ? reason.message : reason,
            "FINANCE_COLLECTION_SOURCE_READ_FAILED",
          ),
        );
      }
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [applySources, readSources]);

  const accounts = useMemo(() => {
    if (channel === "CASH") return cashAccounts.map(item => ({ id: item.id, label: item.cash_name, currency: item.currency }));
    if (channel === "BANK") return bankAccounts.map(item => ({ id: item.id, label: `${item.bank_name} · ${item.account_name}`, currency: item.currency }));
    if (channel === "POS") return posAccounts.map(item => ({ id: item.id, label: item.pos_name, currency: item.currency }));
    return [];
  }, [bankAccounts, cashAccounts, channel, posAccounts]);

  if (!channel || !channelAllowed) return null;

  const isInstrument = channel === "CHEQUE" || channel === "NOTE";
  const parsedAmount = Number(amount.replace(",", "."));
  const ready = Boolean(customerId && Number.isFinite(parsedAmount) && parsedAmount > 0 &&
    (isInstrument
      ? instrument.instrumentNumber.trim() && instrument.drawerName.trim() && instrument.dueDate &&
        (channel !== "CHEQUE" || instrument.bankName.trim())
      : accountId && (channel !== "POS" || (Number.isInteger(Number(installmentCount)) && Number(installmentCount) > 0))));

  async function submit() {
    if (!ready || !sessionToken || saving) return;
    setSaving(true); setError(""); setSuccess("");
    const operationId = crypto.randomUUID();
    const command = {
      ...scope,
      operationId,
      idempotencyKey: crypto.randomUUID(),
      channel,
      customerId,
      amount: parsedAmount,
      currency: "TRY",
      cashAccountId: channel === "CASH" ? accountId : null,
      bankAccountId: channel === "BANK" ? accountId : null,
      posAccountId: channel === "POS" ? accountId : null,
      installmentCount: channel === "POS" ? Number(installmentCount) : null,
      description: description.trim() || null,
      instrument: isInstrument ? {
        ...instrument,
        bankName: instrument.bankName.trim() || null,
        bankBranch: instrument.bankBranch.trim() || null,
        accountNumber: instrument.accountNumber.trim() || null,
        issueDate: instrument.issueDate || null,
        issuePlace: instrument.issuePlace.trim() || null,
        guarantorName: instrument.guarantorName.trim() || null
      } : null
    };
    try {
      const response = await fetch("/api/finance/operations", {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionToken}`, "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ collectionCommand: command })
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(userMessage(body, "FINANCE_COLLECTION_CREATE_FAILED"));
      }
      const occurredAt = body && typeof body === "object" && !Array.isArray(body) &&
        typeof (body as { occurredAt?: unknown }).occurredAt === "string"
        ? (body as { occurredAt: string }).occurredAt : null;
      setSuccess(`Tahsilat kaydedildi${occurredAt ? ` · ${new Date(occurredAt).toLocaleString("tr-TR")}` : ""}`);
      setAmount(""); setDescription("");
      setInstrument({ instrumentNumber: "", drawerName: "", bankName: "", bankBranch: "", accountNumber: "", issueDate: "", issuePlace: "", guarantorName: "", dueDate: "" });
      applySources(await readSources());
    } catch (reason: unknown) {
      setError(
        userMessage(
          reason instanceof Error ? reason.message : reason,
          "FINANCE_COLLECTION_CREATE_FAILED",
        ),
      );
    } finally { setSaving(false); }
  }

  async function transitionInstrument(row: InstrumentRow, toState: "DEPOSITED" | "ENDORSED" | "COLLECTED" | "RETURNED" | "CANCELLED") {
    if (!sessionToken || saving) return;
    const needsBank = toState === "DEPOSITED" || toState === "COLLECTED";
    const bankAccountId = needsBank ? (instrumentBank[row.id] || "").trim() : null;
    if (needsBank && !bankAccountId) { setError("Banka hesabı seçilmelidir."); return; }
    const reason = toState === "RETURNED" || toState === "CANCELLED" ? (instrumentReason[row.id] || "").trim() : null;
    if ((toState === "RETURNED" || toState === "CANCELLED") && !reason) { setError("İade / iptal gerekçesi zorunludur."); return; }
    setSaving(true); setError(""); setSuccess("");
    try {
      const selectedCounterparty = counterparties.find(item => item.id === instrumentCounterparty[row.id]);
      if (toState === "ENDORSED" && !selectedCounterparty) { setError("Ciro edilecek cari seçilmelidir."); return; }
      const response = await fetch("/api/finance/operations", {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionToken}`, "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ instrumentTransitionCommand: {
          ...scope, operationId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID(),
          instrumentId: row.id, instrumentType: row.instrument_type, fromState: row.state, toState,
          bankAccountId: bankAccountId || null, reason: reason || null,
          counterpartyId: selectedCounterparty?.id || null,
          counterpartyType: selectedCounterparty?.cariType || null
        } })
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          userMessage(body, "FINANCE_INSTRUMENT_TRANSITION_FAILED"),
        );
      }
      setSuccess("Evrak durumu güncellendi.");
      applySources(await readSources());
    } catch (reasonValue: unknown) {
      setError(
        userMessage(
          reasonValue instanceof Error ? reasonValue.message : reasonValue,
          "FINANCE_INSTRUMENT_TRANSITION_FAILED",
        ),
      );
    } finally { setSaving(false); }
  }

  const inputClass = "min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

  return (
    <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/50 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-bold text-slate-950 dark:text-white">{activeItem}</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Satış seçilmez; sistem açık borçları vade sırasıyla otomatik kapatır.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          <CalendarClock className="h-4 w-4" />
          {serverNow ? new Date(serverNow).toLocaleString("tr-TR") : "Sunucu tarihi kayıt anında atanır"}
          <span className="text-emerald-600">· Kilitli</span>
        </div>
      </div>

      {loading ? <div className="mt-5 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Kesin kaynaklar yükleniyor…</div> : (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
            Cari
            <select className={inputClass} value={customerId} onChange={event => setCustomerId(event.target.value)}>
              <option value="">Cari seçin</option>
              {customers.map(customer => <option key={customer.id} value={customer.id}>{customer.customerCode ? `${customer.customerCode} · ` : ""}{customer.name}</option>)}
            </select>
          </label>
          {!isInstrument ? <label className="grid gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
            {channel === "CASH" ? "Kasa" : channel === "BANK" ? "Banka hesabı" : "POS"}
            <select className={inputClass} value={accountId} onChange={event => setAccountId(event.target.value)}>
              <option value="">Hesap seçin</option>
              {accounts.map(account => <option key={account.id} value={account.id}>{account.label} · {account.currency}</option>)}
            </select>
          </label> : null}
          {channel === "POS" ? <label className="grid gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
            Kart taksit sayısı
            <input type="number" min="1" step="1" className={inputClass} value={installmentCount} onChange={event => setInstallmentCount(event.target.value)} />
          </label> : null}
          <label className="grid gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
            Tutar
            <input className={inputClass} inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} placeholder="0,00" />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
            Açıklama (isteğe bağlı)
            <input className={inputClass} value={description} onChange={event => setDescription(event.target.value)} placeholder="Boşsa sistem otomatik oluşturur" />
          </label>

          {isInstrument ? <>
            <label className="grid gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">Evrak numarası<input className={inputClass} value={instrument.instrumentNumber} onChange={event => setInstrument(value => ({ ...value, instrumentNumber: event.target.value }))} /></label>
            <label className="grid gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">Keşideci / borçlu<input className={inputClass} value={instrument.drawerName} onChange={event => setInstrument(value => ({ ...value, drawerName: event.target.value }))} /></label>
            {channel === "CHEQUE" ? <>
              <label className="grid gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">Banka<input className={inputClass} value={instrument.bankName} onChange={event => setInstrument(value => ({ ...value, bankName: event.target.value }))} /></label>
              <label className="grid gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">Banka şubesi<input className={inputClass} value={instrument.bankBranch} onChange={event => setInstrument(value => ({ ...value, bankBranch: event.target.value }))} /></label>
              <label className="grid gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">Hesap / IBAN (isteğe bağlı)<input className={inputClass} value={instrument.accountNumber} onChange={event => setInstrument(value => ({ ...value, accountNumber: event.target.value }))} /></label>
            </> : <>
              <label className="grid gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">Düzenleme yeri<input className={inputClass} value={instrument.issuePlace} onChange={event => setInstrument(value => ({ ...value, issuePlace: event.target.value }))} /></label>
              <label className="grid gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">Kefil (isteğe bağlı)<input className={inputClass} value={instrument.guarantorName} onChange={event => setInstrument(value => ({ ...value, guarantorName: event.target.value }))} /></label>
            </>}
            <label className="grid gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">Düzenleme tarihi<input type="date" className={inputClass} value={instrument.issueDate} onChange={event => setInstrument(value => ({ ...value, issueDate: event.target.value }))} /></label>
            <label className="grid gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">Vade tarihi<input type="date" className={inputClass} value={instrument.dueDate} onChange={event => setInstrument(value => ({ ...value, dueDate: event.target.value }))} /></label>
          </> : null}
        </div>
      )}

      {error ? <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">{error}</p> : null}
      {success ? <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">{success}</p> : null}
      <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <p className="inline-flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-500" /> Tarih, kapsam ve mahsup sunucuda doğrulanır.</p>
        <button type="button" disabled={!ready || saving || loading} onClick={() => void submit()} className="min-h-11 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">
          {saving ? "Kaydediliyor…" : isInstrument ? "Portföye Al" : "Tahsilatı Kaydet"}
        </button>
      </div>
      {isInstrument ? <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-800">
        <h4 className="font-bold text-slate-950 dark:text-white">Portföydeki {channel === "CHEQUE" ? "çekler" : "senetler"}</h4>
        <div className="mt-3 grid gap-3">
          {instruments.filter(row => row.instrument_type === channel).length === 0
            ? <p className="text-sm text-slate-500">Kayıt bulunamadı.</p>
            : instruments.filter(row => row.instrument_type === channel).map(row => <article key={row.id} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="text-sm text-slate-700 dark:text-slate-200">
                  <strong>{row.instrument_number}</strong> · {row.drawer_name} · {Number(row.amount).toLocaleString("tr-TR", { style: "currency", currency: row.currency })}
                  <div className="mt-1 text-xs text-slate-500">Vade: {new Date(`${row.due_date}T00:00:00`).toLocaleDateString("tr-TR")} · Durum: {row.state}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {row.state === "PORTFOLIO" || row.state === "DEPOSITED" || row.state === "ENDORSED" ? <>
                    <select aria-label="Evrak banka hesabı" className="min-h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-950" value={instrumentBank[row.id] || ""} onChange={event => setInstrumentBank(value => ({ ...value, [row.id]: event.target.value }))}>
                      <option value="">Banka seçin</option>
                      {bankAccounts.map(bank => <option key={bank.id} value={bank.id}>{bank.bank_name} · {bank.account_name}</option>)}
                    </select>
                    <input aria-label="Evrak işlem gerekçesi" className="min-h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-950" placeholder="İade / iptal gerekçesi" value={instrumentReason[row.id] || ""} onChange={event => setInstrumentReason(value => ({ ...value, [row.id]: event.target.value }))} />
                    {row.state === "PORTFOLIO" ? <select aria-label="Ciro edilecek cari" className="min-h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-950" value={instrumentCounterparty[row.id] || ""} onChange={event => setInstrumentCounterparty(value => ({ ...value, [row.id]: event.target.value }))}>
                      <option value="">Ciro carisi seçin</option>
                      {counterparties.map(item => <option key={item.id} value={item.id}>{item.name} · {item.cariType}</option>)}
                    </select> : null}
                  </> : null}
                  {row.state === "PORTFOLIO" ? <button type="button" disabled={saving} onClick={() => void transitionInstrument(row, "DEPOSITED")} className="rounded-lg border px-3 py-2 text-xs font-bold">Bankaya Ver</button> : null}
                  {row.state === "PORTFOLIO" ? <button type="button" disabled={saving} onClick={() => void transitionInstrument(row, "ENDORSED")} className="rounded-lg border px-3 py-2 text-xs font-bold">Ciro Et</button> : null}
                  {row.state === "DEPOSITED" ? <button type="button" disabled={saving} onClick={() => void transitionInstrument(row, "COLLECTED")} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Tahsil Et</button> : null}
                  {row.state === "PORTFOLIO" || row.state === "DEPOSITED" || row.state === "ENDORSED" ? <button type="button" disabled={saving} onClick={() => void transitionInstrument(row, "RETURNED")} className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-bold text-rose-700 dark:text-rose-300">İade</button> : null}
                  {row.state === "PORTFOLIO" ? <button type="button" disabled={saving} onClick={() => void transitionInstrument(row, "CANCELLED")} className="rounded-lg border px-3 py-2 text-xs font-bold">İptal</button> : null}
                </div>
              </div>
            </article>)}
        </div>
      </div> : null}
    </div>
  );
}
