"use client";

import {
  useEffect,
  useState
} from "react";

import {
  selectFinanceReadModel
} from "@/lib/finance/financeReadSelector";

import {
  useFinanceRuntimeContext
} from "@/lib/finance/useFinanceRuntimeContext";

import {
  calculateCustomerFinanceDashboard,
  type CustomerFinanceDashboard
} from "@/lib/finance/customerFinanceDashboardService";

import {
  listLocalFinanceTransactions
} from "@/lib/localFinanceDb";

import type {
  FinanceTransaction
} from "@/lib/finance/financeContracts";

import {
  useSalesStore
} from "@/store/salesStore";

import {
  FinanceAccessState
} from "./FinanceAccessState";

import {
  FinanceIssueList
} from "./FinanceIssueList";

import {
  FinanceTransactionTable
} from "./FinanceTransactionTable";

interface CustomerFinancePanelProps {
  customerId: string;
  currency?: string;
}

function formatMoney(
  value: number,
  currency: string
): string {
  return new Intl.NumberFormat(
    "tr-TR",
    {
      style: "currency",
      currency
    }
  ).format(value);
}

function riskLabel(
  dashboard:
    CustomerFinanceDashboard
): string {
  if (
    dashboard.riskLevel ===
    "RISKLI"
  ) {
    return "Gecikmiş borç var";
  }

  if (
    dashboard.riskLevel ===
    "IZLE"
  ) {
    return "Bugün vadeli borç var";
  }

  return "Vade riski yok";
}

