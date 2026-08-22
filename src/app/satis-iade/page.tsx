"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useErpRuntimeContext } from "@/lib/useErpRuntimeContext";
import { loadLocalSaleReturns } from "@/lib/localSaleReturnsDb";
import type { SaleReturnDocument } from "@/lib/saleReturnService";
import { useSalesStore } from "@/store/salesStore";
import { getVisibleSales } from "@/lib/salesVisibility";
import { useAuthStore } from "@/store/useAuthStore";
import { useStore } from "@/store/useStore";

function money(
  value: number,
  currency: string,
): string {
  return new Intl.NumberFormat(
    "tr-TR",
    {
      style: "currency",
      currency,
    },
  ).format(value);
}

export default function SatisIadePage() {
  const { scope, loading: scopeLoading, error: scopeError } =
    useErpRuntimeContext();
  const { sales, loadSales } = useSalesStore();
  const { customers } = useStore();
  const currentUser =
    useAuthStore(state => state.currentUser);

  const [returns, setReturns] =
    useState<SaleReturnDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    if (!scope) {
      if (!scopeLoading) {
        setLoading(false);
      }
      return;
    }

    let cancelled = false;

    Promise.all([
      loadLocalSaleReturns(scope),
      loadSales(scope),
    ])
      .then(([loadedReturns]) => {
        if (cancelled) return;
        setReturns(
          [...loadedReturns].sort(
            (left, right) =>
              right.occurredAt.localeCompare(
                left.occurredAt,
              ),
          ),
        );
      })
      .catch(currentError => {
        if (cancelled) return;
        setError(
          currentError instanceof Error
            ? currentError.message
            : "Satış iade kayıtları yüklenemedi.",
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
  }, [scope, scopeLoading, loadSales]);

  const visibleSaleIds = useMemo(
    () =>
      new Set(
        getVisibleSales(
          currentUser,
          sales,
        ).map(sale => sale.id),
      ),
    [currentUser, sales],
  );
  const rows = useMemo(
    () =>
      returns.filter(saleReturn => visibleSaleIds.has(saleReturn.saleId)).map(saleReturn => {
        const sale = sales.find(
          currentSale =>
            currentSale.id ===
            saleReturn.saleId,
        );

        const customer = customers.find(
          currentCustomer =>
            currentCustomer.id ===
            saleReturn.customerId,
        );

        return {
          saleReturn,
          saleNo:
            sale?.saleNo ||
            saleReturn.saleId,
          customerName:
            customer?.name ||
            saleReturn.customerId,
        };
      }),
    [returns, sales, customers],
  );

  if (loading || scopeLoading) {
    return (
      <div className="p-8 text-center">
        Yükleniyor...
      </div>
    );
  }

  if (!scope) {
    return (
      <div className="p-8 text-center text-red-600">
        {scopeError ||
          "Aktif şirket / şube / dönem kapsamı bulunamadı."}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-24">
      <div>
        <h1 className="text-2xl font-bold heading-title">
          Satış İade
        </h1>
        <p className="text-sm heading-subtitle">
          Onaylı satışlardan oluşturulan iade belgeleri
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
            <tr>
              <th className="px-4 py-3">
                Tarih
              </th>
              <th className="px-4 py-3">
                Satış No
              </th>
              <th className="px-4 py-3">
                Müşteri
              </th>
              <th className="px-4 py-3">
                Durum
              </th>
              <th className="px-4 py-3 text-right">
                Tutar
              </th>
              <th className="px-4 py-3 text-right">
                İşlem
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  Satış iade kaydı bulunamadı.
                </td>
              </tr>
            ) : (
              rows.map(
                ({
                  saleReturn,
                  saleNo,
                  customerName,
                }) => (
                  <tr key={saleReturn.id}>
                    <td className="px-4 py-3">
                      {new Date(
                        saleReturn.occurredAt,
                      ).toLocaleDateString(
                        "tr-TR",
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {saleNo}
                    </td>
                    <td className="px-4 py-3">
                      {customerName}
                    </td>
                    <td className="px-4 py-3">
                      {saleReturn.status}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">
                      {money(
                        saleReturn.amount,
                        saleReturn.currency,
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/satis/${encodeURIComponent(
                          saleReturn.saleId,
                        )}`}
                        className="inline-flex min-h-10 items-center justify-center rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-blue-950/30"
                      >
                        Satışı Aç
                      </Link>
                    </td>
                  </tr>
                ),
              )
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-amber-700 dark:text-amber-300">
        Yeni iade, ilgili onaylı satışın detay ekranındaki
        İade Süreci bölümünden başlatılır.
      </p>
    </div>
  );
}
