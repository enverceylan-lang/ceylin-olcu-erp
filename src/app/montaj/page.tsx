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
  normalizeRole,
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

  const providerEarningsEntries =
    useOperationsStore(
      state =>
        state.providerEarningsEntries
    );

  const finalizeProviderEarning =
    useOperationsStore(
      state =>
        state.finalizeProviderEarning
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold heading-title">
          Montaj Programı
        </h1>

        <p className="text-sm heading-subtitle">
          Operasyon omurgasındaki montaj işlerini yönetin.
        </p>
      </div>

      {visibleInstallationOperations.length ===
      0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
          Size veya şirketinize atanmış aktif montaj işi bulunmuyor.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {visibleInstallationOperations.map(
          operation => {
            const nextStatus =
              NEXT_STATUS[
                operation.status
              ];

            return (
              <div
                key={operation.id}
                className="flex h-full flex-col justify-between rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
              >
                <div>
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <span
                      className={`rounded px-2 py-1 text-xs font-medium ${
                        operation.status ===
                        "COMPLETED"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : operation.status ===
                              "PROBLEM"
                            ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                      }`}
                    >
                      {statusLabel(
                        operation.status
                      )}
                    </span>

                    <span className="text-xs font-bold text-gray-400 dark:text-gray-500">
                      #SIP-
                      {operation.saleId}
                    </span>
                  </div>

                  <h3 className="mb-2 text-lg font-bold text-gray-900 dark:text-white">
                    {operation.customerName}
                  </h3>

                  <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {operation.title}
                  </p>

                  <div className="mb-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 shrink-0" />

                      <span>
                        {formatDateTime(
                          operation.scheduledAt
                        )}
                      </span>
                    </div>

                    {operation.address ? (
                      <div className="flex items-start gap-2">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0" />

                        <span className="line-clamp-2">
                          {operation.address}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  {operation.party ? (
                    <div className="mb-4 flex items-center gap-1.5 border-t border-gray-100 pt-3 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
                      <Shield className="h-3.5 w-3.5 text-green-500" />

                      <span>
                        Sorumlu Ekip:{" "}
                        <span className="font-semibold text-gray-700 dark:text-gray-300">
                          {operation.party.name}
                        </span>

                        {operation.party
                          .assignmentType ? (
                          <>
                            {" "}
                            ·{" "}
                            {operation.party
                              .assignmentType ===
                            "INTERNAL"
                              ? "Şirket içi"
                              : "Dış montajcı"}
                          </>
                        ) : null}
                      </span>
                    </div>
                  ) : null}

                  {operation.details.length >
                  0 ? (
                    <ul className="mb-4 space-y-1 rounded-lg bg-slate-50 p-3 text-xs text-slate-700 dark:bg-slate-950 dark:text-slate-300">
                      {operation.details.map(
                        (
                          detail,
                          index
                        ) => (
                          <li
                            key={`${operation.id}:${index}`}
                          >
                            • {detail}
                          </li>
                        )
                      )}
                    </ul>
                  ) : null}

                  {operation.notes ? (
                    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                      {operation.notes}
                    </div>
                  ) : null}
                </div>

                <div className="flex gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
                  {operation.address ? (
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(
                        operation.address
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 rounded-lg border bg-gray-50 py-2 text-center text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      Haritada Aç
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
                      className="flex-1 cursor-pointer rounded-lg bg-blue-600 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                    >
                      {nextStatus ===
                      "COMPLETED"
                        ? "Montajı Tamamla"
                        : `İlerle: ${statusLabel(
                            nextStatus
                          )}`}
                    </button>
                  ) : (
                    <div className="flex-1 rounded-lg bg-green-50 py-2 text-center text-sm font-semibold text-green-700">
                      İş kapandı
                    </div>
                  )}
                </div>
              </div>
            );
          }
        )}
      </div>
    </div>
  );
}