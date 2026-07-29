"use client";

import {
  useMemo
} from "react";
import {
  resolveProviderPortalMode
} from "@/lib/providerPortalMode";
import {
  useErpRuntimeContext
} from "@/lib/useErpRuntimeContext";
import {
  listProviderEarnings,
  type ProviderEarningsCurrency,
  type ProviderEarningsStatus
} from "@/lib/providerEarningsViewService";
import {
  useAuthStore
} from "@/store/useAuthStore";
import {
  useOperationsStore
} from "@/store/useOperationsStore";

const STATUS_LABELS:
  Record<
    ProviderEarningsStatus,
    string
  > = {
    ESTIMATED:
      "Tahmini",

    FINALIZED:
      "Kesinleşti",

    PARTIALLY_PAID:
      "Kısmen Ödendi",

    PAID:
      "Ödendi",

    CANCELLED:
      "İptal"
  };

const STATUS_CLASSES:
  Record<
    ProviderEarningsStatus,
    string
  > = {
    ESTIMATED:
      "border-amber-200 bg-amber-50 text-amber-800",

    FINALIZED:
      "border-blue-200 bg-blue-50 text-blue-800",

    PARTIALLY_PAID:
      "border-violet-200 bg-violet-50 text-violet-800",

    PAID:
      "border-green-200 bg-green-50 text-green-800",

    CANCELLED:
      "border-red-200 bg-red-50 text-red-800"
  };

function formatMoney(
  value:
    number,
  currency:
    ProviderEarningsCurrency
): string {
  return new Intl.NumberFormat(
    "tr-TR",
    {
      style:
        "currency",

      currency,

      minimumFractionDigits:
        2,

      maximumFractionDigits:
        2
    }
  ).format(value);
}

function formatDate(
  value:
    string
): string {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "tr-TR",
    {
      dateStyle:
        "medium",

      timeStyle:
        "short"
    }
  ).format(date);
}

