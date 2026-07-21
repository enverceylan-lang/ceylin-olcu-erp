"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/store/useStore";
import { useSalesStore } from "@/store/salesStore";
import { syncOrCreateDraftSale } from "@/lib/salesAdapter";

export default function YeniSatisPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const customers = useStore(state => state.customers);

  const sales = useSalesStore(state => state.sales);
  const loadSales = useSalesStore(state => state.loadSales);
  const addSale = useSalesStore(state => state.addSale);
  const updateSale = useSalesStore(state => state.updateSale);

  const preselectedCustomerId =
    searchParams.get("customerId") || "";

  const [mounted, setMounted] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] =
    useState(preselectedCustomerId);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    void loadSales();
  }, [loadSales]);

  useEffect(() => {
    if (preselectedCustomerId) {
      setSelectedCustomerId(preselectedCustomerId);
      return;
    }

    if (!selectedCustomerId && customers.length > 0) {
      setSelectedCustomerId(customers[0].id);
    }
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

    setIsSaving(true);
    setMessage(null);

    try {
      const saleId = await syncOrCreateDraftSale(
        selectedCustomer,
        {
          sales,
          addSale,
          updateSale
        }
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
      <div className="p-8 text-center text-gray-500">
        Yükleniyor...
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-24">
      <div className="flex items-center gap-4">
        <Link
          href="/satis"
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>

        <div>
          <h1 className="text-2xl font-bold heading-title">
            Merkezi Satış Taslağı
          </h1>

          <p className="text-sm heading-subtitle">
            Ölçü ve ürün seçimlerini merkezi hesap kasasından
            satış taslağına aktarır.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm space-y-5">
        <div>
          <label className="block text-sm font-medium mb-2">
            Müşteri
          </label>

          {customers.length === 0 ? (
            <div className="text-sm text-red-500">
              Önce müşteri eklemelisiniz.
            </div>
          ) : (
            <select
              value={selectedCustomerId}
              onChange={event =>
                setSelectedCustomerId(event.target.value)
              }
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-3"
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

        <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 p-4 text-sm">
          Bu ekran bağımsız kumaş hesabı yapmaz. Ölçüde
          kaydedilmiş merkezi hesap sonuçlarını kullanır.
          Mevcut taslak varsa fiyat ve manuel satırlar korunarak
          güncellenir.
        </div>

        {message && (
          <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">
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
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white px-5 py-3 rounded-lg font-semibold"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Taslak hazırlanıyor...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Merkezi Satış Taslağını Aç
            </>
          )}
        </button>
      </div>
    </div>
  );
}