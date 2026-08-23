"use client";

import { useEffect, useMemo, useState } from "react";

import { useFinanceRuntimeContext } from "@/lib/finance/useFinanceRuntimeContext";
import { selectFinanceReadModel } from "@/lib/finance/financeReadSelector";
import { readCustomerReceivableSnapshot } from "@/lib/finance/customerReceivableReadClient";
import type { CustomerReceivableSnapshot } from "@/lib/finance/customerReceivableReadContracts";
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

function financeSourceLabel(source: string): string {
  switch (source) {
    case "SALE":
      return "Satış";
    case "SALE_PAYMENT":
      return "Satış Tahsilatı";
    case "SALE_RETURN":
      return "Satış İadesi";
    case "OPENING_BALANCE":
      return "Devir / Açılış Bakiyesi";
    case "MANUAL":
      return "Manuel Finans İşlemi";
    default:
      return source.replaceAll("_", " ");
  }
}

function riskLabel(snapshot: CustomerReceivableSnapshot): string {
  if (snapshot.due.overdueAmount > 0) {
    return "Gecikmiş borç var";
  }
  if (snapshot.due.dueTodayAmount > 0) {
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
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [canonicalSnapshot, setCanonicalSnapshot] =
    useState<CustomerReceivableSnapshot | null>(null);
  const [canonicalState, setCanonicalState] =
    useState<"IDLE" | "LOADING" | "READY" | "ERROR">("IDLE");
  const [canonicalError, setCanonicalError] = useState<string | null>(null);

  const saleById = useMemo(
    () => new Map(sales.map((sale) => [sale.id, sale] as const)),
    [sales],
  );

  const selectedSale =
    selectedSaleId === null ? null : saleById.get(selectedSaleId) ?? null;

  useEffect(() => {
    if (runtime.state !== "ready") {
      return;
    }
    void loadSales(runtime.scope);
  }, [loadSales, runtime]);
  useEffect(() => {
    if (runtime.state !== "ready") {
      setCanonicalSnapshot(null);
      setCanonicalState("IDLE");
      setCanonicalError(null);
      return;
    }

    let cancelled = false;

    setCanonicalSnapshot(null);
    setCanonicalState("LOADING");
    setCanonicalError(null);

    void (async () => {
      try {
        const result = await readCustomerReceivableSnapshot(
          customerId,
          currency,
        );
        const snapshot = result;
        if (cancelled) {
          return;
        }

        setCanonicalSnapshot(snapshot);
        setCanonicalState("READY");
      } catch (error) {
        if (cancelled) {
          return;
        }

        setCanonicalSnapshot(null);
        setCanonicalState("ERROR");
        setCanonicalError(
          error instanceof Error
            ? error.message
            : "FINANCE_CUSTOMER_RECEIVABLE_READ_FAILED",
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [customerId, currency, runtime]);

  if (
    runtime.state === "loading" ||
    isLoading ||
    canonicalState === "LOADING"
  ) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
        Cari finans verileri doğrulanıyor…
      </div>
    );
  }

  if (runtime.state !== "ready") {
    return <FinanceAccessState reason={runtime.reason} />;
  }

  if (canonicalState === "ERROR" || !canonicalSnapshot) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-100">
        Cari finans merkezi kaydı okunamadı:{" "}
        {canonicalError || "FINANCE_CUSTOMER_RECEIVABLE_READ_FAILED"}
      </div>
    );
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

  const snapshot = canonicalSnapshot;
  const totalCollection =
    snapshot.summary.allocatedCollectionTotal +
    snapshot.summary.unallocatedCreditTotal;
return (
    <div className="space-y-6">
      <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-100">
        Finans merkezindeki merkezi kayıtlardan okunur. Bu alan bu müşteriye
        ait canonical cari finans kaydının salt okunur görünümüdür.
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
            {formatMoney(snapshot.summary.originalDebtTotal, currency)}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Tahsilat
          </p>
          <p className="mt-2 text-2xl font-bold text-gray-950 dark:text-white">
            {formatMoney(totalCollection, currency)}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Kalan Bakiye
          </p>
          <p className="mt-2 text-2xl font-bold text-gray-950 dark:text-white">
            {formatMoney(snapshot.summary.currentBalance, currency)}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Vade Durumu
          </p>
          <p className="mt-2 text-lg font-bold text-gray-950 dark:text-white">
            {riskLabel(snapshot)}
          </p>
        </div>
      </section>

      {snapshot.summary.unallocatedCreditTotal > 0 ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-100">
          Müşteri alacağı / fazla tahsilat:{" "}
          <strong>
            {formatMoney(snapshot.summary.unallocatedCreditTotal, currency)}
          </strong>
        </div>
      ) : null}

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
          documentHeader="Belge No"
          sourceHeader="İşlem Türü"
          getDocumentLabel={(transaction) =>
            saleById.get(transaction.saleId)?.saleNo ?? transaction.saleId
          }
          getSourceLabel={(transaction) =>
            financeSourceLabel(transaction.sourceDocumentType)
          }
          onDocumentClick={(transaction) => setSelectedSaleId(transaction.saleId)}
        />
      </section>

      {selectedSale ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Satış detayı ${selectedSale.saleNo}`}
          onClick={() => setSelectedSaleId(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-gray-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-5 dark:border-gray-800">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Satış Detayı — Salt Okunur
                </p>
                <h3 className="mt-1 text-xl font-bold text-gray-950 dark:text-white">
                  {selectedSale.saleNo}
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Durum: {selectedSale.status}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedSaleId(null)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Kapat
              </button>
            </div>

            <div className="p-5">
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
                    <tr>
                      <th className="px-4 py-3">Oda</th>
                      <th className="px-4 py-3">Ürün</th>
                      <th className="px-4 py-3 text-right">Miktar</th>
                      <th className="px-4 py-3 text-right">Birim Fiyat</th>
                      <th className="px-4 py-3 text-right">Tutar</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {selectedSale.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3">{item.roomName || "—"}</td>

                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {item.productType || "Ürün"}
                          </div>
                          {item.windowName ? (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {item.windowName}
                            </div>
                          ) : null}
                        </td>

                        <td className="px-4 py-3 text-right">
                          {Number(item.metricSize || 0).toLocaleString("tr-TR")}{" "}
                          {item.metricUnit || ""}
                          {Number(item.quantity || 1) !== 1
                            ? ` × ${Number(item.quantity || 1).toLocaleString("tr-TR")}`
                            : ""}
                        </td>

                        <td className="px-4 py-3 text-right">
                          {formatMoney(Number(item.unitPrice || 0), currency)}
                        </td>

                        <td className="px-4 py-3 text-right font-semibold">
                          {formatMoney(Number(item.rowTotal || 0), currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 ml-auto grid max-w-md gap-2 text-sm">
                <div className="flex items-center justify-between border-b border-gray-100 py-2 dark:border-gray-800">
                  <span className="text-gray-500 dark:text-gray-400">
                    Satış Toplamı
                  </span>
                  <span className="font-semibold text-gray-950 dark:text-white">
                    {formatMoney(Number(selectedSale.totalAmount || 0), currency)}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-gray-100 py-2 dark:border-gray-800">
                  <span className="text-gray-500 dark:text-gray-400">
                    Tahsil Edilen
                  </span>
                  <span className="font-semibold text-gray-950 dark:text-white">
                    {formatMoney(
                      (selectedSale.payments ?? []).reduce(
                        (total, payment) => total + Number(payment.amount || 0),
                        0,
                      ),
                      currency,
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between py-2 text-base">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    Kalan
                  </span>
                  <span className="font-bold text-gray-950 dark:text-white">
                    {formatMoney(Number(selectedSale.remainingBalance || 0), currency)}
                  </span>
                </div>
              </div>

              <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100">
                Bu panel yalnız görüntüleme içindir. Satış üzerinde değişiklik yapılamaz.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Gecikmiş
          </p>
          <p className="mt-2 text-xl font-bold text-gray-950 dark:text-white">
            {formatMoney(snapshot.due.overdueAmount, currency)}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Bugün Vadeli
          </p>
          <p className="mt-2 text-xl font-bold text-gray-950 dark:text-white">
            {formatMoney(snapshot.due.dueTodayAmount, currency)}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            İleri Vadeli
          </p>
          <p className="mt-2 text-xl font-bold text-gray-950 dark:text-white">
            {formatMoney(snapshot.due.futureAmount, currency)}
          </p>
        </div>
      </section>
    </div>
  );
}