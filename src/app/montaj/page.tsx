"use client";

import {
  Calendar,
  MapPin,
  Shield
} from "lucide-react";
import {
  useMemo,
  useSyncExternalStore
} from "react";
import {
  useAuthStore
} from "@/store/useAuthStore";
import {
  useOperationsStore
} from "@/store/useOperationsStore";
import {
  useErpRuntimeContext
} from "@/lib/useErpRuntimeContext";
import type {
  OperationRecord,
  OperationStatus
} from "@/lib/operationsWorkflow";
import {
  createAutomaticInstallationEarning
} from "@/lib/installationCompletionEarningsCoordinator";
import {
  useSalesStore
} from "@/store/salesStore";
import {
  useServiceRateStore
} from "@/store/useServiceRateStore";
import {
  useStore
} from "@/store/useStore";

const subscribeToHydration =
  () => () => undefined;

const getClientSnapshot =
  () => true;

const getServerSnapshot =
  () => false;

const NEXT_STATUS: Partial<
  Record<
    OperationStatus,
    OperationStatus
  >
> = {
  DRAFT: "ASSIGNED",
  ASSIGNED: "SENT",
  SENT: "ACCEPTED",
  ACCEPTED: "IN_PROGRESS",
  IN_PROGRESS: "COMPLETED",
  PROBLEM: "IN_PROGRESS"
};

function statusLabel(
  status: OperationStatus
): string {
  switch (status) {
    case "DRAFT":
      return "Taslak";
    case "ASSIGNED":
      return "Atandı";
    case "SENT":
      return "Gönderildi";
    case "ACCEPTED":
      return "Kabul Edildi";
    case "IN_PROGRESS":
      return "Montajda";
    case "COMPLETED":
      return "Tamamlandı";
    case "PROBLEM":
      return "Sorun Var";
    case "CANCELLED":
      return "İptal";
  }
}

