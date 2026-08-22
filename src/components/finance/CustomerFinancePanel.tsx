"use client";

import { useEffect, useState } from "react";

import { useFinanceRuntimeContext } from "@/lib/finance/useFinanceRuntimeContext";
import { selectFinanceReadModel } from "@/lib/finance/financeReadSelector";
import {
  calculateCustomerFinanceDashboard,
  type CustomerFinanceDashboard,
} from "@/lib/finance/customerFinanceDashboardService";
import { useSalesStore } from "@/store/salesStore";

import { FinanceAccessState } from "./FinanceAccessState";
import { FinanceIssueList } from "./FinanceIssueList";
import { FinanceTransactionTable } from "./FinanceTransactionTable";

interface CustomerFinancePanelProps {
  customerId: string;
  currency?: string;
}

function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
  }).format(value);
}

function riskLabel(dashboard: CustomerFinanceDashboard): string {
  if (dashboard.riskLevel === "RISKLI") {
    return "Gecikmiş borç var";
  }
  if (dashboard.riskLevel === "IZLE") {
    return "Bugün vadeli borç var";
  }
  return "Vade riski yok";
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
    if (runtime.state !== "ready") {
      return;
    }
    void loadSales(runtime.scope);
  }, [loadSales, runtime]);

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

  const financeCenterMirror = selectFinanceReadModel({
    scope: runtime.scope,
    packageType: runtime.packageType,
    permissions: runtime.permissions,
    requestedCapability: "CUSTOMER_FINANCE",
    sales,
    customerId,
    projectionAt,
    currency,
  });

  if (!financeCenterMirror.accessDecision.allowed) {
    return (
      <FinanceAccessState
        reason={financeCenterMirror.accessDecision.reasonCode}
      />
    );
  }

  const dashboardResult = calculateCustomerFinanceDashboard(
    financeCenterMirror.transactions,
    runtime.scope,
    customerId,
    currency,
    projectionAt.slice(0, 10),
  );

  if (dashboardResult.outcome === "REJECTED") {
    return <FinanceAccessState reason={dashboardResult.reason} />;
  }

  const dashboard = dashboardResult.dashboard;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-100">
        Bu alan Finans Merkezi&apos;ndeki bu müşteriye ait kayıtların
        salt okunur görünümüdür.
      </div>

      {financeCenterMirror.issues.length > 0 ? (
        <FinanceIssueList issues={financeCenterMirror.issues} />
      ) : null}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Toplam Borç / Satış
          </p>
          <p className="mt-2 text-2xl font-bold text-gray-950 dark:text-white">
            {formatMoney(dashboard.summary.debitTotal, currency)}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Tahsilat
          </p>
          <p className="mt-2 text-2xl font-bold text-gray-950 dark:text-white">
            {formatMoney(dashboard.summary.creditTotal, currency)}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Kalan Bakiye
          </p>
          <p className="mt-2 text-2xl font-bold text-gray-950 dark:text-white">
            {formatMoney(dashboard.summary.balance, currency)}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Vade Durumu
          </p>
          <p className="mt-2 text-lg font-bold text-gray-950 dark:text-white">
            {riskLabel(dashboard)}
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-200 p-5 dark:border-gray-800">
          <h3 className="font-semibold text-gray-950 dark:text-white">
            Finansal Hareketler
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Finans Merkezi&apos;ndeki bu müşteriye ait hareketler.
          </p>
        </div>

        <FinanceTransactionTable
          transactions={financeCenterMirror.transactions}
          currency={currency}
          emptyMessage="Bu cariye ait Finans Merkezi hareketi bulunamadı."
        />
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Gecikmiş
          </p>
          <p className="mt-2 text-xl font-bold text-gray-950 dark:text-white">
            {formatMoney(dashboard.due.overdueAmount, currency)}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Bugün Vadeli
          </p>
          <p className="mt-2 text-xl font-bold text-gray-950 dark:text-white">
            {formatMoney(dashboard.due.dueTodayAmount, currency)}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            İleri Vadeli
          </p>
          <p className="mt-2 text-xl font-bold text-gray-950 dark:text-white">
            {formatMoney(dashboard.due.futureAmount, currency)}
          </p>
        </div>
      </section>
    </div>
  );
}