"use client";

import {
  useEffect,
  useMemo,
  useState
} from "react";
import {
  buildOperationFromSale
} from "@/lib/operationSalesBinding";
import {
  getPackageDisplayLabel,
  packageInputHasFeature
} from "@/lib/packageFeatures";
import {
  canAdvanceOperation,
  canCreateOperation,
  canViewOperation
} from "@/lib/operationAccessPolicy";
import {
  buildOperationWhatsAppUrl,
  getOperationKindLabel,
  getOperationStatusLabel,
  openOperationPrintWindow
} from "@/lib/operationOutputService";
import {
  useErpRuntimeContext
} from "@/lib/useErpRuntimeContext";
import type {
  OperationKind,
  OperationRecord,
  OperationStatus
} from "@/lib/operationsWorkflow";
import {
  useOperationsStore
} from "@/store/useOperationsStore";
import OperationRoutingModal from "@/components/operations/OperationRoutingModal";
import OperationChildSummary from "@/components/operations/OperationChildSummary";
import ProviderOperationActions from "@/components/operations/ProviderOperationActions";
import {
  useSalesStore
} from "@/store/salesStore";
import {
  useStore
} from "@/store/useStore";
import {
  normalizeRole,
  useAuthStore
} from "@/store/useAuthStore";
import {
  resolveProviderPortalMode
} from "@/lib/providerPortalMode";
import {
  listProviderMyWork
} from "@/lib/providerMyWorkService";
import type {
  ProviderWorkActor,
  ProviderWorkLinkSnapshot
} from "@/lib/providerAccountContracts";

const NEXT_STATUS: Partial<
  Record<OperationStatus, OperationStatus>
> = {
  DRAFT: "ASSIGNED",
  ASSIGNED: "SENT",
  SENT: "ACCEPTED",
  ACCEPTED: "IN_PROGRESS",
  IN_PROGRESS: "COMPLETED",
  PROBLEM: "IN_PROGRESS"
};

const KIND_LABELS: Record<
  OperationKind,
  string
> = {
  GENERAL: "Genel İş",
  TAILOR: "Terzi",
  SUPPLIER: "Tedarikçi",
  INSTALLATION: "Montaj"
};

function localDateTimeValue(
  offsetHours = 0
): string {
  const date =
    new Date(
      Date.now() +
      offsetHours * 60 * 60 * 1000
    );

  const local =
    new Date(
      date.getTime() -
      date.getTimezoneOffset() *
        60 *
        1000
    );

  return local
    .toISOString()
    .slice(0, 16);
}

function isLate(
  operation: OperationRecord
): boolean {
  return (
    operation.status !== "COMPLETED" &&
    operation.status !== "CANCELLED" &&
    new Date(operation.dueAt).getTime() <
      Date.now()
  );
}