export default function MyEarningsPage() {
  const {
    scope,
    loading: scopeLoading,
    error: scopeError,
    reload: reloadScope
  } = useErpRuntimeContext();

  const currentUser =
    useAuthStore(
      state =>
        state.currentUser
    );

  const entries =
    useOperationsStore(
      state =>
        state.providerEarningsEntries
    );

  const portalMode =
    resolveProviderPortalMode(
      currentUser
    );

  const earnings =
    useMemo(() => {
      if (
        portalMode.mode !==
        "PROVIDER_READY"
      ) {
        return {
          entries: [],
          summaries: [],
          entryCount: 0
        };
      }

      if (
        !currentUser ||
        !scope
      ) {
        return {
          entries: [],
          summaries: [],
          entryCount: 0
        };
      }

      return listProviderEarnings(
        entries,
        {
          tenantId:
            scope.tenantId,

          companyId:
            scope.companyId,

          branchId:
            scope.branchId,

          accountingPeriodId:
            scope.accountingPeriodId,

          userId:
            currentUser.id,

          role:
            portalMode.providerType
        },
        {
          userId:
            currentUser.id,

          providerCustomerId:
            portalMode.providerCustomerId,

          providerType:
            portalMode.providerType
        }
      );
    }, [
      currentUser,
      entries,
      portalMode,
      scope
    ]);

  if (
    portalMode.mode ===
    "PROVIDER_BLOCKED"
  ) {
    return (
      <main
        data-provider-earnings-blocked
        className="mx-auto max-w-3xl p-4 pb-24 md:p-6"
      >
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6 shadow-sm">
          <h1 className="text-xl font-bold text-amber-950">
            Hakediş Görünümü Kapalı
          </h1>

          <p className="mt-3 text-sm leading-6 text-amber-900">
            {portalMode.message}
          </p>

          <p className="mt-4 rounded-lg bg-white/70 p-3 text-xs text-amber-800">
            Provider cari bağlantısı kurulmadan hiçbir hakediş veya ödeme bilgisi gösterilmez.
          </p>
        </section>
      </main>
    );
  }

  if (
    scopeLoading
  ) {
    return (
      <main className="mx-auto max-w-3xl p-4 pb-24 md:p-6">
        <section className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Şirket, şube ve muhasebe dönemi kapsamı yükleniyor…
        </section>
      </main>
    );
  }

  if (
    scopeError ||
    !scope
  ) {
    return (
      <main
        data-provider-earnings-scope-error
        className="mx-auto max-w-3xl p-4 pb-24 md:p-6"
      >
        <section className="rounded-xl border border-red-200 bg-red-50 p-6 shadow-sm">
          <h1 className="text-xl font-bold text-red-900">
            Hakediş Kapsamı Yüklenemedi
          </h1>

          <p className="mt-3 text-sm text-red-700">
            {scopeError ||
              "Aktif şirket, şube veya muhasebe dönemi bulunamadı."}
          </p>

          <button
            type="button"
            onClick={() =>
              void reloadScope()
            }
            className="mt-4 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700"
          >
            Kapsamı Yeniden Yükle
          </button>
        </section>
      </main>
    );
  }
  if (
    portalMode.mode ===
    "MANAGEMENT"
  ) {
    return (
      <main className="mx-auto max-w-3xl p-4 pb-24 md:p-6">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">
            Benim Hakedişlerim
          </h1>

          <p className="mt-3 text-sm text-slate-600">
            Bu ekran yalnız bağlı terzi ve montajcı hesapları içindir.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main
      data-provider-earnings-page
      className="mx-auto max-w-7xl space-y-6 p-4 pb-24 md:p-6"
    >
      <header>
        <h1 className="text-2xl font-bold text-slate-900">
          Benim Hakedişlerim
        </h1>

        <p className="mt-1 text-sm text-slate-600">
          Tahmini, kesinleşen, ödenen ve kalan tutarlarınızı para birimi bazında görüntüleyin.
        </p>

        <p className="mt-2 text-xs text-slate-500">
          Bu ekran salt okunurdur. Ödeme ve finans kayıtları yalnız yetkili yönetim ekranlarından oluşturulur.
        </p>
      </header>

      {earnings.summaries.length ===
      0 ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
          <p className="font-semibold text-slate-700">
            Henüz gösterilecek hakediş kaydı bulunmuyor.
          </p>

          <p className="mt-2 text-sm text-slate-500">
            Tamamlanan işler yönetim tarafından hakedişe dönüştürüldüğünde burada görünecektir.
          </p>
        </section>
      ) : (
        <section
          data-provider-earnings-summary
          className="grid gap-4 xl:grid-cols-2"
        >
          {earnings.summaries.map(
            summary => (
              <article
                key={
                  summary.currency
                }
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-slate-900">
                    {summary.currency}
                  </h2>

                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {summary.entryCount} kayıt
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-amber-50 p-3">
                    <p className="text-xs font-medium text-amber-700">
                      Tahmini
                    </p>

                    <p className="mt-1 font-bold text-amber-950">
                      {formatMoney(
                        summary.estimatedAmount,
                        summary.currency
                      )}
                    </p>
                  </div>

                  <div className="rounded-lg bg-blue-50 p-3">
                    <p className="text-xs font-medium text-blue-700">
                      Kesinleşen
                    </p>

                    <p className="mt-1 font-bold text-blue-950">
                      {formatMoney(
                        summary.finalizedAmount,
                        summary.currency
                      )}
                    </p>
                  </div>

                  <div className="rounded-lg bg-green-50 p-3">
                    <p className="text-xs font-medium text-green-700">
                      Ödenen
                    </p>

                    <p className="mt-1 font-bold text-green-950">
                      {formatMoney(
                        summary.paidAmount,
                        summary.currency
                      )}
                    </p>
                  </div>

                  <div className="rounded-lg bg-violet-50 p-3">
                    <p className="text-xs font-medium text-violet-700">
                      Kalan
                    </p>

                    <p className="mt-1 font-bold text-violet-950">
                      {formatMoney(
                        summary.remainingAmount,
                        summary.currency
                      )}
                    </p>
                  </div>
                </div>
              </article>
            )
          )}
        </section>
      )}

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Hakediş Hareketleri
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Yalnız bağlı provider carinize ait kayıtlar gösterilir.
            </p>
          </div>

          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {earnings.entryCount} kayıt
          </span>
        </div>

        {earnings.entries.length ===
        0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            Hakediş hareketi bulunmuyor.
          </div>
        ) : (
          <div
            data-provider-earnings-list
            className="grid gap-4"
          >
            {earnings.entries.map(
              entry => {
                const remaining =
                  Math.max(
                    0,
                    entry.finalizedAmount -
                      entry.paidAmount
                  );

                return (
                  <article
                    key={
                      entry.id
                    }
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="font-bold text-slate-900">
                          {entry.title}
                        </h3>

                        <p className="mt-1 text-xs text-slate-500">
                          {formatDate(
                            entry.occurredAt
                          )}
                        </p>
                      </div>

                      <span
                        className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${
                          STATUS_CLASSES[
                            entry.status
                          ]
                        }`}
                      >
                        {
                          STATUS_LABELS[
                            entry.status
                          ]
                        }
                      </span>
                    </div>

                    <dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                      <div className="rounded-lg bg-slate-50 p-3">
                        <dt className="text-xs text-slate-500">
                          Tahmini
                        </dt>

                        <dd className="mt-1 font-semibold text-slate-900">
                          {formatMoney(
                            entry.estimatedAmount,
                            entry.currency
                          )}
                        </dd>
                      </div>

                      <div className="rounded-lg bg-slate-50 p-3">
                        <dt className="text-xs text-slate-500">
                          Kesinleşen
                        </dt>

                        <dd className="mt-1 font-semibold text-slate-900">
                          {formatMoney(
                            entry.finalizedAmount,
                            entry.currency
                          )}
                        </dd>
                      </div>

                      <div className="rounded-lg bg-slate-50 p-3">
                        <dt className="text-xs text-slate-500">
                          Ödenen
                        </dt>

                        <dd className="mt-1 font-semibold text-slate-900">
                          {formatMoney(
                            entry.paidAmount,
                            entry.currency
                          )}
                        </dd>
                      </div>

                      <div className="rounded-lg bg-slate-50 p-3">
                        <dt className="text-xs text-slate-500">
                          Kalan
                        </dt>

                        <dd className="mt-1 font-semibold text-slate-900">
                          {formatMoney(
                            remaining,
                            entry.currency
                          )}
                        </dd>
                      </div>
                    </dl>
                  </article>
                );
              }
            )}
          </div>
        )}
      </section>
    </main>
  );
}