function formatDateTime(
  value: string
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("tr-TR", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

export default function MontajPage() {
  const mounted =
    useSyncExternalStore(
      subscribeToHydration,
      getClientSnapshot,
      getServerSnapshot
    );

  const {
    scope,
    loading: scopeLoading,
    error: scopeError
  } = useErpRuntimeContext();

  const currentUser =
    useAuthStore(
      state => state.currentUser
    );

  const operations =
    useOperationsStore(
      state => state.operations
    );

  const getVisibleOperations =
    useOperationsStore(
      state => state.getVisibleOperations
    );

  const updateStatus =
    useOperationsStore(
      state => state.updateStatus
    );



  const sales =
    useSalesStore(
      state => state.sales
    );

  const products =
    useStore(
      state => state.products
    );

  const rates =
    useServiceRateStore(
      state => state.rates
    );

  const visibleInstallationOperations =
    useMemo(() => {
      void operations;

      if (
        !scope ||
        !currentUser
      ) {
        return [];
      }

      return getVisibleOperations(
        scope,
        {
          userId: currentUser.id,
          role: currentUser.role
        }
      )
        .filter(
          operation =>
            operation.kind ===
              "INSTALLATION" &&
            operation.status !==
              "CANCELLED"
        )
        .sort(
          (left, right) =>
            left.dueAt.localeCompare(
              right.dueAt
            )
        );
    }, [
      operations,
      scope,
      currentUser,
      getVisibleOperations
    ]);

  if (!mounted) {
    return (
      <div className="p-8 text-center text-gray-500">
        Yükleniyor...
      </div>
    );
  }

  if (scopeLoading) {
    return (
      <div className="p-8 text-center text-gray-500">
        Şirket kapsamı yükleniyor...
      </div>
    );
  }

  if (
    scopeError ||
    !scope
  ) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        Aktif şirket / şube / dönem kapsamı yüklenemedi.
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        Aktif kullanıcı bulunamadı.
      </div>
    );
  }

  const handleAdvance = (
    operation: OperationRecord
  ) => {
    const nextStatus =
      NEXT_STATUS[
        operation.status
      ];

    if (!nextStatus) {
      window.alert(
        "Bu montaj işi için sonraki durum bulunmuyor."
      );
      return;
    }

    const result =
      updateStatus(
        operation.id,
        nextStatus,
        {
          userId: currentUser.id,
          role: currentUser.role
        },
        new Date().toISOString()
      );

    if (
      result.outcome !==
      "UPDATED"
    ) {
      window.alert(
        `Montaj durumu değiştirilemedi: ${
          result.outcome === "REJECTED"
            ? result.reason
            : "İş bulunamadı"
        }`
      );
      return;
    }

    if (
      nextStatus !==
      "COMPLETED"
    ) {
      return;
    }

    const completedOperation =
      result.state.operations.find(
        item =>
          item.id ===
          operation.id
      );

    if (!completedOperation) {
      window.alert(
        "Montaj tamamlandı ancak tamamlanan operasyon kaydı tekrar okunamadı."
      );
      return;
    }

    if (
      completedOperation.party
        ?.assignmentType ===
      "INTERNAL"
    ) {
      window.alert(
        "Montaj tamamlandı. Şirket içi montaj olduğu için dış provider hakedişi oluşturulmadı."
      );
      return;
    }

    const earningResult =
      createAutomaticInstallationEarning({
        operation:
          completedOperation,
        sale:
          sales.find(
            sale =>
              sale.id ===
              completedOperation.saleId
          ),
        products,
        rates,
        ledger: {
          entries:
            useOperationsStore
              .getState()
              .providerEarningsEntries,
          paymentSnapshots:
            useOperationsStore
              .getState()
              .providerPaymentSnapshots
        }
      });

    if (
      earningResult.outcome ===
      "REJECTED"
    ) {
      window.alert(
        `Montaj tamamlandı. Hakediş otomatik hesaplanamadı: ${earningResult.reason}`
      );
      return;
    }

    if (
      earningResult.outcome ===
      "INTERNAL_NO_EARNINGS"
    ) {
      return;
    }

    const registerResult =
      useOperationsStore
        .getState()
        .registerAutomaticProviderEarning({
          operation:
            completedOperation,
          amount:
            earningResult.amount,
          occurredAt:
            completedOperation
              .completedAt as string,
          actorUserId:
            currentUser.id
        });

    if (
      registerResult.outcome !==
        "UPDATED" &&
      registerResult.outcome !==
        "REPLAY"
    ) {
      window.alert(
        `Montaj tamamlandı. Hakediş kaydı oluşturulamadı: ${
          registerResult.outcome ===
          "REJECTED"
            ? registerResult.reason
            : "Kayıt bulunamadı"
        }`
      );
      return;
    }

    window.alert(
      `Montaj tamamlandı. Dış montajcı hakedişi ${earningResult.amount.toFixed(
        2
      )} TRY olarak tamamlanma tarihindeki tarifeden kesinleştirildi.`
    );
  };

  return (
    <main className="space-y-3">
      <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
              Montaj
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Atanmış montaj işlerini tarih, ekip ve durum bilgisiyle takip edin.
            </p>
          </div>

          <div className="rounded-lg bg-slate-50 px-4 py-2 text-center dark:bg-slate-800">
            <div className="text-lg font-black text-slate-950 dark:text-white">
              {visibleInstallationOperations.length}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Montaj İşi
            </div>
          </div>
        </div>
      </header>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {visibleInstallationOperations.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-base font-bold text-slate-900 dark:text-white">
              Aktif montaj işi bulunmuyor
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Size veya şirketinize atanmış montaj işi olduğunda burada görünecek.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-3">Satış</th>
                    <th className="px-3 py-3">Cari</th>
                    <th className="px-3 py-3">Montajcı / Ekip</th>
                    <th className="px-3 py-3">Plan</th>
                    <th className="px-3 py-3">Adres</th>
                    <th className="px-3 py-3">Durum</th>
                    <th className="px-3 py-3 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleInstallationOperations.map(operation => {
                    const nextStatus =
                      NEXT_STATUS[
                        operation.status
                      ];

                    return (
                      <tr
                        key={operation.id}
                        className="border-t border-slate-200 align-middle hover:bg-slate-50/70 dark:border-slate-800 dark:hover:bg-slate-800/40"
                      >
                        <td className="px-3 py-3 font-bold text-slate-950 dark:text-white">
                          {operation.saleId}
                        </td>

                        <td className="px-3 py-3">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {operation.customerName}
                          </div>
                          <div className="mt-0.5 max-w-[260px] truncate text-xs text-slate-500">
                            {operation.title}
                          </div>
                        </td>

                        <td className="px-3 py-3">
                          <div className="font-semibold">
                            {operation.party?.name ??
                              "Atama bekliyor"}
                          </div>
                          {operation.party?.assignmentType ? (
                            <div className="mt-0.5 text-xs text-slate-500">
                              {operation.party.assignmentType ===
                              "INTERNAL"
                                ? "Şirket içi"
                                : "Dış montajcı"}
                            </div>
                          ) : null}
                        </td>

                        <td className="px-3 py-3 tabular-nums text-slate-600 dark:text-slate-300">
                          {formatDateTime(
                            operation.scheduledAt
                          )}
                        </td>

                        <td className="px-3 py-3">
                          {operation.address ? (
                            <a
                              href={`https://maps.google.com/?q=${encodeURIComponent(
                                operation.address
                              )}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex max-w-[260px] items-center gap-1.5 truncate text-blue-700 hover:underline dark:text-blue-300"
                            >
                              <MapPin className="h-4 w-4 shrink-0" />
                              <span className="truncate">
                                {operation.address}
                              </span>
                            </a>
                          ) : (
                            <span className="text-slate-400">
                              -
                            </span>
                          )}
                        </td>

                        <td className="px-3 py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                              operation.status ===
                              "COMPLETED"
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : operation.status ===
                                    "PROBLEM"
                                  ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                                  : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                            }`}
                          >
                            {statusLabel(
                              operation.status
                            )}
                          </span>
                        </td>

                        <td className="px-3 py-3 text-right">
                          {nextStatus ? (
                            <button
                              type="button"
                              onClick={() =>
                                handleAdvance(
                                  operation
                                )
                              }
                              className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-700"
                            >
                              {nextStatus ===
                              "COMPLETED"
                                ? "Montajı Tamamla"
                                : `İlerle: ${statusLabel(
                                    nextStatus
                                  )}`}
                            </button>
                          ) : (
                            <span className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                              İş kapandı
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-800 md:hidden">
              {visibleInstallationOperations.map(operation => {
                const nextStatus =
                  NEXT_STATUS[
                    operation.status
                  ];

                return (
                  <article
                    key={operation.id}
                    className="p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-blue-700 dark:text-blue-300">
                          {operation.saleId}
                        </div>
                        <h2 className="mt-1 truncate text-base font-black text-slate-950 dark:text-white">
                          {operation.customerName}
                        </h2>
                      </div>

                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          operation.status ===
                          "COMPLETED"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : operation.status ===
                                "PROBLEM"
                              ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                              : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                        }`}
                      >
                        {statusLabel(
                          operation.status
                        )}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-2">
                      <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/70">
                        <div className="flex items-center gap-2 text-sm font-bold">
                          <Shield className="h-4 w-4 text-emerald-600" />
                          {operation.party?.name ??
                            "Atama bekliyor"}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                          <Calendar className="h-4 w-4" />
                          {formatDateTime(
                            operation.scheduledAt
                          )}
                        </div>
                      </div>

                      {operation.address ? (
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(
                            operation.address
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                        >
                          <MapPin className="h-4 w-4" />
                          Yol Tarifi
                        </a>
                      ) : null}

                      {nextStatus ? (
                        <button
                          type="button"
                          onClick={() =>
                            handleAdvance(
                              operation
                            )
                          }
                          className="min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white"
                        >
                          {nextStatus ===
                          "COMPLETED"
                            ? "Montajı Tamamla"
                            : `İlerle: ${statusLabel(
                                nextStatus
                              )}`}
                        </button>
                      ) : (
                        <div className="min-h-11 rounded-lg bg-emerald-50 px-4 py-3 text-center text-sm font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                          İş kapandı
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