export default function OperationsPage() {
  const {
    scope,
    packageName,
    loading: scopeLoading,
    error: scopeError,
    reload: reloadScope
  } = useErpRuntimeContext();

  const sales =
    useSalesStore(state => state.sales);

  const loadSales =
    useSalesStore(state => state.loadSales);

  const customers =
    useStore(state => state.customers);

  const users =
    useAuthStore(state => state.users);

  const currentUser =
    useAuthStore(
      state => state.currentUser
    );
  const portalMode =
    resolveProviderPortalMode(
      currentUser
    );

  const providerActor =
    useMemo<
      ProviderWorkActor | null
    >(() => {
      if (
        !scope ||
        !currentUser
      ) {
        return null;
      }

      return {
        ...scope,
        userId: currentUser.id,
        role: currentUser.role
      };
    }, [
      scope,
      currentUser
    ]);

  const providerLink =
    useMemo<
      ProviderWorkLinkSnapshot | undefined
    >(() => {
      if (
        portalMode.mode !==
        "PROVIDER_READY"
      ) {
        return undefined;
      }

      if (!currentUser) {
        return undefined;
      }

      return {
        userId: currentUser.id,
        providerCustomerId:
          portalMode.providerCustomerId,
        providerType:
          portalMode.providerType
      };
    }, [
      portalMode,
      currentUser
    ]);

  const operations =
    useOperationsStore(
      state => state.operations
    );

  const saveOperation =
    useOperationsStore(
      state => state.saveOperation
    );

  const updateStatus =
    useOperationsStore(
      state => state.updateStatus
    );

  const routeChild =
    useOperationsStore(
      state => state.routeChild
    );

  const [selectedSaleId, setSelectedSaleId] =
    useState("");

  const [kind, setKind] =
    useState<OperationKind>("TAILOR");

  const [selectedPartyId, setSelectedPartyId] =
    useState("");

  const [supplierName, setSupplierName] =
    useState("");

  const [supplierPhone, setSupplierPhone] =
    useState("");

  const [scheduledAt, setScheduledAt] =
    useState(
      localDateTimeValue()
    );

  const [dueAt, setDueAt] =
    useState(
      localDateTimeValue(48)
    );

  const [notes, setNotes] =
    useState("");

  const [kindFilter, setKindFilter] =
    useState<"ALL" | OperationKind>("ALL");

  const [showCompleted, setShowCompleted] =
    useState(false);

  const [
    routingOperation,
    setRoutingOperation
  ] = useState<OperationRecord | null>(
    null
  );

  useEffect(() => {
    void loadSales();
  }, [loadSales]);

  const activeSales = useMemo(
    () =>
      sales
        .filter(
          sale =>
            !sale.isDeleted &&
            !sale.isArchived &&
            sale.status !== "İPTAL"
        )
        .sort((left, right) =>
          right.createdAt.localeCompare(
            left.createdAt
          )
        ),
    [sales]
  );

  const availableParties = useMemo(() => {
    if (kind === "TAILOR") {
      return users.filter(
        user =>
          user.isActive &&
          normalizeRole(user.role) ===
            "TAILOR"
      );
    }

    if (kind === "INSTALLATION") {
      return users.filter(
        user =>
          user.isActive &&
          normalizeRole(user.role) ===
            "INSTALLER"
      );
    }

    return [];
  }, [users, kind]);


  const selectedSale =
    activeSales.find(
      sale => sale.id === selectedSaleId
    );

  const selectedCustomer =
    selectedSale
      ? customers.find(
          customer =>
            customer.id ===
            selectedSale.customerId
        )
      : undefined;
  const providerWorkResult =
    useMemo(() => {
      if (
        portalMode.mode !==
        "PROVIDER_READY"
      ) {
        return null;
      }

      if (
        !providerActor ||
        !providerLink
      ) {
        return null;
      }

      return listProviderMyWork(
        operations,
        {
          actor: providerActor,
          link: providerLink,
          includeCompleted:
            showCompleted
        },
        new Date().toISOString()
      );
    }, [
      operations,
      portalMode,
      providerActor,
      providerLink,
      showCompleted
    ]);

  const visibleOperations = useMemo(
    () => {
      if (
        portalMode.mode ===
        "PROVIDER_BLOCKED"
      ) {
        return [];
      }

      if (
        portalMode.mode ===
        "PROVIDER_READY"
      ) {
        const providerOperations =
          providerWorkResult?.operations ??
          [];

        return providerOperations
          .filter(operation =>
            showCompleted
              ? true
              : operation.status !==
                  "COMPLETED"
          )
          .sort((left, right) =>
            left.dueAt.localeCompare(
              right.dueAt
            )
          );
      }

      return operations
        .filter(operation =>
          scope
            ? canViewOperation(
                operation,
                scope,
                currentUser
                  ? {
                      userId:
                        currentUser.id,
                      role:
                        currentUser.role
                    }
                  : null
              )
            : false
        )
        .filter(operation =>
          kindFilter === "ALL"
            ? true
            : operation.kind ===
                kindFilter
        )
        .filter(operation =>
          showCompleted
            ? true
            : operation.status !==
                "COMPLETED"
        )
        .sort((left, right) =>
          left.dueAt.localeCompare(
            right.dueAt
          )
        );
    },
    [
      operations,
      scope,
      currentUser,
      kindFilter,
      showCompleted,
      portalMode,
      providerWorkResult
    ]
  );

  function handleCreate(): void {
    if (!scope) {
      window.alert(
        "Aktif şirket/şube/dönem kapsamı yüklenemedi."
      );
      return;
    }

    if (!currentUser) {
      window.alert(
        "Aktif kullanıcı bulunamadı."
      );
      return;
    }

    if (!selectedSale) {
      window.alert(
        "Satış seçmelisiniz."
      );
      return;
    }

    if (!selectedCustomer) {
      window.alert(
        "Satışın bağlı olduğu cari bulunamadı."
      );
      return;
    }

    const selectedParty =
      availableParties.find(
        user =>
          user.id === selectedPartyId
      );

    try {
      const now =
        new Date().toISOString();

      const id =
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID ===
          "function"
          ? crypto.randomUUID()
          : `operation-${Date.now()}`;

      const operation =
        buildOperationFromSale({
          scope,
          sale: selectedSale,
          customer: {
            id: selectedCustomer.id,
            name: selectedCustomer.name,
            phone: selectedCustomer.phone,
            address:
              selectedCustomer.address
          },
          kind,
          party: selectedParty
            ? {
                id: selectedParty.id,
                name: selectedParty.name,
                phone: selectedParty.phone
              }
            : undefined,
          supplierName,
          supplierPhone,
          scheduledAt,
          dueAt,
          notes,
          createdByUserId:
            currentUser.id,
          now,
          id
        });

      const result =
        saveOperation(operation);

      if (result.outcome === "CREATED") {
        setSelectedSaleId("");
        setSelectedPartyId("");
        setSupplierName("");
        setSupplierPhone("");
        setNotes("");

        window.alert(
          "Operasyon ve Ajanda kaydı oluşturuldu."
        );

        return;
      }

      if (result.outcome === "REPLAY") {
        window.alert(
          "Bu işlem daha önce oluşturulmuş. Mükerrer kayıt yapılmadı."
        );

        return;
      }

      window.alert(
        `İş oluşturulamadı: ${result.reason}`
      );
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Operasyon oluşturulamadı."
      );
    }
  }

  function handleAdvance(
    operation: OperationRecord
  ): void {
    if (!currentUser) {
      window.alert(
        "Aktif kullanıcı bulunamadı."
      );
      return;
    }

    const nextStatus =
      NEXT_STATUS[operation.status];

    if (!nextStatus) {
      window.alert(
        "Bu iş için sonraki durum bulunmuyor."
      );
      return;
    }

    const result = updateStatus(
      operation.id,
      nextStatus,
      {
        userId: currentUser.id,
        role: currentUser.role
      },
      new Date().toISOString()
    );

    if (result.outcome !== "UPDATED") {
      window.alert(
        `Durum değiştirilemedi: ${
          result.outcome === "REJECTED"
            ? result.reason
            : "İş bulunamadı"
        }`
      );
    }
  }

  const operationsPackageAllowed =
    packageInputHasFeature(
      packageName,
      "operations"
    );

  if (
    !scopeLoading &&
    scope &&
    !operationsPackageAllowed
  ) {
    return (
      <main className="mx-auto max-w-5xl p-4 md:p-6">
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-6">
          <h1 className="text-xl font-bold text-amber-900">
            Operasyonlar paketinize dahil değil
          </h1>

          <p className="mt-2 text-sm text-amber-800">
            Aktif paket:{" "}
            {getPackageDisplayLabel(packageName)}
          </p>

          <p className="mt-2 text-sm text-amber-800">
            Operasyon ve Ajanda modülleri için
            STANDARD veya PLUS paket gerekir.
          </p>
        </section>
      </main>
    );
  }

  if (
    portalMode.mode ===
    "PROVIDER_BLOCKED"
  ) {
    return (
      <main
        data-provider-portal-blocked
        className="mx-auto max-w-3xl p-4 pb-24 md:p-6"
      >
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-6 shadow-sm">
          <h1 className="text-xl font-bold text-amber-950">
            {portalMode.title}
          </h1>

          <p className="mt-3 text-sm leading-6 text-amber-900">
            {portalMode.message}
          </p>

          <p className="mt-4 rounded-lg bg-white/70 p-3 text-xs text-amber-800">
            Güvenlik nedeniyle bağlantı bulunmadan genel operasyon listesine geçilmez.
          </p>
        </section>
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 pb-24 md:p-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">
          {portalMode.title}
        </h1>

        <p className="mt-1 text-sm text-slate-600">
          {portalMode.description}
        </p>

        {packageName ? (
          <p className="mt-1 text-xs text-slate-500">
            Aktif paket: {getPackageDisplayLabel(packageName)}
          </p>
        ) : null}
      </header>

      {portalMode.mode === "MANAGEMENT" &&
      canCreateOperation(
        currentUser
          ? {
              userId: currentUser.id,
              role: currentUser.role
            }
          : null
      ) ? (
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Yeni Operasyon
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Kayıt oluşturulunca Ajandaya
              otomatik olarak eklenir.
            </p>
          </div>

          {scopeError ? (
            <button
              type="button"
              onClick={() =>
                void reloadScope()
              }
              className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700"
            >
              Kapsamı Yeniden Yükle
            </button>
          ) : null}
        </div>

        {scopeLoading ? (
          <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
            Şirket, şube ve dönem kapsamı yükleniyor…
          </div>
        ) : null}

        {!scopeLoading && scopeError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            İşlem kapalı: {scopeError}
          </div>
        ) : null}

        {!scopeLoading && scope ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="text-sm font-medium text-slate-700">
              Satış

              <select
                value={selectedSaleId}
                onChange={event =>
                  setSelectedSaleId(
                    event.target.value
                  )
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                <option value="">
                  Satış seçin
                </option>

                {activeSales.map(sale => {
                  const customer =
                    customers.find(
                      item =>
                        item.id ===
                        sale.customerId
                    );

                  return (
                    <option
                      key={sale.id}
                      value={sale.id}
                    >
                      {sale.saleNo} —{" "}
                      {customer?.name ??
                        "Cari bulunamadı"}
                    </option>
                  );
                })}
              </select>
            </label>

            <label className="text-sm font-medium text-slate-700">
              İş Türü

              <select
                value={kind}
                onChange={event => {
                  setKind(
                    event.target.value as
                      OperationKind
                  );
                  setSelectedPartyId("");
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                <option value="TAILOR">
                  Terzi
                </option>

                <option value="SUPPLIER">
                  Tedarikçi
                </option>

                <option value="INSTALLATION">
                  Montaj
                </option>
              </select>
            </label>

            {kind !== "SUPPLIER" ? (
              <label className="text-sm font-medium text-slate-700">
                Atanacak Kişi

                <select
                  value={selectedPartyId}
                  onChange={event =>
                    setSelectedPartyId(
                      event.target.value
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                >
                  <option value="">
                    Personel seçin
                  </option>

                  {availableParties.map(
                    user => (
                      <option
                        key={user.id}
                        value={user.id}
                      >
                        {user.name}
                      </option>
                    )
                  )}
                </select>
              </label>
            ) : (
              <>
                <label className="text-sm font-medium text-slate-700">
                  Tedarikçi Adı

                  <input
                    value={supplierName}
                    onChange={event =>
                      setSupplierName(
                        event.target.value
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    placeholder="Tedarikçi adı"
                  />
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Tedarikçi Telefonu

                  <input
                    value={supplierPhone}
                    onChange={event =>
                      setSupplierPhone(
                        event.target.value
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    placeholder="05xx..."
                  />
                </label>
              </>
            )}

            <label className="text-sm font-medium text-slate-700">
              Başlangıç

              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={event =>
                  setScheduledAt(
                    event.target.value
                  )
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Termin

              <input
                type="datetime-local"
                value={dueAt}
                onChange={event =>
                  setDueAt(
                    event.target.value
                  )
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="text-sm font-medium text-slate-700 md:col-span-2 xl:col-span-3">
              Operasyon Notu

              <textarea
                value={notes}
                onChange={event =>
                  setNotes(
                    event.target.value
                  )
                }
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
          </div>
        ) : null}

        {selectedSale && selectedCustomer ? (
          <div className="mt-5 rounded-lg bg-slate-50 p-4">
            <div className="font-semibold text-slate-900">
              {selectedCustomer.name}
            </div>

            <div className="mt-1 text-sm text-slate-600">
              {selectedCustomer.address ||
                "Adres bulunmuyor"}
            </div>

            <div className="mt-3 text-sm text-slate-700">
              {selectedSale.items.length} satış satırı
              iş emrine aktarılacak.
            </div>
          </div>
        ) : null}

        <button
          type="button"
          disabled={
            scopeLoading ||
            !scope ||
            !selectedSale ||
            !selectedCustomer
          }
          onClick={handleCreate}
          className="mt-5 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Operasyon ve Ajanda Kaydı Oluştur
        </button>
      </section>
      ) : (
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
          Kullanıcı rolünüz yeni operasyon oluşturma yetkisine sahip değil.
          Yalnız size atanmış işler aşağıda gösterilir.
        </section>
      )}

      <section>
        {portalMode.mode === "PROVIDER_READY" ? (
          <div
            data-provider-portal-filter
            className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center"
          >
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {portalMode.providerType === "TAILOR"
                  ? "Dikim işleri"
                  : "Montaj işleri"}
              </p>

              <p className="text-xs text-slate-500">
                Yalnız size atanmış kayıtlar gösteriliyor.
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700 sm:ml-auto">
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={event =>
                  setShowCompleted(
                    event.target.checked
                  )
                }
              />

              Tamamlananları göster
            </label>

            <span className="text-sm font-medium text-slate-600">
              {visibleOperations.length} iş
            </span>
          </div>
        ) : (
<div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <select
            value={kindFilter}
            onChange={event =>
              setKindFilter(
                event.target.value as
                  | "ALL"
                  | OperationKind
              )
            }
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="ALL">
              Tüm İşler
            </option>

            {(
              Object.entries(
                KIND_LABELS
              ) as Array<
                [OperationKind, string]
              >
            ).map(([value, label]) => (
              <option
                key={value}
                value={value}
              >
                {label}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={event =>
                setShowCompleted(
                  event.target.checked
                )
              }
            />

            Tamamlananları göster
          </label>

          <span className="ml-auto text-sm text-slate-600">
            {visibleOperations.length} iş
          </span>
        </div>
        )}

        {visibleOperations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
            {portalMode.mode === "PROVIDER_READY"
              ? portalMode.emptyMessage
              : "Gösterilecek operasyon kaydı bulunmuyor."}
          </div>
        ) : (
          <div className="grid gap-4">
            {visibleOperations.map(
              operation => {
                const late =
                  isLate(operation);

                const nextStatus =
                  NEXT_STATUS[
                    operation.status
                  ];
  return (
                  <article
                    data-provider-operation-card={
                      portalMode.mode === "PROVIDER_READY"
                        ? "true"
                        : undefined
                    }
                    key={operation.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                            {getOperationKindLabel(
                              operation
                            )}
                          </span>

                          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                            {getOperationStatusLabel(
                              operation.status
                            )}
                          </span>

                          {late ? (
                            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                              Gecikmiş
                            </span>
                          ) : null}
                        </div>

                        <h3 className="mt-3 text-lg font-semibold text-slate-900">
                          {operation.title}
                        </h3>

                        <p className="mt-1 text-sm font-medium text-slate-700">
                          {operation.customerName}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {operation.party?.name}
                        </p>
                      </div>

                      <div className="text-sm text-slate-600">
                        <div>
                          Başlangıç:{" "}
                          {new Date(
                            operation.scheduledAt
                          ).toLocaleString(
                            "tr-TR"
                          )}
                        </div>

                        <div className="mt-1">
                          Termin:{" "}
                          {new Date(
                            operation.dueAt
                          ).toLocaleString(
                            "tr-TR"
                          )}
                        </div>
                      </div>
                    </div>

                    <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-700">
                      {operation.details.map(
                        (detail, index) => (
                          <li
                            key={`${operation.id}:${index}`}
                          >
                            {detail}
                          </li>
                        )
                      )}
                    </ul>

                    <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap [&_button]:w-full sm:[&_button]:w-auto [&_a]:w-full sm:[&_a]:w-auto">
                      {portalMode.mode === "PROVIDER_READY" &&
                      providerActor &&
                      providerLink ? (
                        <ProviderOperationActions
                          operation={operation}
                          actor={providerActor}
                          link={providerLink}
                        />
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            openOperationPrintWindow(
                              operation
                            );
                          } catch (error) {
                            window.alert(
                              error instanceof Error
                                ? error.message
                                : "Çıktı oluşturulamadı."
                            );
                          }
                        }}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium"
                      >
                        PDF / Yazdır
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          window.open(
                            buildOperationWhatsAppUrl(
                              operation
                            ),
                            "_blank",
                            "noopener,noreferrer"
                          )
                        }
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white"
                      >
                        WhatsApp
                      </button>

                      {operation.kind === "GENERAL" &&

                      canCreateOperation(

                        currentUser

                          ? {

                              userId: currentUser.id,

                              role: currentUser.role

                            }

                          : null

                      ) ? (

                        <button

                          type="button"

                          onClick={() =>

                            setRoutingOperation(operation)

                          }

                          className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700"

                        >

                          Yönlendir

                        </button>

                      ) : null}


                      {portalMode.mode === "MANAGEMENT" && nextStatus &&
                      canAdvanceOperation(
                        operation,
                        currentUser
                          ? {
                              userId: currentUser.id,
                              role: currentUser.role
                            }
                          : null
                      ) ? (
                        <button
                          type="button"
                          onClick={() =>
                            handleAdvance(
                              operation
                            )
                          }
                          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white"
                        >
                          Sonraki Duruma Geç
                        </button>
                      ) : null}
                    </div>
                    {portalMode.mode === "MANAGEMENT" && operation.kind === "GENERAL" ? (
                      <OperationChildSummary
                        parent={operation}
                        operations={operations}
                      />
                    ) : null}
                  </article>
                );
              }
            )}
          </div>
        )}
      </section>
          {portalMode.mode === "MANAGEMENT" &&
      routingOperation &&
      currentUser ? (
        <OperationRoutingModal
          parent={routingOperation}
          users={users.map(user => ({
            id: user.id,
            name: user.name,
            phone: user.phone,
            role: user.role,
            isActive: user.isActive
          }))}
          currentUserId={currentUser.id}
          onClose={() =>
            setRoutingOperation(null)
          }
          onRoute={routeChild}
        />
      ) : null}
</main>
  );
}