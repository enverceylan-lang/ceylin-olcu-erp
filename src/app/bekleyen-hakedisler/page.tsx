"use client";

import {
  useMemo,
  useState
} from "react";
import {
  normalizeRole
} from "@/store/useAuthStore";
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
  ProviderEarningsCurrency
} from "@/lib/providerEarningsViewService";

type DraftMessage = {
  tone:
    | "SUCCESS"
    | "ERROR"
    | "INFO";

  text:
    string;
} | null;

function formatMoney(
  value:
    number | null,
  currency:
    ProviderEarningsCurrency
): string {
  if (value === null) {
    return "Tutar bekleniyor";
  }

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

function parseAmount(
  raw:
    string
): number | null {
  const normalized =
    raw
      .trim()
      .replace(/\s/g, "")
      .replace(/\./g, "")
      .replace(",", ".");

  if (!normalized) {
    return null;
  }

  const parsed =
    Number(normalized);

  if (
    !Number.isFinite(parsed) ||
    parsed < 0
  ) {
    return null;
  }

  return parsed;
}

export default function PendingProviderEarningsPage() {
  const currentUser =
    useAuthStore(
      state =>
        state.currentUser
    );

  const {
    scope,
    loading:
      scopeLoading,
    error:
      scopeError,
    reload:
      reloadScope
  } = useErpRuntimeContext();

  const drafts =
    useOperationsStore(
      state =>
        state.providerEarningsPendingDrafts
    );

  const setDraftAmount =
    useOperationsStore(
      state =>
        state.setProviderEarningsDraftAmount
    );

  const convertDraft =
    useOperationsStore(
      state =>
        state.convertProviderEarningsDraft
    );

  const earningsEntries =
    useOperationsStore(
      state =>
        state.providerEarningsEntries
    );

  const finalizeEarning =
    useOperationsStore(
      state =>
        state.finalizeProviderEarning
    );

  const registerPayment =
    useOperationsStore(
      state =>
        state.registerProviderPaymentSnapshot
    );

  const [
    amounts,
    setAmounts
  ] = useState<
    Record<string, string>
  >({});

  const [
    busyDraftId,
    setBusyDraftId
  ] = useState<
    string | null
  >(null);

  const [
    finalizeAmounts,
    setFinalizeAmounts
  ] = useState<
    Record<string, string>
  >({});

  const [
    paymentAmounts,
    setPaymentAmounts
  ] = useState<
    Record<string, string>
  >({});

  const [
    paymentReferences,
    setPaymentReferences
  ] = useState<
    Record<string, string>
  >({});

  const [
    paymentDates,
    setPaymentDates
  ] = useState<
    Record<string, string>
  >({});

  const [
    busyEntryId,
    setBusyEntryId
  ] = useState<
    string | null
  >(null);

  const [
    message,
    setMessage
  ] = useState<DraftMessage>(
    null
  );

  const normalizedRole =
    normalizeRole(
      currentUser?.role
    );

  const allowed =
    normalizedRole ===
      "ADMIN" ||
    normalizedRole ===
      "ACCOUNTING";

  const visibleDrafts =
    useMemo(() => {
      if (
        !scope ||
        !allowed
      ) {
        return [];
      }

      return drafts
        .filter(
          draft =>
            draft.tenantId ===
              scope.tenantId &&
            draft.companyId ===
              scope.companyId &&
            draft.branchId ===
              scope.branchId &&
            draft.accountingPeriodId ===
              scope.accountingPeriodId
        )
        .filter(
          draft =>
            draft.status ===
              "PENDING_AMOUNT" ||
            draft.status ===
              "READY"
        )
        .sort(
          (
            left,
            right
          ) =>
            right.completedAt.localeCompare(
              left.completedAt
            )
        );
    }, [
      allowed,
      drafts,
      scope
    ]);

  const visibleEntries =
    useMemo(() => {
      if (
        !scope ||
        !allowed
      ) {
        return [];
      }

      return earningsEntries
        .filter(
          entry =>
            entry.tenantId ===
              scope.tenantId &&
            entry.companyId ===
              scope.companyId &&
            entry.branchId ===
              scope.branchId &&
            entry.accountingPeriodId ===
              scope.accountingPeriodId
        )
        .filter(
          entry =>
            entry.status !==
            "CANCELLED"
        )
        .sort(
          (
            left,
            right
          ) =>
            right.occurredAt.localeCompare(
              left.occurredAt
            )
        );
    }, [
      allowed,
      earningsEntries,
      scope
    ]);
  const pendingCount =
    visibleDrafts.filter(
      draft =>
        draft.status ===
        "PENDING_AMOUNT"
    ).length;

  const readyCount =
    visibleDrafts.filter(
      draft =>
        draft.status ===
        "READY"
    ).length;

  function buildActor() {
    if (
      !currentUser ||
      !scope ||
      !allowed
    ) {
      return null;
    }

    return {
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
        normalizedRole as
          | "ADMIN"
          | "ACCOUNTING"
    };
  }

  function saveAmount(
    draftId:
      string,
    providerCustomerId:
      string,
    currency:
      ProviderEarningsCurrency
  ): void {
    const actor =
      buildActor();

    if (!actor) {
      setMessage({
        tone:
          "ERROR",

        text:
          "Aktif kullanıcı veya ERP kapsamı doğrulanamadı."
      });

      return;
    }

    const amount =
      parseAmount(
        amounts[draftId] ||
        ""
      );

    if (amount === null) {
      setMessage({
        tone:
          "ERROR",

        text:
          "Geçerli bir hakediş tutarı girin."
      });

      return;
    }

    setBusyDraftId(
      draftId
    );

    try {
      const result =
        setDraftAmount({
          actor,

          draftId,

          providerCustomerId,

          currency,

          estimatedAmount:
            amount,

          occurredAt:
            new Date()
              .toISOString()
        });

      if (
        result.outcome ===
        "UPDATED"
      ) {
        setMessage({
          tone:
            "SUCCESS",

          text:
            "Taslak tutarı kaydedildi ve READY durumuna alındı."
        });

        return;
      }

      if (
        result.outcome ===
        "REPLAY"
      ) {
        setMessage({
          tone:
            "INFO",

          text:
            "Aynı tutar daha önce kaydedilmiş. Mükerrer değişiklik yapılmadı."
        });

        return;
      }

      setMessage({
        tone:
          "ERROR",

        text:
          `Taslak güncellenemedi: ${result.reason}`
      });
    }
    finally {
      setBusyDraftId(
        null
      );
    }
  }

  function convertToEarning(
    draftId:
      string,
    providerCustomerId:
      string,
    operationId:
      string
  ): void {
    const actor =
      buildActor();

    if (!actor) {
      setMessage({
        tone:
          "ERROR",

        text:
          "Aktif kullanıcı veya ERP kapsamı doğrulanamadı."
      });

      return;
    }

    setBusyDraftId(
      draftId
    );

    try {
      const result =
        convertDraft({
          actor,

          draftId,

          providerCustomerId,

          earningsEntryId:
            [
              "provider-earning",
              operationId
            ].join(":"),

          occurredAt:
            new Date()
              .toISOString()
        });

      if (
        result.outcome ===
        "CONVERTED"
      ) {
        setMessage({
          tone:
            "SUCCESS",

          text:
            "Taslak hakediş defterine aktarıldı. Provider ekranına yansıtıldı."
        });

        return;
      }

      if (
        result.outcome ===
        "REPLAY"
      ) {
        setMessage({
          tone:
            "INFO",

          text:
            "Bu taslak daha önce aktarılmış. Mükerrer hakediş oluşturulmadı."
        });

        return;
      }

      setMessage({
        tone:
          "ERROR",

        text:
          `Taslak dönüştürülemedi: ${result.reason}`
      });
    }
    finally {
      setBusyDraftId(
        null
      );
    }
  }

  function finalizeEntry(
    entryId:
      string,
    providerCustomerId:
      string,
    estimatedAmount:
      number
  ): void {
    if (
      !currentUser ||
      !scope
    ) {
      setMessage({
        tone:
          "ERROR",

        text:
          "Aktif kullanıcı veya ERP kapsamı doğrulanamadı."
      });

      return;
    }

    const amount =
      parseAmount(
        finalizeAmounts[entryId] ??
          estimatedAmount
            .toFixed(2)
            .replace(".", ",")
      );

    if (
      amount === null ||
      amount <= 0
    ) {
      setMessage({
        tone:
          "ERROR",

        text:
          "Geçerli ve sıfırdan büyük bir kesin hakediş tutarı girin."
      });

      return;
    }

    setBusyEntryId(
      entryId
    );

    try {
      const result =
        finalizeEarning({
          tenantId:
            scope.tenantId,

          companyId:
            scope.companyId,

          branchId:
            scope.branchId,

          accountingPeriodId:
            scope.accountingPeriodId,

          entryId,

          providerCustomerId,

          finalizedAmount:
            amount,

          finalizedAt:
            new Date()
              .toISOString(),

          finalizedByUserId:
            currentUser.id
        });

      if (
        result.outcome ===
        "UPDATED"
      ) {
        setMessage({
          tone:
            "SUCCESS",

          text:
            "Hakediş kesinleştirildi."
        });

        return;
      }

      if (
        result.outcome ===
        "REPLAY"
      ) {
        setMessage({
          tone:
            "INFO",

          text:
            "Bu hakediş aynı tutarla daha önce kesinleştirilmiş."
        });

        return;
      }

      if (
        result.outcome ===
        "NOT_FOUND"
      ) {
        setMessage({
          tone:
            "ERROR",

          text:
            "Kesinleştirilecek hakediş kaydı bulunamadı."
        });

        return;
      }

      setMessage({
        tone:
          "ERROR",

        text:
          `Hakediş kesinleştirilemedi: ${
            "reason" in result
              ? result.reason
              : result.outcome
          }`
      });
    }
    finally {
      setBusyEntryId(
        null
      );
    }
  }

  function savePaymentSnapshot(
    entryId:
      string,
    providerCustomerId:
      string,
    providerType:
      "TAILOR" | "INSTALLER",
    currency:
      ProviderEarningsCurrency
  ): void {
    if (
      !currentUser ||
      !scope
    ) {
      setMessage({
        tone:
          "ERROR",

        text:
          "Aktif kullanıcı veya ERP kapsamı doğrulanamadı."
      });

      return;
    }

    const amount =
      parseAmount(
        paymentAmounts[entryId] ||
          ""
      );

    const sourcePaymentId =
      (
        paymentReferences[
          entryId
        ] ||
        ""
      ).trim();

    const paidAtRaw =
      (
        paymentDates[
          entryId
        ] ||
        ""
      ).trim();

    if (
      amount === null ||
      amount <= 0
    ) {
      setMessage({
        tone:
          "ERROR",

        text:
          "Geçerli ve sıfırdan büyük bir ödeme tutarı girin."
      });

      return;
    }

    if (!sourcePaymentId) {
      setMessage({
        tone:
          "ERROR",

        text:
          "Benzersiz ödeme referansı zorunludur."
      });

      return;
    }

    const paidAt =
      paidAtRaw
        ? new Date(
            `${paidAtRaw}T12:00:00`
          ).toISOString()
        : new Date()
            .toISOString();

    const now =
      new Date()
        .toISOString();

    const snapshotId =
      typeof crypto !==
        "undefined" &&
      typeof crypto.randomUUID ===
        "function"
        ? crypto.randomUUID()
        : [
            "provider-payment",
            entryId,
            sourcePaymentId
          ].join(":");

    setBusyEntryId(
      entryId
    );

    try {
      const result =
        registerPayment({
          tenantId:
            scope.tenantId,

          companyId:
            scope.companyId,

          branchId:
            scope.branchId,

          accountingPeriodId:
            scope.accountingPeriodId,

          id:
            snapshotId,

          earningsEntryId:
            entryId,

          providerCustomerId,

          providerType,

          sourcePaymentId,

          currency,

          amount,

          paidAt,

          recordedAt:
            now
        });

      if (
        result.outcome ===
        "UPDATED"
      ) {
        setPaymentAmounts(
          current => ({
            ...current,
            [entryId]:
              ""
          })
        );

        setPaymentReferences(
          current => ({
            ...current,
            [entryId]:
              ""
          })
        );

        setMessage({
          tone:
            "SUCCESS",

          text:
            "Ödeme bilgisi hakediş snapshotına kaydedildi."
        });

        return;
      }

      if (
        result.outcome ===
        "REPLAY"
      ) {
        setMessage({
          tone:
            "INFO",

          text:
            "Bu ödeme referansı daha önce aynı bilgilerle kaydedilmiş. Mükerrer kayıt oluşmadı."
        });

        return;
      }

      if (
        result.outcome ===
        "NOT_FOUND"
      ) {
        setMessage({
          tone:
            "ERROR",

          text:
            "Ödeme girilecek hakediş kaydı bulunamadı."
        });

        return;
      }

      setMessage({
        tone:
          "ERROR",

        text:
          `Ödeme bilgisi kaydedilemedi: ${
            "reason" in result
              ? result.reason
              : result.outcome
          }`
      });
    }
    finally {
      setBusyEntryId(
        null
      );
    }
  }
  if (
    !currentUser ||
    !allowed
  ) {
    return (
      <main
        data-provider-earnings-admin-blocked
        className="mx-auto max-w-3xl p-4 pb-24 md:p-6"
      >
        <section className="rounded-xl border border-red-200 bg-red-50 p-6 shadow-sm">
          <h1 className="text-xl font-bold text-red-900">
            Yetkisiz Erişim
          </h1>

          <p className="mt-3 text-sm text-red-700">
            Bekleyen hakedişleri yalnız ADMIN ve ACCOUNTING kullanıcıları yönetebilir.
          </p>
        </section>
      </main>
    );
  }

  if (scopeLoading) {
    return (
      <main className="mx-auto max-w-3xl p-4 pb-24 md:p-6">
        <section className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          ERP şirket, şube ve muhasebe dönemi kapsamı yükleniyor…
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
        data-provider-earnings-admin-scope-error
        className="mx-auto max-w-3xl p-4 pb-24 md:p-6"
      >
        <section className="rounded-xl border border-red-200 bg-red-50 p-6 shadow-sm">
          <h1 className="text-xl font-bold text-red-900">
            Hakediş Kapsamı Yüklenemedi
          </h1>

          <p className="mt-3 text-sm text-red-700">
            {scopeError ||
              "Aktif ERP kapsamı bulunamadı."}
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

  return (
    <main
      data-provider-earnings-admin-page
      className="mx-auto max-w-7xl space-y-6 p-4 pb-24 md:p-6"
    >
      <header>
        <h1 className="text-2xl font-bold text-slate-900">
          Bekleyen Hakedişler
        </h1>

        <p className="mt-1 text-sm text-slate-600">
          Tamamlanan terzi ve montaj işlerinin hakediş tutarlarını girin ve provider hakediş defterine aktarın.
        </p>

        <p className="mt-2 text-xs text-slate-500">
          Bu işlem finans, kasa veya ödeme hareketi oluşturmaz. Yalnız hakediş görünüm kaydı üretir.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">
            Toplam Bekleyen
          </p>

          <p className="mt-1 text-2xl font-bold text-slate-900">
            {visibleDrafts.length}
          </p>
        </article>

        <article className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="text-xs font-medium text-amber-700">
            Tutar Bekleyen
          </p>

          <p className="mt-1 text-2xl font-bold text-amber-950">
            {pendingCount}
          </p>
        </article>

        <article className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
          <p className="text-xs font-medium text-blue-700">
            Aktarıma Hazır
          </p>

          <p className="mt-1 text-2xl font-bold text-blue-950">
            {readyCount}
          </p>
        </article>
      </section>

      {message ? (
        <section
          data-provider-earnings-admin-message
          className={
            message.tone ===
            "SUCCESS"
              ? "rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"
              : message.tone ===
                  "ERROR"
                ? "rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
                : "rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800"
          }
        >
          {message.text}
        </section>
      ) : null}

      {visibleDrafts.length ===
      0 ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
          <p className="font-semibold text-slate-700">
            Bekleyen provider hakediş taslağı bulunmuyor.
          </p>

          <p className="mt-2 text-sm text-slate-500">
            Provider bir işi tamamlandı olarak bildirdiğinde taslak burada oluşacaktır.
          </p>
        </section>
      ) : (
        <section
          data-provider-earnings-admin-list
          className="grid gap-4"
        >
          {visibleDrafts.map(
            draft => {
              const busy =
                busyDraftId ===
                draft.id;

              const ready =
                draft.status ===
                "READY";

              return (
                <article
                  key={
                    draft.id
                  }
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-bold text-slate-900">
                          {draft.title}
                        </h2>

                        <span
                          className={
                            ready
                              ? "rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800"
                              : "rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800"
                          }
                        >
                          {ready
                            ? "Aktarıma Hazır"
                            : "Tutar Bekliyor"}
                        </span>
                      </div>

                      <p className="mt-2 text-xs text-slate-500">
                        Tamamlanma: {formatDate(
                          draft.completedAt
                        )}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Provider türü: {
                          draft.providerType ===
                          "TAILOR"
                            ? "Terzi"
                            : "Montajcı"
                        }
                      </p>
                    </div>

                    <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm">
                      <p className="text-xs text-slate-500">
                        Mevcut Hakediş Tutarı
                      </p>

                      <p className="mt-1 font-bold text-slate-900">
                        {formatMoney(
                          draft.estimatedAmount,
                          draft.currency
                        )}
                      </p>
                    </div>
                  </div>

                  <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg border border-slate-100 p-3">
                      <dt className="text-slate-500">
                        Operasyon
                      </dt>

                      <dd className="mt-1 break-all font-medium text-slate-800">
                        {draft.operationId}
                      </dd>
                    </div>

                    <div className="rounded-lg border border-slate-100 p-3">
                      <dt className="text-slate-500">
                        Provider Cari
                      </dt>

                      <dd className="mt-1 break-all font-medium text-slate-800">
                        {draft.providerCustomerId}
                      </dd>
                    </div>

                    <div className="rounded-lg border border-slate-100 p-3">
                      <dt className="text-slate-500">
                        Para Birimi
                      </dt>

                      <dd className="mt-1 font-medium text-slate-800">
                        {draft.currency}
                      </dd>
                    </div>

                    <div className="rounded-lg border border-slate-100 p-3">
                      <dt className="text-slate-500">
                        Kaynak Belge
                      </dt>

                      <dd className="mt-1 break-all font-medium text-slate-800">
                        {draft.sourceDocumentId ||
                          "Belirtilmedi"}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-slate-600">
                        Hakediş Tutarı ({draft.currency})
                      </span>

                      <input
                        type="text"
                        inputMode="decimal"
                        value={
                          amounts[
                            draft.id
                          ] ??
                          (
                            draft.estimatedAmount !==
                            null
                              ? draft.estimatedAmount
                                  .toFixed(2)
                                  .replace(".", ",")
                              : ""
                          )
                        }
                        onChange={
                          event =>
                            setAmounts(
                              current => ({
                                ...current,

                                [draft.id]:
                                  event.target.value
                              })
                            )
                        }
                        disabled={
                          busy
                        }
                        placeholder="Örnek: 1.250,00"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:bg-slate-100"
                      />
                    </label>

                    <button
                      type="button"
                      disabled={
                        busy
                      }
                      onClick={() =>
                        saveAmount(
                          draft.id,
                          draft.providerCustomerId,
                          draft.currency
                        )
                      }
                      className="self-end rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy
                        ? "İşleniyor…"
                        : ready
                          ? "Tutarı Güncelle"
                          : "Tutarı Kaydet"}
                    </button>

                    <button
                      type="button"
                      disabled={
                        busy ||
                        !ready
                      }
                      onClick={() =>
                        convertToEarning(
                          draft.id,
                          draft.providerCustomerId,
                          draft.operationId
                        )
                      }
                      className="self-end rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {busy
                        ? "İşleniyor…"
                        : "Hakedişe Aktar"}
                    </button>
                  </div>
                </article>
              );
            }
          )}
        </section>
      )}
      <section
        data-provider-earnings-ledger-admin
        className="space-y-4 border-t border-slate-200 pt-6"
      >
        <header>
          <h2 className="text-xl font-bold text-slate-900">
            Hakediş Kesinleştirme ve Ödeme Takibi
          </h2>

          <p className="mt-1 text-sm text-slate-600">
            Hakedişe aktarılan kayıtları kesinleştirin ve gerçekleşen ödeme bilgilerini salt okunur snapshot olarak kaydedin.
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Bu ekran kasa, banka veya finans hareketi oluşturmaz.
          </p>
        </header>

        {visibleEntries.length ===
        0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
            Hakedişe aktarılmış kayıt bulunmuyor.
          </div>
        ) : (
          <div className="grid gap-4">
            {visibleEntries.map(
              entry => {
                const busy =
                  busyEntryId ===
                  entry.id;

                const remainingAmount =
                  Math.max(
                    0,
                    entry.finalizedAmount -
                      entry.paidAmount
                  );

                const finalized =
                  entry.finalizedAmount >
                  0;

                return (
                  <article
                    key={
                      entry.id
                    }
                    data-provider-earnings-ledger-card
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-slate-900">
                            {entry.title}
                          </h3>

                          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                            {entry.status ===
                            "ESTIMATED"
                              ? "Tahmini"
                              : entry.status ===
                                  "FINALIZED"
                                ? "Kesinleşti"
                                : entry.status ===
                                    "PARTIALLY_PAID"
                                  ? "Kısmen Ödendi"
                                  : entry.status ===
                                      "PAID"
                                    ? "Ödendi"
                                    : entry.status}
                          </span>
                        </div>

                        <p className="mt-2 text-xs text-slate-500">
                          Oluşma: {formatDate(
                            entry.occurredAt
                          )}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Provider: {
                            entry.providerType ===
                            "TAILOR"
                              ? "Terzi"
                              : "Montajcı"
                          }
                        </p>
                      </div>

                      <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                        <div className="rounded-lg bg-slate-50 p-3">
                          <dt className="text-slate-500">
                            Tahmini
                          </dt>

                          <dd className="mt-1 font-bold text-slate-900">
                            {formatMoney(
                              entry.estimatedAmount,
                              entry.currency
                            )}
                          </dd>
                        </div>

                        <div className="rounded-lg bg-blue-50 p-3">
                          <dt className="text-blue-700">
                            Kesinleşen
                          </dt>

                          <dd className="mt-1 font-bold text-blue-950">
                            {formatMoney(
                              entry.finalizedAmount,
                              entry.currency
                            )}
                          </dd>
                        </div>

                        <div className="rounded-lg bg-green-50 p-3">
                          <dt className="text-green-700">
                            Ödenen
                          </dt>

                          <dd className="mt-1 font-bold text-green-950">
                            {formatMoney(
                              entry.paidAmount,
                              entry.currency
                            )}
                          </dd>
                        </div>

                        <div className="rounded-lg bg-amber-50 p-3">
                          <dt className="text-amber-700">
                            Kalan
                          </dt>

                          <dd className="mt-1 font-bold text-amber-950">
                            {formatMoney(
                              remainingAmount,
                              entry.currency
                            )}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    {!finalized ? (
                      <div
                        data-provider-earnings-finalize-form
                        className="mt-5 grid gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 sm:grid-cols-[minmax(0,1fr)_auto]"
                      >
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-blue-800">
                            Kesin Hakediş Tutarı ({entry.currency})
                          </span>

                          <input
                            type="text"
                            inputMode="decimal"
                            value={
                              finalizeAmounts[
                                entry.id
                              ] ??
                              entry.estimatedAmount
                                .toFixed(2)
                                .replace(".", ",")
                            }
                            onChange={
                              event =>
                                setFinalizeAmounts(
                                  current => ({
                                    ...current,
                                    [entry.id]:
                                      event.target.value
                                  })
                                )
                            }
                            disabled={
                              busy
                            }
                            className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:bg-slate-100"
                          />
                        </label>

                        <button
                          type="button"
                          disabled={
                            busy
                          }
                          onClick={() =>
                            finalizeEntry(
                              entry.id,
                              entry.providerCustomerId,
                              entry.estimatedAmount
                            )
                          }
                          className="self-end rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busy
                            ? "İşleniyor…"
                            : "Hakedişi Kesinleştir"}
                        </button>
                      </div>
                    ) : remainingAmount >
                      0 ? (
                      <div
                        data-provider-earnings-payment-form
                        className="mt-5 grid gap-3 rounded-xl border border-green-100 bg-green-50 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px_auto]"
                      >
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-green-800">
                            Ödeme Tutarı ({entry.currency})
                          </span>

                          <input
                            type="text"
                            inputMode="decimal"
                            value={
                              paymentAmounts[
                                entry.id
                              ] ||
                              ""
                            }
                            onChange={
                              event =>
                                setPaymentAmounts(
                                  current => ({
                                    ...current,
                                    [entry.id]:
                                      event.target.value
                                  })
                                )
                            }
                            disabled={
                              busy
                            }
                            placeholder="Örnek: 1.250,00"
                            className="w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-500 disabled:bg-slate-100"
                          />
                        </label>

                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-green-800">
                            Benzersiz Ödeme Referansı
                          </span>

                          <input
                            type="text"
                            value={
                              paymentReferences[
                                entry.id
                              ] ||
                              ""
                            }
                            onChange={
                              event =>
                                setPaymentReferences(
                                  current => ({
                                    ...current,
                                    [entry.id]:
                                      event.target.value
                                  })
                                )
                            }
                            disabled={
                              busy
                            }
                            placeholder="Örnek: EFT-20260729-001"
                            className="w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-500 disabled:bg-slate-100"
                          />
                        </label>

                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-green-800">
                            Ödeme Tarihi
                          </span>

                          <input
                            type="date"
                            value={
                              paymentDates[
                                entry.id
                              ] ||
                              ""
                            }
                            onChange={
                              event =>
                                setPaymentDates(
                                  current => ({
                                    ...current,
                                    [entry.id]:
                                      event.target.value
                                  })
                                )
                            }
                            disabled={
                              busy
                            }
                            className="w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-500 disabled:bg-slate-100"
                          />
                        </label>

                        <button
                          type="button"
                          disabled={
                            busy
                          }
                          onClick={() =>
                            savePaymentSnapshot(
                              entry.id,
                              entry.providerCustomerId,
                              entry.providerType,
                              entry.currency
                            )
                          }
                          className="self-end rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busy
                            ? "İşleniyor…"
                            : "Ödeme Bilgisini Kaydet"}
                        </button>
                      </div>
                    ) : (
                      <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">
                        Bu hakediş tamamen ödendi.
                      </div>
                    )}
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