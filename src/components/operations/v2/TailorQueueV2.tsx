"use client";

import { useMemo, useState } from "react";
import {
  getOperationStatusLabel,
} from "@/lib/operationOutputService";
import {
  useErpRuntimeContext,
} from "@/lib/useErpRuntimeContext";
import { packageInputHasFeature } from "@/lib/packageFeatures";
import {
  useAuthStore,
} from "@/store/useAuthStore";
import {
  useOperationsStore,
} from "@/store/useOperationsStore";

function formatDateTime(
  value: string,
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function TailorQueueV2() {
  const {
    scope,
    packageName,
    loading: scopeLoading,
    error: scopeError,
  } = useErpRuntimeContext();
  const currentUser =
    useAuthStore(
      state => state.currentUser,
    );
  const operations =
    useOperationsStore(
      state => state.operations,
    );
  const getVisibleOperations =
    useOperationsStore(
      state => state.getVisibleOperations,
    );
  const [searchQuery, setSearchQuery] =
    useState("");
  const [showCompleted, setShowCompleted] =
    useState(false);

  const tailorOperations =
    useMemo(() => {
      void operations;

      if (!scope || !currentUser) {
        return [];
      }

      const query =
        searchQuery
          .trim()
          .toLocaleLowerCase("tr-TR");

      return getVisibleOperations(
        scope,
        {
          userId: currentUser.id,
          role: currentUser.role,
        },
      )
        .filter(
          operation =>
            operation.kind === "TAILOR" &&
            operation.status !==
              "CANCELLED",
        )
        .filter(operation =>
          showCompleted
            ? true
            : operation.status !==
              "COMPLETED",
        )
        .filter(operation => {
          if (!query) {
            return true;
          }

          return [
            operation.customerName,
            operation.title,
            operation.party?.name,
            operation.saleId,
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
          left.dueAt.localeCompare(
            right.dueAt,
          ),
        );
    }, [
      operations,
      scope,
      currentUser,
      getVisibleOperations,
      searchQuery,
      showCompleted,
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
        Atölye işleri yükleniyor...
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
        Atölye kapsamı yüklenemedi.
      </div>
    );
  }

  return (
    <main className="space-y-3">
      <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-xl font-black text-slate-950 dark:text-white">
          Atölye
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Terziye yönlendirilmiş işleri sade bir kuyrukta takip edin.
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-2 border-b border-slate-200 p-3 dark:border-slate-800 sm:flex-row sm:items-center">
          <input
            value={searchQuery}
            onChange={event =>
              setSearchQuery(
                event.target.value,
              )
            }
            placeholder="Cari, satış veya terzi ara..."
            className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950 sm:max-w-[430px]"
          />

          <label className="flex min-h-10 items-center gap-2 text-sm text-slate-600 dark:text-slate-300 sm:ml-auto">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={event =>
                setShowCompleted(
                  event.target.checked,
                )
              }
            />
            Tamamlananları göster
          </label>
        </div>

        {tailorOperations.length ===
        0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Gösterilecek atölye işi bulunamadı.
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-3">
                      Satış
                    </th>
                    <th className="px-3 py-3">
                      Cari
                    </th>
                    <th className="px-3 py-3">
                      Terzi
                    </th>
                    <th className="px-3 py-3">
                      Durum
                    </th>
                    <th className="px-3 py-3">
                      Başlangıç
                    </th>
                    <th className="px-3 py-3">
                      Termin
                    </th>
                    <th className="px-3 py-3">
                      İş
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tailorOperations.map(
                    operation => (
                      <tr
                        key={operation.id}
                        className="border-t border-slate-200 dark:border-slate-800"
                      >
                        <td className="px-3 py-3 font-bold">
                          {
                            operation.saleId
                          }
                        </td>
                        <td className="px-3 py-3">
                          {
                            operation.customerName
                          }
                        </td>
                        <td className="px-3 py-3">
                          {operation.party
                            ?.name ??
                            "Atama bekliyor"}
                        </td>
                        <td className="px-3 py-3">
                          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                            {getOperationStatusLabel(
                              operation.status,
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-3 tabular-nums text-slate-500">
                          {formatDateTime(
                            operation.scheduledAt,
                          )}
                        </td>
                        <td className="px-3 py-3 tabular-nums text-slate-500">
                          {formatDateTime(
                            operation.dueAt,
                          )}
                        </td>
                        <td className="max-w-[320px] px-3 py-3">
                          <div className="truncate font-semibold">
                            {
                              operation.title
                            }
                          </div>
                          <div className="mt-1 truncate text-xs text-slate-500">
                            {operation.details.join(
                              " • ",
                            )}
                          </div>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-800 md:hidden">
              {tailorOperations.map(
                operation => (
                  <article
                    key={operation.id}
                    className="p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-blue-700 dark:text-blue-300">
                          {
                            operation.saleId
                          }
                        </div>
                        <div className="mt-1 truncate text-base font-black">
                          {
                            operation.customerName
                          }
                        </div>
                      </div>
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                        {getOperationStatusLabel(
                          operation.status,
                        )}
                      </span>
                    </div>

                    <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/70">
                      <div className="font-bold">
                        {operation.party?.name ??
                          "Atama bekliyor"}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Termin:{" "}
                        {formatDateTime(
                          operation.dueAt,
                        )}
                      </div>
                    </div>

                    <div className="mt-3 text-sm font-semibold">
                      {operation.title}
                    </div>
                  </article>
                ),
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