export function CustomerFinancePanel({
  customerId,
  currency = "TRY"
}: CustomerFinancePanelProps) {
  const runtime =
    useFinanceRuntimeContext();

  const sales =
    useSalesStore(
      state => state.sales
    );

  const loadSales =
    useSalesStore(
      state => state.loadSales
    );

  const isLoading =
    useSalesStore(
      state => state.isLoading
    );

  const [projectionAt] =
    useState(
      () =>
        new Date().toISOString()
    );

  const [transactions, setTransactions] =
    useState<FinanceTransaction[]>([]);

  const [transactionsLoading, setTransactionsLoading] =
    useState(true);

  const [transactionsError, setTransactionsError] =
    useState<string | null>(null);

  useEffect(() => {
    if (runtime.state !== "ready") {
      return;
    }

    void loadSales(runtime.scope);
  }, [loadSales, runtime]);

  useEffect(() => {
    if (runtime.state !== "ready") {
      return;
    }

    let cancelled = false;

    listLocalFinanceTransactions(
      runtime.scope,
      customerId
    )
      .then(records => {
        if (cancelled) {
          return;
        }

        setTransactions(records);
        setTransactionsError(null);
      })
      .catch(error => {
        if (cancelled) {
          return;
        }

        setTransactionsError(
          error instanceof Error
            ? error.message
            : "Cari finans hareketleri okunamadı."
        );
      })
      .finally(() => {
        if (!cancelled) {
          setTransactionsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    runtime,
    customerId
  ]);

  if (
    runtime.state === "loading" ||
    isLoading ||
    transactionsLoading
  ) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
        Cari finans verileri doğrulanıyor…
      </div>
    );
  }

  if (runtime.state !== "ready") {
    return (
      <FinanceAccessState
        reason={runtime.reason}
      />
    );
  }

  const legacyResult =
    selectFinanceReadModel({
      scope: runtime.scope,
      packageType:
        runtime.packageType,
      permissions:
        runtime.permissions,
      requestedCapability: "CUSTOMER_FINANCE",
      sales,
      customerId,
      projectionAt,
      currency
    });

  if (
    !legacyResult
      .accessDecision.allowed
  ) {
    return (
      <FinanceAccessState
        reason={
          legacyResult
            .accessDecision
            .reasonCode
        }
      />
    );
  }

  if (transactionsError) {
    return (
      <FinanceAccessState
        reason={
          transactionsError
        }
        title="Cari finans kayıtları okunamadı"
      />
    );
  }

  const dashboardResult =
    calculateCustomerFinanceDashboard(
      transactions,
      runtime.scope,
      customerId,
      currency,
      projectionAt.slice(0, 10)
    );

  if (
    dashboardResult.outcome ===
    "REJECTED"
  ) {
    return (
      <FinanceAccessState
        reason={
          dashboardResult.reason
        }
        title="Cari Finans V1 hesaplanamadı"
      />
    );
  }

  const dashboard =
    dashboardResult.dashboard;

  const cards = [
    {
      label: "Cari Bakiye",
      value:
        formatMoney(
          dashboard.summary.balance,
          currency
        )
    },
    {
      label: "Toplam Borç",
      value:
        formatMoney(
          dashboard.summary.debitTotal,
          currency
        )
    },
    {
      label: "Toplam Alacak",
      value:
        formatMoney(
          dashboard.summary.creditTotal,
          currency
        )
    },
    {
      label: "Gecikmiş",
      value:
        formatMoney(
          dashboard.due.overdueAmount,
          currency
        )
    },
    {
      label: "Bugün Vadeli",
      value:
        formatMoney(
          dashboard.due.dueTodayAmount,
          currency
        )
    },
    {
      label: "Gelecek Vadeli",
      value:
        formatMoney(
          dashboard.due.futureAmount,
          currency
        )
    }
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-950 dark:text-white">
              Cari Finans V1
            </h2>

            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Bakiye, ekstre ve vade bilgileri merkezi finans hareketlerinden türetilir.
            </p>
          </div>

          <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
            {riskLabel(dashboard)}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map(card => (
            <article
              key={card.label}
              className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-950/40"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {card.label}
              </p>

              <p className="mt-2 text-xl font-bold text-gray-950 dark:text-white">
                {card.value}
              </p>
            </article>
          ))}
        </div>
      </section>

      <FinanceIssueList
        issues={legacyResult.issues}
      />

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-200 p-5 dark:border-gray-800">
          <h3 className="font-semibold text-gray-950 dark:text-white">
            Cari Ekstresi
          </h3>

          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Açılış: {formatMoney(
              dashboard.statement.openingBalance,
              currency
            )} · Kapanış: {formatMoney(
              dashboard.statement.closingBalance,
              currency
            )}
          </p>
        </div>

        <FinanceTransactionTable
          transactions={transactions}
          currency={currency}
          emptyMessage="Bu cariye ait merkezi finans hareketi bulunamadı."
        />
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-200 p-5 dark:border-gray-800">
          <h3 className="font-semibold text-gray-950 dark:text-white">
            Açık Vade Dağılımı
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-950/50 dark:text-gray-400">
              <tr>
                <th className="p-4">
                  Satış
                </th>
                <th className="p-4">
                  Vade
                </th>
                <th className="p-4">
                  Durum
                </th>
                <th className="p-4 text-right">
                  Açık Tutar
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {dashboard.due.lines.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="p-6 text-center text-gray-500 dark:text-gray-400"
                  >
                    Açık vadeli borç bulunmuyor.
                  </td>
                </tr>
              ) : (
                dashboard.due.lines.map(line => (
                  <tr
                    key={line.transactionId}
                    className="hover:bg-gray-50/70 dark:hover:bg-gray-800/30"
                  >
                    <td className="p-4 font-medium text-gray-900 dark:text-white">
                      {line.saleId || "—"}
                    </td>

                    <td className="p-4 text-gray-600 dark:text-gray-300">
                      {line.dueDate || "Vadesiz"}
                    </td>

                    <td className="p-4 text-gray-600 dark:text-gray-300">
                      {line.bucket}
                    </td>

                    <td className="p-4 text-right font-bold text-gray-900 dark:text-white">
                      {formatMoney(
                        line.remainingAmount,
                        currency
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}