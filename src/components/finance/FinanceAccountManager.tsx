"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Landmark, Loader2, Plus } from "lucide-react";

type AccountKind = "CASH" | "BANK" | "POS";
type PosKind = "PHYSICAL" | "VIRTUAL" | "MOBILE" | "PAYMENT_LINK";

interface CashAccountRow {
  id: string;
  cash_code: string;
  cash_name: string;
  ledger_account_id: string;
  currency: string;
  is_active: boolean;
}

interface BankAccountRow {
  id: string;
  bank_code: string;
  bank_name: string;
  account_name: string;
  branch_name: string | null;
  iban: string | null;
  account_number: string | null;
  ledger_account_id: string;
  currency: string;
  is_active: boolean;
}

interface PosAccountRow {
  id: string;
  pos_code: string;
  pos_name: string;
  bank_account_id: string;
  clearing_ledger_account_id: string;
  kind: PosKind;
  merchant_number: string | null;
  terminal_number: string | null;
  currency: string;
  is_active: boolean;
}

function newKey(): string {
  return crypto.randomUUID();
}

export function FinanceAccountManager() {
  const [kind, setKind] = useState<AccountKind>("CASH");
  const [cashAccounts, setCashAccounts] = useState<CashAccountRow[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccountRow[]>([]);
  const [posAccounts, setPosAccounts] = useState<PosAccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [common, setCommon] = useState({
    ledgerCode: "",
    ledgerName: "",
    currency: "TRY",
  });

  const [cash, setCash] = useState({
    code: "",
    name: "",
  });

  const [bank, setBank] = useState({
    code: "",
    bankName: "",
    accountName: "",
    branchName: "",
    iban: "",
    accountNumber: "",
  });

  const [pos, setPos] = useState({
    code: "",
    name: "",
    bankAccountId: "",
    kind: "PHYSICAL" as PosKind,
    merchantNumber: "",
    terminalNumber: "",
  });

  const activeCash = useMemo(
    () => cashAccounts.filter((account) => account.is_active),
    [cashAccounts],
  );
  const activeBank = useMemo(
    () => bankAccounts.filter((account) => account.is_active),
    [bankAccounts],
  );
  const activePos = useMemo(
    () => posAccounts.filter((account) => account.is_active),
    [posAccounts],
  );

  const fetchAccounts = useCallback(async () => {
    const response = await fetch("/api/finance/accounts", {
      cache: "no-store",
    });
    const body = await response.json();

    if (!response.ok || !body.success) {
      throw new Error(
        body.reason ||
          body.error ||
          "FINANCE_ACCOUNT_MASTER_READ_FAILED",
      );
    }

    return {
      cashAccounts: (body.cashAccounts || []) as CashAccountRow[],
      bankAccounts: (body.bankAccounts || []) as BankAccountRow[],
      posAccounts: (body.posAccounts || []) as PosAccountRow[],
    };
  }, []);

  const applyAccounts = useCallback(
    (data: {
      cashAccounts: CashAccountRow[];
      bankAccounts: BankAccountRow[];
      posAccounts: PosAccountRow[];
    }) => {
      setCashAccounts(data.cashAccounts);
      setBankAccounts(data.bankAccounts);
      setPosAccounts(data.posAccounts);
    },
    [],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      applyAccounts(await fetchAccounts());
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "FINANCE_ACCOUNT_MASTER_READ_FAILED",
      );
    } finally {
      setLoading(false);
    }
  }, [applyAccounts, fetchAccounts]);

  useEffect(() => {
    let cancelled = false;

    void fetchAccounts()
      .then((data) => {
        if (cancelled) {
          return;
        }

        applyAccounts(data);
        setError("");
      })
      .catch((reason: unknown) => {
        if (cancelled) {
          return;
        }

        setError(
          reason instanceof Error
            ? reason.message
            : "FINANCE_ACCOUNT_MASTER_READ_FAILED",
        );
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applyAccounts, fetchAccounts]);

  function resetForm() {
    setCommon({
      ledgerCode: "",
      ledgerName: "",
      currency: "TRY",
    });
    setCash({ code: "", name: "" });
    setBank({
      code: "",
      bankName: "",
      accountName: "",
      branchName: "",
      iban: "",
      accountNumber: "",
    });
    setPos({
      code: "",
      name: "",
      bankAccountId: "",
      kind: "PHYSICAL",
      merchantNumber: "",
      terminalNumber: "",
    });
  }

  function createPayload(): Record<string, unknown> {
    const base = {
      ledger_code: common.ledgerCode.trim(),
      ledger_name: common.ledgerName.trim(),
      currency: common.currency.trim().toUpperCase(),
    };

    if (kind === "CASH") {
      return {
        ...base,
        cash_code: cash.code.trim(),
        cash_name: cash.name.trim(),
      };
    }

    if (kind === "BANK") {
      return {
        ...base,
        bank_code: bank.code.trim(),
        bank_name: bank.bankName.trim(),
        account_name: bank.accountName.trim(),
        branch_name: bank.branchName.trim(),
        iban: bank.iban.trim(),
        account_number: bank.accountNumber.trim(),
      };
    }

    return {
      ...base,
      pos_code: pos.code.trim(),
      pos_name: pos.name.trim(),
      bank_account_id: pos.bankAccountId,
      kind: pos.kind,
      merchant_number: pos.merchantNumber.trim(),
      terminal_number: pos.terminalNumber.trim(),
    };
  }

  function formReady(): boolean {
    if (
      !common.ledgerCode.trim() ||
      !common.ledgerName.trim() ||
      !common.currency.trim()
    ) {
      return false;
    }

    if (kind === "CASH") {
      return Boolean(cash.code.trim() && cash.name.trim());
    }

    if (kind === "BANK") {
      return Boolean(
        bank.code.trim() &&
          bank.bankName.trim() &&
          bank.accountName.trim(),
      );
    }

    return Boolean(
      pos.code.trim() &&
        pos.name.trim() &&
        pos.bankAccountId,
    );
  }

  async function createAccount() {
    if (!formReady()) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/finance/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE",
          kind,
          idempotencyKey: newKey(),
          payload: createPayload(),
        }),
      });
      const body = await response.json();

      if (!response.ok || !body.success) {
        throw new Error(
          body.reason ||
            body.error ||
            "FINANCE_ACCOUNT_MASTER_CREATE_FAILED",
        );
      }

      resetForm();
      await reload();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "FINANCE_ACCOUNT_MASTER_CREATE_FAILED",
      );
    } finally {
      setSaving(false);
    }
  }

  async function archiveAccount(
    accountKind: AccountKind,
    operationalAccountId: string,
    label: string,
  ) {
    if (
      !window.confirm(
        `${label} pasife alınsın mı? Geçmiş finans hareketleri silinmez.`,
      )
    ) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/finance/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ARCHIVE",
          kind: accountKind,
          idempotencyKey: newKey(),
          payload: {
            operational_account_id: operationalAccountId,
          },
        }),
      });
      const body = await response.json();

      if (!response.ok || !body.success) {
        throw new Error(
          body.reason ||
            body.error ||
            "FINANCE_ACCOUNT_MASTER_ARCHIVE_FAILED",
        );
      }

      await reload();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "FINANCE_ACCOUNT_MASTER_ARCHIVE_FAILED",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div>
        <div className="flex items-center gap-2">
          <Landmark className="h-5 w-5" />
          <h2 className="font-semibold text-gray-950 dark:text-white">
            Finans Hesapları
          </h2>
        </div>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Kasa, banka ve POS hesaplarını yönetin. Bakiye burada elle
          değiştirilmez; hareketlerden türetilir.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["CASH", "BANK", "POS"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setKind(value)}
            className={`rounded-lg border px-4 py-2 text-sm font-medium ${
              kind === value
                ? "border-gray-950 bg-gray-950 text-white dark:border-white dark:bg-white dark:text-gray-950"
                : "border-gray-300 text-gray-700 dark:border-gray-700 dark:text-gray-300"
            }`}
          >
            {value === "CASH" ? "Kasa" : value === "BANK" ? "Banka" : "POS"}
          </button>
        ))}
      </div>

      <div className="grid gap-3 rounded-xl border border-gray-200 p-4 dark:border-gray-800 md:grid-cols-2">
        <input
          aria-label="Ledger hesap kodu"
          value={common.ledgerCode}
          onChange={(event) =>
            setCommon((current) => ({
              ...current,
              ledgerCode: event.target.value,
            }))
          }
          placeholder="Muhasebe hesap kodu"
          className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-950"
        />
        <input
          aria-label="Ledger hesap adı"
          value={common.ledgerName}
          onChange={(event) =>
            setCommon((current) => ({
              ...current,
              ledgerName: event.target.value,
            }))
          }
          placeholder="Muhasebe hesap adı"
          className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-950"
        />
        <select
          aria-label="Para birimi"
          value={common.currency}
          onChange={(event) =>
            setCommon((current) => ({
              ...current,
              currency: event.target.value,
            }))
          }
          className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-950"
        >
          <option value="TRY">TRY</option>
          <option value="EUR">EUR</option>
          <option value="USD">USD</option>
        </select>

        {kind === "CASH" ? (
          <>
            <input
              aria-label="Kasa kodu"
              value={cash.code}
              onChange={(event) =>
                setCash((current) => ({
                  ...current,
                  code: event.target.value,
                }))
              }
              placeholder="Kasa kodu"
              className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-950"
            />
            <input
              aria-label="Kasa adı"
              value={cash.name}
              onChange={(event) =>
                setCash((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="Kasa adı"
              className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-950"
            />
          </>
        ) : null}

        {kind === "BANK" ? (
          <>
            <input
              aria-label="Banka kodu"
              value={bank.code}
              onChange={(event) =>
                setBank((current) => ({
                  ...current,
                  code: event.target.value,
                }))
              }
              placeholder="Banka hesap kodu"
              className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-950"
            />
            <input
              aria-label="Banka adı"
              value={bank.bankName}
              onChange={(event) =>
                setBank((current) => ({
                  ...current,
                  bankName: event.target.value,
                }))
              }
              placeholder="Banka adı"
              className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-950"
            />
            <input
              aria-label="Banka hesap adı"
              value={bank.accountName}
              onChange={(event) =>
                setBank((current) => ({
                  ...current,
                  accountName: event.target.value,
                }))
              }
              placeholder="Hesap adı"
              className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-950"
            />
            <input
              aria-label="Şube adı"
              value={bank.branchName}
              onChange={(event) =>
                setBank((current) => ({
                  ...current,
                  branchName: event.target.value,
                }))
              }
              placeholder="Şube"
              className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-950"
            />
            <input
              aria-label="IBAN"
              value={bank.iban}
              onChange={(event) =>
                setBank((current) => ({
                  ...current,
                  iban: event.target.value,
                }))
              }
              placeholder="IBAN"
              className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-950"
            />
            <input
              aria-label="Hesap numarası"
              value={bank.accountNumber}
              onChange={(event) =>
                setBank((current) => ({
                  ...current,
                  accountNumber: event.target.value,
                }))
              }
              placeholder="Hesap numarası"
              className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-950"
            />
          </>
        ) : null}

        {kind === "POS" ? (
          <>
            <input
              aria-label="POS kodu"
              value={pos.code}
              onChange={(event) =>
                setPos((current) => ({
                  ...current,
                  code: event.target.value,
                }))
              }
              placeholder="POS kodu"
              className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-950"
            />
            <input
              aria-label="POS adı"
              value={pos.name}
              onChange={(event) =>
                setPos((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="POS adı"
              className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-950"
            />
            <select
              aria-label="Bağlı banka hesabı"
              value={pos.bankAccountId}
              onChange={(event) =>
                setPos((current) => ({
                  ...current,
                  bankAccountId: event.target.value,
                }))
              }
              className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-950"
            >
              <option value="">Banka hesabı seçin</option>
              {activeBank.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.bank_name} · {account.account_name} ·{" "}
                  {account.currency}
                </option>
              ))}
            </select>
            <select
              aria-label="POS türü"
              value={pos.kind}
              onChange={(event) =>
                setPos((current) => ({
                  ...current,
                  kind: event.target.value as PosKind,
                }))
              }
              className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-950"
            >
              <option value="PHYSICAL">Fiziksel POS</option>
              <option value="VIRTUAL">Sanal POS</option>
              <option value="MOBILE">Mobil POS</option>
              <option value="PAYMENT_LINK">Ödeme Linki</option>
            </select>
            <input
              aria-label="Merchant numarası"
              value={pos.merchantNumber}
              onChange={(event) =>
                setPos((current) => ({
                  ...current,
                  merchantNumber: event.target.value,
                }))
              }
              placeholder="Merchant numarası"
              className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-950"
            />
            <input
              aria-label="Terminal numarası"
              value={pos.terminalNumber}
              onChange={(event) =>
                setPos((current) => ({
                  ...current,
                  terminalNumber: event.target.value,
                }))
              }
              placeholder="Terminal numarası"
              className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-950"
            />
          </>
        ) : null}

        <button
          type="button"
          onClick={createAccount}
          disabled={saving || !formReady()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-gray-950"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          HESAP OLUŞTUR
        </button>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 py-5 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Finans hesapları yükleniyor...
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <AccountList
            title="Kasalar"
            empty="Aktif kasa hesabı yok."
            rows={activeCash.map((account) => ({
              id: account.id,
              label: account.cash_name,
              detail: `${account.cash_code} · ${account.currency}`,
            }))}
            onArchive={(id, label) =>
              archiveAccount("CASH", id, label)
            }
            saving={saving}
          />
          <AccountList
            title="Bankalar"
            empty="Aktif banka hesabı yok."
            rows={activeBank.map((account) => ({
              id: account.id,
              label: `${account.bank_name} · ${account.account_name}`,
              detail: `${account.bank_code} · ${account.currency}${
                account.iban ? ` · ${account.iban}` : ""
              }`,
            }))}
            onArchive={(id, label) =>
              archiveAccount("BANK", id, label)
            }
            saving={saving}
          />
          <AccountList
            title="POS"
            empty="Aktif POS hesabı yok."
            rows={activePos.map((account) => ({
              id: account.id,
              label: account.pos_name,
              detail: `${account.pos_code} · ${account.kind} · ${account.currency}`,
            }))}
            onArchive={(id, label) =>
              archiveAccount("POS", id, label)
            }
            saving={saving}
          />
        </div>
      )}
    </section>
  );
}

function AccountList({
  title,
  empty,
  rows,
  onArchive,
  saving,
}: {
  title: string;
  empty: string;
  rows: Array<{ id: string; label: string; detail: string }>;
  onArchive: (id: string, label: string) => void;
  saving: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium dark:border-gray-800 dark:bg-gray-950">
        {title}
      </div>
      {rows.length === 0 ? (
        <div className="p-4 text-sm text-gray-500">{empty}</div>
      ) : (
        rows.map((row) => (
          <div
            key={row.id}
            className="flex items-start justify-between gap-3 border-b border-gray-100 p-4 last:border-b-0 dark:border-gray-800"
          >
            <div className="min-w-0">
              <div className="font-medium text-gray-950 dark:text-white">
                {row.label}
              </div>
              <div className="mt-1 break-all text-xs text-gray-500">
                {row.detail}
              </div>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => onArchive(row.id, row.label)}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs dark:border-gray-700"
            >
              <Archive className="h-3.5 w-3.5" />
              Pasif
            </button>
          </div>
        ))
      )}
    </div>
  );
}