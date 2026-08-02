"use client";

import {
  CheckCircle2,
  FileText,
  Plus,
  Search
} from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useState,
  useSyncExternalStore
} from "react";

import {
  getSaleStatusPresentation
} from "@/lib/saleStatusPresentation";
import {
  canApproveSpecificSale
} from "@/lib/saleApprovalAccess";
import {
  requestSaleStatusTransition
} from "@/lib/saleStatusTransitionService";
import {
  shouldSyncMainOperationForSaleStatus
} from "@/lib/saleOperationEligibility";
import {
  executeSalesFinanceOutboxRecord
} from "@/lib/finance/salesFinanceOutboxExecutor";
import {
  useErpRuntimeContext
} from "@/lib/useErpRuntimeContext";
import {
  useOperationsStore
} from "@/store/useOperationsStore";
import {
  type Sale,
  useSalesStore
} from "@/store/salesStore";
import {
  useAuthStore
} from "@/store/useAuthStore";
import {
  useStore
} from "@/store/useStore";
import {
  getVisibleSales
} from "@/lib/salesVisibility";

export default function SatisPage() {
  const { customers } = useStore();

  const {
    sales,
    loadSales,
    updateSaleWithFinanceOutbox,
    isLoading
  } = useSalesStore();

  const currentUser =
    useAuthStore(state => state.currentUser);

  const syncMainOperation =
    useOperationsStore(
      state => state.syncMainOperation
    );

  const {
    scope,
    loading: scopeLoading,
    error: scopeError
  } = useErpRuntimeContext();

  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );

  const [searchTerm, setSearchTerm] =
    useState("");

  const [approvingSaleId, setApprovingSaleId] =
    useState<string | null>(null);

  useEffect(() => {
    void loadSales();
  }, [loadSales]);

  const handleApproveSale = async (
    sale: Sale
  ) => {
    if (
      sale.status !== "TASLAK" &&
      sale.status !== "TEKLİF"
    ) {
      alert(
        "Yalnız taslak kayıt yetkili onayına gönderilebilir."
      );
      return;
    }

    if (
      !canApproveSpecificSale(
        currentUser,
        sale
      )
    ) {
      const ownDraft =
        !!currentUser?.id &&
        !!sale.createdByUserId &&
        currentUser.id ===
          sale.createdByUserId;

      alert(
        ownDraft
          ? "Maker-checker kuralı gereği kendi hazırladığınız satış taslağını kendiniz onaylayamazsınız."
          : "Bu kullanıcı satış onaylama yetkisine sahip değil."
      );
      return;
    }

    if (
      scopeLoading ||
      !scope ||
      scopeError
    ) {
      alert(
        "ERP şirket/şube/dönem kapsamı hazır değil. Onay işlemi başlatılmadı."
      );
      return;
    }

    if (sale.items.length === 0) {
      alert(
        "Ürün veya hizmet kalemi olmayan satış onaylanamaz."
      );
      return;
    }

    const customer =
      customers.find(
        item => item.id === sale.customerId
      );

    if (!customer) {
      alert(
        "Satışın bağlı olduğu cari kaydı bulunamadı."
      );
      return;
    }

    if (!currentUser?.id) {
      alert(
        "Aktif kullanıcı bilgisi bulunamadı."
      );
      return;
    }

    if (
      !window.confirm(
        `${sale.saleNo} numaralı satış taslağı ONAYLANDI durumuna geçirilecek.\n\nOnaylayan: ${currentUser.name}\n\nBu işlem finans ve operasyon zincirini başlatır. Devam edilsin mi?`
      )
    ) {
      return;
    }

    setApprovingSaleId(sale.id);

    try {
      const now =
        new Date().toISOString();

      const transition =
        requestSaleStatusTransition({
          saleId: sale.id,
          fromStatus: sale.status,
          toStatus: "ONAYLANDI",
          actorUserId: currentUser.id,
          occurredAt: now,
          reason:
            "Satış listesi yetkili onayı"
        });

      if (
        transition.outcome ===
        "REJECTED"
      ) {
        throw new Error(
          `SALE_STATUS_TRANSITION_REJECTED:${transition.reason}`
        );
      }

      const approvedSale: Sale = {
        ...sale,
        status: "ONAYLANDI",
        updatedAt: now
      };

      const financeOutboxRecord =
        await updateSaleWithFinanceOutbox(
          approvedSale,
          scope,
          "TRY",
          transition.audit
        );

      if (
        shouldSyncMainOperationForSaleStatus(
          approvedSale.status
        )
      ) {
        const operationResult =
          syncMainOperation({
            scope,
            sale: approvedSale,
            customer: {
              id: customer.id,
              name: customer.name,
              phone: customer.phone || "",
              address:
                customer.address || ""
            },
            createdByUserId:
              currentUser.id
          });

        if (
          operationResult.outcome ===
          "REJECTED"
        ) {
          throw new Error(
            `MAIN_OPERATION_REJECTED:${operationResult.reason}`
          );
        }
      }

      const financeResult =
        await executeSalesFinanceOutboxRecord(
          financeOutboxRecord
        );

      await loadSales();

      if (
        financeResult.outcome ===
        "ERROR"
      ) {
        alert(
          "Satış ONAYLANDI olarak kaydedildi ancak merkezi finans kuyruğu tamamlanamadı. Güvenli kuyrukta tekrar denenebilir."
        );
        return;
      }

      alert(
        "Satış onaylandı. Finans ve operasyon zinciri başlatıldı."
      );
    }
    catch (error) {
      console.error(
        "[Sales Approval] Liste üzerinden satış onayı tamamlanamadı.",
        error
      );

      alert(
        error instanceof Error
          ? `Satış onayı tamamlanamadı: ${error.message}`
          : "Satış onayı tamamlanamadı."
      );

      await loadSales();
    }
    finally {
      setApprovingSaleId(null);
    }
  };

  if (!mounted || isLoading) {
    return (
      <div className="p-8 text-center">
        Yükleniyor...
      </div>
    );
  }

  const enrichedSales =
    getVisibleSales(
      currentUser,
      sales
    )
      .map(sale => ({
        ...sale,
        customerName:
          customers.find(
            customer =>
              customer.id ===
              sale.customerId
          )?.name ||
          "Silinmiş Müşteri"
      }))
      .filter(
        sale =>
          sale.saleNo
            .toLowerCase()
            .includes(
              searchTerm.toLowerCase()
            ) ||
          sale.customerName
            .toLowerCase()
            .includes(
              searchTerm.toLowerCase()
            )
      );

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-24">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold heading-title">
            Satışlar & Taslaklar
          </h1>
          <p className="text-sm heading-subtitle">
            Müşterilere ait taslak, sipariş ve satış kayıtları
          </p>
        </div>

        <Link
          href="/satis/yeni"
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-700 sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          Merkezi Satış Taslağı
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Satış No veya Müşteri Ara..."
              value={searchTerm}
              onChange={event =>
                setSearchTerm(
                  event.target.value
                )
              }
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
            />
          </div>
        </div>

        <div>
          <table className="block w-full text-left text-sm sm:table">
            <thead className="hidden bg-gray-50 font-medium text-gray-500 dark:bg-gray-800/50 dark:text-gray-400 sm:table-header-group">
              <tr>
                <th className="px-6 py-4">
                  Satış No
                </th>
                <th className="px-6 py-4">
                  Tarih
                </th>
                <th className="px-6 py-4">
                  Müşteri
                </th>
                <th className="px-6 py-4">
                  Durum
                </th>
                <th className="px-6 py-4 text-right">
                  Kalan Bakiye
                </th>
                <th className="px-6 py-4 text-center">
                  İşlem
                </th>
              </tr>
            </thead>

            <tbody className="block space-y-3 p-3 sm:table-row-group sm:space-y-0 sm:p-0 sm:divide-y sm:divide-gray-200 dark:sm:divide-gray-800">
              {enrichedSales.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-8 text-center text-gray-500 dark:text-gray-400"
                  >
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                enrichedSales.map(sale => {
                  const presentation =
                    getSaleStatusPresentation(
                      sale.status
                    );

                  const canApprove =
                    (
                      sale.status ===
                        "TASLAK" ||
                      sale.status ===
                        "TEKLİF"
                    ) &&
                    canApproveSpecificSale(
                      currentUser,
                      sale
                    );

                  const isApproving =
                    approvingSaleId ===
                    sale.id;

                  return (
                    <tr
                      key={sale.id}
                      className="block overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800/50 sm:table-row sm:rounded-none sm:border-0 sm:shadow-none"
                    >
                      <td className="relative block border-b border-gray-100 py-3 pl-7 pr-4 font-bold text-gray-900 dark:border-gray-800 dark:text-white sm:table-cell sm:border-0 sm:py-4 sm:pr-6">
                        <div
                          aria-hidden="true"
                          className={`absolute bottom-1.5 left-0 top-1.5 w-1 rounded-r-md ${presentation.stripColorClass}`}
                        />
                        {sale.saleNo}
                      </td>

                      <td className="flex items-center justify-between px-4 py-2 text-gray-600 dark:text-gray-400 sm:table-cell sm:px-6 sm:py-4">
                        <span className="text-xs font-semibold text-gray-400 sm:hidden">Tarih</span>
                        {new Date(
                          sale.createdAt
                        ).toLocaleDateString(
                          "tr-TR"
                        )}
                      </td>

                      <td className="flex items-center justify-between px-4 py-2 font-medium text-gray-900 dark:text-gray-200 sm:table-cell sm:px-6 sm:py-4">
                        <span className="text-xs font-semibold text-gray-400 sm:hidden">Müşteri</span>
                        {sale.customerName}
                      </td>

                      <td className="flex items-center justify-between px-4 py-2 sm:table-cell sm:px-6 sm:py-4">
                        <span className="text-xs font-semibold text-gray-400 sm:hidden">Durum</span>
                        {canApprove ? (
                          <button
                            type="button"
                            onClick={() =>
                              void handleApproveSale(
                                sale
                              )
                            }
                            disabled={isApproving}
                            title="Taslağı yetkili olarak onayla"
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold transition-opacity hover:opacity-80 disabled:cursor-wait disabled:opacity-50 ${presentation.badgeClass}`}
                          >
                            {presentation.label}
                          </button>
                        ) : (
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${presentation.badgeClass}`}
                          >
                            {presentation.label}
                          </span>
                        )}
                      </td>

                      <td className="flex items-center justify-between px-4 py-2 text-right font-medium text-gray-900 dark:text-white sm:table-cell sm:px-6 sm:py-4">
                        <span className="text-xs font-semibold text-gray-400 sm:hidden">Kalan Bakiye</span>
                        {new Intl.NumberFormat(
                          "tr-TR",
                          {
                            style: "currency",
                            currency: "TRY"
                          }
                        ).format(
                          sale.remainingBalance ||
                            0
                        )}
                      </td>

                      <td className="block border-t border-gray-100 px-4 py-3 dark:border-gray-800 sm:table-cell sm:border-0 sm:px-6 sm:py-4">
                        <div className="flex items-center justify-end gap-2">
                          {canApprove && (
                            <button
                              type="button"
                              onClick={() =>
                                void handleApproveSale(
                                  sale
                                )
                              }
                              disabled={isApproving}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-50"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              {isApproving
                                ? "Onaylanıyor..."
                                : "Onayla"}
                            </button>
                          )}

                          <Link
                            href={`/satis/${sale.id}`}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-600 transition-colors hover:bg-blue-50 dark:border-blue-900 dark:hover:bg-blue-900/20"
                            title="Satış kaydını aç"
                          >
                            <FileText className="w-4 h-4" />
                            <span className="sm:hidden">Detayı Aç</span>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
