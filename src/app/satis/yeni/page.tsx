"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/store/useStore";
import { useSalesStore } from "@/store/salesStore";
import { syncOrCreateDraftSale } from "@/lib/salesAdapter";
import { useAuthStore } from "@/store/useAuthStore";
import { useErpRuntimeContext } from "@/lib/useErpRuntimeContext";

export default function YeniSatisPage() {
  const router = useRouter();
  const { scope } = useErpRuntimeContext();
  const searchParams = useSearchParams();

  const customers = useStore(state => state.customers);

  const sales = useSalesStore(state => state.sales);
  const loadSales = useSalesStore(state => state.loadSales);
  const addSale = useSalesStore(state => state.addSale);
  const updateSale = useSalesStore(state => state.updateSale);

  const currentUser = useAuthStore(
    state => state.currentUser
  );

  const preselectedCustomerId =
    searchParams.get("customerId") || "";

  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );
  const [selectedCustomerId, setSelectedCustomerId] =
    useState(preselectedCustomerId);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!scope) {
      return;
    }

    void loadSales(scope);
  }, [loadSales, scope]);

  useEffect(() => {
    const selectionTimer = window.setTimeout(() => {
      if (preselectedCustomerId) {
        setSelectedCustomerId(preselectedCustomerId);
        return;
      }

      if (!selectedCustomerId && customers.length > 0) {
        setSelectedCustomerId(customers[0].id);
      }
    }, 0);

    return () => window.clearTimeout(selectionTimer);
  }, [
    customers,
    preselectedCustomerId,
    selectedCustomerId
  ]);

  const selectedCustomer = useMemo(
    () =>
      customers.find(
        customer => customer.id === selectedCustomerId
      ),
    [customers, selectedCustomerId]
  );

  const handleCreateDraft = async () => {
    if (isSaving) return;

    if (!selectedCustomer) {
      setMessage("Lütfen müşteri seçiniz.");
      return;
    }

    if (!currentUser) {
      setMessage(
        "Satışı yapan kullanıcı oturumu bulunamadı."
      );
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const saleId = await syncOrCreateDraftSale(
        selectedCustomer,
        {
          sales,
          addSale,
          updateSale
        },
        currentUser,
        scope
      );

      router.push(`/satis/${saleId}`);
    } catch (error) {
      console.error(
        "[Sales] Merkezi satış taslağı oluşturulamadı.",
        error
      );

      setMessage(
        "Merkezi satış taslağı oluşturulurken hata oluştu."
      );
      setIsSaving(false);
    }
  };

  if (!mounted) {
    return (
      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
        Yükleniyor...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 overflow-x-hidden px-4 pb-24 sm:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
        <Link
          href="/satis"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          aria-label="Satış listesine dön"
        >
          <ArrowLeft className="h-5 w-5 shrink-0" />
        </Link>

        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold heading-title break-words sm:text-2xl">
            Merkezi Satış Taslağı
          </h1>

          <p className="mt-1 text-sm heading-subtitle break-words text-gray-600 dark:text-gray-400">
            Ölçü ve ürün seçimlerini merkezi hesap kasasından
            satış taslağına aktarır.
          </p>
        </div>
      </header>

      <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900 sm:p-6">
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/60">
          <label className="mb-2 block text-sm font-semibold text-gray-900 dark:text-gray-100">
            Müşteri
          </label>

          {customers.length === 0 ? (
            <div className="text-sm font-medium text-red-600 dark:text-red-400">
              Önce müşteri eklemelisiniz.
            </div>
          ) : (
            <select
              value={selectedCustomerId}
              onChange={event =>
                setSelectedCustomerId(event.target.value)
              }
              className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            >
              {customers.map(customer => (
                <option
                  key={customer.id}
                  value={customer.id}
                >
                  {customer.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-sm leading-relaxed text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-200">
          Bu ekran bağımsız kumaş hesabı yapmaz. Ölçüde
          kaydedilmiş merkezi hesap sonuçlarını kullanır.
          Mevcut taslak varsa fiyat ve manuel satırlar korunarak
          güncellenir.
        </div>

        {message && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
          >
            {message}
          </div>
        )}

        <button
          type="button"
          onClick={handleCreateDraft}
          disabled={
            !selectedCustomer ||
            isSaving ||
            customers.length === 0
          }
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:bg-gray-400 disabled:text-gray-100 dark:bg-blue-700 dark:hover:bg-blue-600 dark:disabled:bg-gray-600 dark:disabled:text-gray-300"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              <span>Taslak hazırlanıyor...</span>
            </>
          ) : (
            <>
              <Save className="h-4 w-4 shrink-0" />
              <span>Merkezi Satış Taslağını Aç</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
