"use client";

import { useEffect, useMemo, useState } from "react";
import { Landmark, ShieldCheck } from "lucide-react";
import { useFinanceRuntimeContext } from "@/lib/finance/useFinanceRuntimeContext";
import { FinanceAccessState } from "@/components/finance/FinanceAccessState";
import { FinanceAccountManager } from "@/components/finance/FinanceAccountManager";
import FinanceOperationsPanel, {
  type FinanceSection,
} from "@/components/finance/FinanceOperationsPanel";
import {
  readFinanceOverviewSnapshot,
} from "@/lib/finance/financeOverviewReadClient";
import type {
  FinanceOverviewRecentTransaction,
  FinanceOverviewSnapshot,
} from "@/lib/finance/financeOverviewReadContracts";
import {
  canOpenFinanceCenter,
  canViewFinanceOverview,
  defaultFinanceSection,
  visibleFinanceSections,
} from "@/lib/finance/financeNavigationPolicy";

const CURRENCY = "TRY";

const FINANCE_SECTION_HASH: Record<FinanceSection, string> = {
  Tahsilat: "#tahsilat",
  Ödeme: "#odeme",
  Hesaplar: "#hesaplar",
  Raporlar: "#raporlar",
  "Devir / Açılış": "#devir-acilis",
};

function financeSectionFromHash(hash: string): FinanceSection | null {
  const entry = Object.entries(FINANCE_SECTION_HASH).find(
    ([, value]) => value === hash,
  );
  return entry ? (entry[0] as FinanceSection) : null;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: CURRENCY,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("tr-TR").format(parsed);
}

function transactionLabel(
  transaction: FinanceOverviewRecentTransaction,
): string {
  switch (transaction.transactionType) {
    case "COLLECTION":
      return "Tahsilat";
    case "PAYMENT":
      return "Ödeme";
    case "TRANSFER":
      return "Transfer";
    case "REFUND":
      return "İade";
    case "REVERSAL":
      return "Ters kayıt";
    case "SALE_CHARGE":
      return "Satış borcu";
    case "ADJUSTMENT":
      return "Düzeltme";
    default:
      return "Finans hareketi";
  }
}

function OverviewCard({
  title,
  value,
  detail,
}: {
  title: string;
  value: number;
  detail?: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </p>
      <p className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white">
        {formatMoney(value)}
      </p>
      {detail ? (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {detail}
        </p>
      ) : null}
    </article>
  );
}

