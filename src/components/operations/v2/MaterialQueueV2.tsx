"use client";

import { useEffect, useMemo, useState } from "react";
import MaterialCutDecisionPanel from "@/components/operations/MaterialCutDecisionPanel";
import { canViewOperation } from "@/lib/operationAccessPolicy";
import { packageInputHasFeature } from "@/lib/packageFeatures";
import type { OperationRecord } from "@/lib/operationsWorkflow";
import { useErpRuntimeContext } from "@/lib/useErpRuntimeContext";
import { useAuthStore } from "@/store/useAuthStore";
import { useOperationsStore } from "@/store/useOperationsStore";
import { useSalesStore } from "@/store/salesStore";
import { useStore } from "@/store/useStore";

type MaterialQueueMode =
  | "CUT"
  | "PROCUREMENT";

export default function MaterialQueueV2({
  mode,
}: {
  mode: MaterialQueueMode;
}) {
  const {
    scope,
    packageName,
    loading: scopeLoading,
    error: scopeError,
  } = useErpRuntimeContext();
  const currentUser =
    useAuthStore(state => state.currentUser);
  const operations =
    useOperationsStore(
      state => state.operations,
    );
  const sales =
    useSalesStore(state => state.sales);
  const loadSales =
    useSalesStore(
      state => state.loadSales,
    );
  const customers =
    useStore(state => state.customers);

  const [
    selectedOperation,
    setSelectedOperation,
  ] =
    useState<OperationRecord | null>(
      null,
    );
  const [searchQuery, setSearchQuery] =
    useState("");

  useEffect(() => {
    if (!scope) {
      return;
    }

    void loadSales(scope);
  }, [loadSales, scope]);

  const mainOperations = useMemo(() => {
    if (!scope || !currentUser) {
      return [];
    }

    const query =
      searchQuery
        .trim()
        .toLocaleLowerCase("tr-TR");

    return operations
      .filter(
        operation =>
          operation.kind === "GENERAL" &&
          operation.status !==
            "CANCELLED" &&
          canViewOperation(
            operation,
            scope,
            {
              userId:
                currentUser.id,
              role:
                currentUser.role,
            },
          ),
      )
      .filter(operation => {
        if (!query) {
          return true;
        }

        const sale =
          sales.find(
            item =>
              item.id ===
              operation.saleId,
          );

        return [
          sale?.saleNo,
          operation.customerName,
          operation.title,
        ]
          .filter(Boolean)
          .some(value =>
            String(value)
              .toLocaleLowerCase(
                "tr-TR",
              )
              .includes(query),
          );
      })
      .sort((left, right) =>
        right.updatedAt.localeCompare(
          left.updatedAt,
        ),
      );
  }, [
    operations,
    scope,
    currentUser,
    searchQuery,
    sales,
  ]);

  const operationsAllowed =
    packageInputHasFeature(
      packageName,
      "operations",
    );

  if (
    !scopeLoading &&
    scope &&
    !operationsAllowed
  ) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
        Operasyonlar aktif pakete dahil değil.
      </div>
    );
  }

  if (
    scopeLoading ||
    (!scope && !scopeError)
  ) {
    return (
      <div className="p-8 text-center text-slate-500">
        Şirket kapsamı yükleniyor...
      </div>
    );
  }

  if (
    scopeError ||
    !scope ||
    !currentUser
  ) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
        Operasyon kapsamı yüklenemedi.
      </div>
    );
  }

  const title =
    mode === "CUT"
      ? "Kesim / Malzeme"
      : "Tedarik Siparişleri";
  const description =
    mode === "CUT"
      ? "Satış bazında stok optimizasyonu, lot seçimi ve kesim hazırlığı."
      : "Eksik malzeme siparişi ve ürün kabulü satış bazında merkezi tedarik akışından yönetilir.";
  const actionLabel =
    mode === "CUT"
      ? "Kesimi Yönet"
      : "Tedariki Yönet";

  return (
    <main className="space-y-3">
      <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-xl font-black text-slate-950 dark:text-white">
          {title}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {description}
        </p>

        {mode === "PROCUREMENT" ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            Global tedarik source truth için merkezi liste authority kanıtı olmadığı için bu ekran satış bazlı çalışır. Sipariş miktarı ve mal kabul gerçeği mevcut merkezi procurement authority üzerinden gelir.
          </div>
        ) : null}
      </header>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 p-3 dark:border-slate-800">
          <input
            value={searchQuery}
            onChange={event =>
              setSearchQuery(
                event.target.value,
              )
            }
            placeholder="Satış no veya cari ara..."
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950 sm:max-w-[430px]"
          />
        </div>

        {mainOperations.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Gösterilecek satış bazlı operasyon bulunamadı.
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[780px] text-left text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-3">
                      Satış No
                    </th>
                    <th className="px-3 py-3">
                      Cari
                    </th>
                    <th className="px-3 py-3">
                      Termin
                    </th>
                    <th className="px-3 py-3">
                      Son İşlem
                    </th>
                    <th className="px-3 py-3 text-right">
                      İşlem
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {mainOperations.map(
                    operation => {
                      const sale =
                        sales.find(
                          item =>
                            item.id ===
                            operation.saleId,
                        );

                      return (
                        <tr
                          key={
                            operation.id
                          }
                          className="border-t border-slate-200 dark:border-slate-800"
                        >
                          <td className="px-3 py-3 font-bold">
                            {sale?.saleNo ??
                              operation.saleId}
                          </td>
                          <td className="px-3 py-3">
                            {
                              operation.customerName
                            }
                          </td>
                          <td className="px-3 py-3 tabular-nums text-slate-500">
                            {new Date(
                              operation.dueAt,
                            ).toLocaleDateString(
                              "tr-TR",
                            )}
                          </td>
                          <td className="px-3 py-3 text-xs text-slate-500">
                            {new Date(
                              operation.updatedAt,
                            ).toLocaleString(
                              "tr-TR",
                            )}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedOperation(
                                  operation,
                                )
                              }
                              className={`rounded-lg px-3 py-2 text-xs font-black ${
                                mode ===
                                "CUT"
                                  ? "bg-indigo-600 text-white"
                                  : "bg-amber-500 text-slate-950"
                              }`}
                            >
                              {
                                actionLabel
                              }
                            </button>
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-800 md:hidden">
              {mainOperations.map(
                operation => {
                  const sale =
                    sales.find(
                      item =>
                        item.id ===
                        operation.saleId,
                    );

                  return (
                    <article
                      key={operation.id}
                      className="p-3"
                    >
                      <div className="text-xs font-bold text-blue-700 dark:text-blue-300">
                        {sale?.saleNo ??
                          operation.saleId}
                      </div>
                      <div className="mt-1 text-base font-black">
                        {
                          operation.customerName
                        }
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Termin:{" "}
                        {new Date(
                          operation.dueAt,
                        ).toLocaleDateString(
                          "tr-TR",
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setSelectedOperation(
                            operation,
                          )
                        }
                        className={`mt-3 min-h-11 w-full rounded-lg px-4 text-sm font-black ${
                          mode === "CUT"
                            ? "bg-indigo-600 text-white"
                            : "bg-amber-500 text-slate-950"
                        }`}
                      >
                        {actionLabel}
                      </button>
                    </article>
                  );
                },
              )}
            </div>
          </>
        )}
      </section>

      {selectedOperation ? (
        <MaterialCutDecisionPanel
          operation={
            selectedOperation
          }
          sale={sales.find(
            sale =>
              sale.id ===
              selectedOperation.saleId,
          )}
          currentUserId={
            currentUser.id
          }
          suppliers={customers
            .filter(
              customer =>
                customer.cariType ===
                  "SUPPLIER" &&
                customer.approvalStatus ===
                  "APPROVED" &&
                !customer.isDeleted &&
                !customer.isArchived &&
                customer.isActive !==
                  false &&
                !customer.isLockedForAllTransactions,
            )
            .map(customer => ({
              id: customer.id,
              name: customer.name,
              phone:
                customer.phone ||
                undefined,
            }))}
          onClose={() =>
            setSelectedOperation(null)
          }
        />
      ) : null}
    </main>
  );
}
