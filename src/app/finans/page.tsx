"use client";

import { useEffect, useState } from "react";
import { Landmark } from "lucide-react";
import { selectFinanceReadModel } from "@/lib/finance/financeReadSelector";
import { useFinanceRuntimeContext } from "@/lib/finance/useFinanceRuntimeContext";
import { useSalesStore } from "@/store/salesStore";
import { FinanceAccessState } from "@/components/finance/FinanceAccessState";
import { FinanceIssueList } from "@/components/finance/FinanceIssueList";
import { FinanceSummaryCards } from "@/components/finance/FinanceSummaryCards";
import { FinanceTransactionTable } from "@/components/finance/FinanceTransactionTable";

const CURRENCY = "TRY";

export default function FinanceOverviewPage() {
  const runtime = useFinanceRuntimeContext();
  const sales = useSalesStore((state) => state.sales);
  const loadSales = useSalesStore((state) => state.loadSales);
  const isLoading = useSalesStore((state) => state.isLoading);
  const [projectionAt] = useState(() => new Date().toISOString());

  useEffect(() => {
    if (runtime.state !== "ready") {
      return;
    }

    void loadSales(runtime.scope);
  }, [loadSales, runtime]);

  if (runtime.state === "loading" || isLoading) {
    return <div className="p-8 text-center">Finans verileri doğrulanıyor…</div>;
  }

  if (runtime.state !== "ready") {
    return (
      <div className="mx-auto max-w-7xl">
        <FinanceAccessState reason={runtime.reason} />
      </div>
    );
  }

  const result = selectFinanceReadModel({
    scope: runtime.scope,
    packageType: runtime.packageType,
    permissions: runtime.permissions,
    requestedCapability: "BASIC_FINANCE",
    sales,
    projectionAt,
    currency: CURRENCY,
  });

  if (!result.accessDecision.allowed) {
    return (
      <div className="mx-auto max-w-7xl">
        <FinanceAccessState reason={result.accessDecision.reasonCode} />
      </div>
    );
  }

  const recentTransactions = [...result.transactions]
    .sort(
      (left, right) =>
        right.transactionDate.localeCompare(left.transactionDate) ||
        right.id.localeCompare(left.id),
    )
    .slice(0, 20);

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-24">
      <header className="flex items-center gap-3">
        <div className="rounded-xl bg-blue-50 p-3 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
          <Landmark className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-950 dark:text-white">
            Finans Genel Bakış
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Satışlardan türetilen salt-okunur finans özeti
          </p>
        </div>
      </header>

      <FinanceSummaryCards summary={result.summary} currency={CURRENCY} />
      <FinanceIssueList issues={result.issues} />

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-200 p-5 dark:border-gray-800">
          <h2 className="font-semibold text-gray-950 dark:text-white">
            Son finans hareketleri
          </h2>
        </div>
        <FinanceTransactionTable
          transactions={recentTransactions}
          currency={CURRENCY}
        />
      </section>
    </div>
  );
}