function FinanceCanonicalOverview({
  snapshot,
}: {
  snapshot: FinanceOverviewSnapshot;
}) {
  const supplierPayable = Math.max(snapshot.payables.balance, 0);
  const supplierAdvance = Math.max(-snapshot.payables.balance, 0);
  const liquidTotal =
    snapshot.liquidity.cashBalance + snapshot.liquidity.bankBalance;

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <OverviewCard
          title="Müşteriden Alacak"
          value={snapshot.receivables.openBalance}
          detail={`${snapshot.receivables.openItemCount} açık kalem`}
        />
        <OverviewCard
          title="Müşteri Kredisi"
          value={snapshot.receivables.unallocatedCreditTotal}
          detail="Açık borca henüz bağlanmamış tahsilat"
        />
        <OverviewCard
          title="Tedarikçiye Borç"
          value={supplierPayable}
          detail={
            supplierAdvance > 0
              ? `Tedarikçi avansı: ${formatMoney(supplierAdvance)}`
              : "Tedarikçi / terzi / montajcı net borcu"
          }
        />
        <OverviewCard
          title="Kasa + Banka"
          value={liquidTotal}
          detail={`Kasa ${formatMoney(snapshot.liquidity.cashBalance)} · Banka ${formatMoney(snapshot.liquidity.bankBalance)}`}
        />
        <OverviewCard
          title="POS Bekleyen"
          value={snapshot.liquidity.posPendingAmount}
          detail="Henüz bankaya geçmemiş net POS tutarı"
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <OverviewCard
          title="Vadesi Geçen"
          value={snapshot.due.overdueAmount}
        />
        <OverviewCard
          title="Bugün Vadeli"
          value={snapshot.due.dueTodayAmount}
        />
        <OverviewCard
          title="İleri Vadeli"
          value={snapshot.due.futureAmount}
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-1 border-b border-slate-200 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold text-slate-950 dark:text-white">
              Son Finans Hareketleri
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Canonical finans kayıtlarındaki son 20 hareket
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {snapshot.recentTransactions.length} kayıt
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950/50 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Tarih</th>
                <th className="px-4 py-3">İşlem</th>
                <th className="px-4 py-3">Açıklama</th>
                <th className="px-4 py-3 text-right">Tutar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {snapshot.recentTransactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                  >
                    Henüz finans hareketi bulunmuyor.
                  </td>
                </tr>
              ) : (
                snapshot.recentTransactions.map((transaction) => (
                  <tr key={transaction.transactionId}>
                    <td className="whitespace-nowrap px-4 py-3">
                      {formatDate(transaction.transactionDate)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold">
                      {transactionLabel(transaction)}
                    </td>
                    <td className="max-w-xl truncate px-4 py-3 text-slate-600 dark:text-slate-300">
                      {transaction.description || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                      {formatMoney(transaction.netAmount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-right text-xs text-slate-400">
        Finans özeti: {new Intl.DateTimeFormat("tr-TR", {
          dateStyle: "short",
          timeStyle: "short",
        }).format(new Date(snapshot.asOf))}
      </p>
    </div>
  );
}

export default function FinanceOverviewPage() {
  const runtime = useFinanceRuntimeContext();
  const [activeSection, setActiveSection] =
    useState<FinanceSection | null>(null);
  const [hashReady, setHashReady] = useState(false);
  const [overviewSnapshot, setOverviewSnapshot] =
    useState<FinanceOverviewSnapshot | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState(false);

  const permissions = useMemo(
    () => (runtime.state === "ready" ? runtime.permissions : []),
    [runtime],
  );

  const allowedSections = useMemo(
    () => visibleFinanceSections(permissions),
    [permissions],
  );

  const overviewAllowed =
    runtime.state === "ready" &&
    canViewFinanceOverview(runtime.permissions);

  const financeCenterAllowed =
    runtime.state === "ready" &&
    canOpenFinanceCenter(runtime.permissions);

  useEffect(() => {
    if (runtime.state !== "ready") return;

    const syncSection = () => {
      const requested = financeSectionFromHash(window.location.hash);

      if (requested && allowedSections.includes(requested)) {
        setActiveSection(requested);
        setHashReady(true);
        return;
      }

      if (overviewAllowed) {
        setActiveSection(null);

        if (window.location.hash) {
          window.history.replaceState(
            null,
            "",
            `${window.location.pathname}${window.location.search}`,
          );
        }

        setHashReady(true);
        return;
      }

      const fallback = defaultFinanceSection(runtime.permissions);

      if (fallback && fallback !== "Genel Bakış") {
        const section = fallback as FinanceSection;
        const hash = FINANCE_SECTION_HASH[section];

        setActiveSection(section);

        if (window.location.hash !== hash) {
          window.history.replaceState(
            null,
            "",
            `${window.location.pathname}${window.location.search}${hash}`,
          );
        }
      } else {
        setActiveSection(null);
      }

      setHashReady(true);
    };

    syncSection();
    window.addEventListener("hashchange", syncSection);
    window.addEventListener("enverp:finance-section-change", syncSection);
    window.addEventListener("popstate", syncSection);

    let lastHash = window.location.hash;
    const hashObserver = window.setInterval(() => {
      if (window.location.hash === lastHash) return;
      lastHash = window.location.hash;
      syncSection();
    }, 100);

    return () => {
      window.removeEventListener("hashchange", syncSection);
      window.removeEventListener("enverp:finance-section-change", syncSection);
      window.removeEventListener("popstate", syncSection);
      window.clearInterval(hashObserver);
    };
  }, [
    allowedSections,
    overviewAllowed,
    runtime,
  ]);

  const changeSection = (section: FinanceSection | null) => {
    if (section === null && !overviewAllowed) {
      const fallback = defaultFinanceSection(
        runtime.state === "ready" ? runtime.permissions : [],
      );

      if (!fallback || fallback === "Genel Bakış") return;

      section = fallback as FinanceSection;
    }

    if (section !== null && !allowedSections.includes(section)) {
      return;
    }

    const nextHash = section ? FINANCE_SECTION_HASH[section] : "";
    const nextUrl =
      `${window.location.pathname}${window.location.search}${nextHash}`;

    window.history.pushState(null, "", nextUrl);
    window.dispatchEvent(new Event("enverp:finance-section-change"));
    setActiveSection(section);
  };

  useEffect(() => {
    if (runtime.state !== "ready" || !overviewAllowed) {
      return;
    }

    const controller = new AbortController();
    const overviewScope = runtime.scope;

    void (async () => {
      setOverviewLoading(true);
      setOverviewError(false);

      try {
        const snapshot = await readFinanceOverviewSnapshot(
          overviewScope,
          CURRENCY,
          { signal: controller.signal },
        );

        if (controller.signal.aborted) return;
        setOverviewSnapshot(snapshot);
      } catch {
        if (controller.signal.aborted) return;
        setOverviewSnapshot(null);
        setOverviewError(true);
      } finally {
        if (controller.signal.aborted) return;
        setOverviewLoading(false);
      }
    })();

    return () => controller.abort();
  }, [overviewAllowed, runtime]);

  if (runtime.state === "loading" || !hashReady) {
    return (
      <div className="p-8 text-center text-slate-500 dark:text-slate-400">
        Finans yetkileri doğrulanıyor…
      </div>
    );
  }

  if (runtime.state !== "ready") {
    return (
      <div className="mx-auto max-w-7xl">
        <FinanceAccessState reason={runtime.reason} />
      </div>
    );
  }

  if (!financeCenterAllowed) {
    return (
      <div className="mx-auto max-w-7xl">
        <FinanceAccessState
          reason="PERMISSION_DENIED"
          title="Finans erişimi bulunmuyor"
        />
      </div>
    );
  }

  const title =
    activeSection === null
      ? "Finans Genel Bakış"
      : `Finans · ${activeSection}`;

  const subtitle =
    activeSection === null
      ? "Seçili şirket, şube ve muhasebe dönemi finans özeti"
      : "Yetkiniz dahilindeki finans işlemlerini güvenli biçimde yönetin";

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 pb-24 text-slate-950 dark:text-slate-100">
      <header className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-blue-50 p-5 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/30 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-600 p-3 text-white shadow-sm shadow-blue-600/20">
              <Landmark className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
                ENVerp Finans
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">
                {title}
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {subtitle}
              </p>
            </div>
          </div>

          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Yetkili kapsam doğrulandı
          </div>
        </div>
      </header>

      {activeSection === null && overviewAllowed ? (
        overviewLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            Finans özeti hazırlanıyor…
          </div>
        ) : overviewError || !overviewSnapshot ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
            Finans özeti şu anda alınamadı. Lütfen yeniden deneyin.
          </div>
        ) : (
          <FinanceCanonicalOverview snapshot={overviewSnapshot} />
        )
      ) : null}

      <FinanceOperationsPanel
        activeSection={activeSection}
        onSectionChange={changeSection}
        scope={runtime.scope}
        permissions={runtime.permissions}
        overviewAllowed={overviewAllowed}
      />

      {activeSection === "Hesaplar" &&
      runtime.permissions.includes("finance.account.manage") ? (
        <FinanceAccountManager />
      ) : null}
    </div>
  );
}
