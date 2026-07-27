"use client";

import { useEffect, useState } from "react";
import { selectFinanceReadModel } from "@/lib/finance/financeReadSelector";
import { useFinanceRuntimeContext } from "@/lib/finance/useFinanceRuntimeContext";
import { useSalesStore } from "@/store/salesStore";
import { FinanceAccessState } from "./FinanceAccessState";
import { FinanceIssueList } from "./FinanceIssueList";
import { FinanceSummaryCards } from "./FinanceSummaryCards";
import { FinanceTransactionTable } from "./FinanceTransactionTable";

interface CustomerFinancePanelProps {
  customerId: string;
  currency?: string;
}

export function CustomerFinancePanel({
  customerId,
  currency = "TRY",
}: CustomerFinancePanelProps) {
  const runtime = useFinanceRuntimeContext();
  const sales = useSalesStore((state) => state.sales);
  const loadSales = useSalesStore((state) => state.loadSales);
  const isLoading = useSalesStore((state) => state.isLoading);
  const [projectionAt] = useState(() => new Date().toISOString());

  useEffect(() => {
    void loadSales();
  }, [loadSales]);

  if (runtime.state === "loading" || isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
        Cari finans verileri doğrulanıyor…
      </div>
    );
  }

  if (runtime.state !== "ready") {
    return <FinanceAccessState reason={runtime.reason} />;
  }

  const result = selectFinanceReadModel({
    scope: runtime.scope,
    packageType: runtime.packageType,
    permissions: runtime.permissions,
    requestedCapability: "CUSTOMER_FINANCE",
    sales,
    customerId,
    projectionAt,
    currency,
  });

  if (!result.accessDecision.allowed) {
    return (
      <FinanceAccessState reason={result.accessDecision.reasonCode} />
    );
  }

  return (
    <div className="space-y-5">
      <FinanceSummaryCards summary={result.summary} currency={currency} />
      <FinanceIssueList issues={result.issues} />
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-200 p-5 dark:border-gray-800">
          <h3 className="font-semibold text-gray-950 dark:text-white">
            Satış bazlı finans hareketleri
          </h3>
        </div>
        <FinanceTransactionTable
          transactions={result.transactions}
          currency={currency}
          emptyMessage="Bu cariye ait finans hareketi bulunamadı."
        />
      </section>
    </div>
  );
}
