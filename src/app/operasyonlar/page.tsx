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
import { fetchActiveCompanyDisplayName } from "@/lib/activeCompanyDisplayNameClient";
import type {
  OperationKind,
  OperationPriority,
  OperationRecord
} from "@/lib/operationsWorkflow";
import {
  useOperationsStore
} from "@/store/useOperationsStore";
import OperationRoutingModal from "@/components/operations/OperationRoutingModal";
import OperationChildSummary from "@/components/operations/OperationChildSummary";
import MaterialCutDecisionPanel from "@/components/operations/MaterialCutDecisionPanel";
import ProviderOperationActions from "@/components/operations/ProviderOperationActions";
import {
  useSalesStore
} from "@/store/salesStore";
import {
  useStore
} from "@/store/useStore";
import { useProductionMaterialStore } from "@/store/useProductionMaterialStore";
import { resolveOperationReleaseProjection } from "@/lib/operationReleaseContextResolver";
import {
  normalizeRole,
  useAuthStore
} from "@/store/useAuthStore";
import {
  isInstallationAssignableUser,
  resolveInstallationAssignment
} from "@/lib/installationAssignmentService";
import {
  resolveProviderPortalMode
} from "@/lib/providerPortalMode";
import {
  listProviderMyWork
} from "@/lib/providerMyWorkService";
import {
  buildOperationCommandCenterSummary,
  buildOperationTimeline,
  deriveOperationReadiness,
  deriveOperationRisk,
  matchesOperationSearch,
  resolveNextAllowedOperationStatus
} from "@/lib/operationCommandCenterView";
import type {
  ProviderWorkActor,
  ProviderWorkLinkSnapshot
} from "@/lib/providerAccountContracts";
import {
  WorkflowAssignmentChip,
  WorkflowReadinessBadge,
  WorkflowRiskBadge,
  WorkflowTimeline
} from "@/components/workflow/WorkflowUiKit";
import {
  readinessTone,
  riskTone,
  toWorkflowEvent
} from "@/lib/workflowUiKit";

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

  const productionItems =
    useStore(state => state.productionItems);

  const productionSourcePlans =
    useProductionMaterialStore(state => state.plans);

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

  const [
    cutOperation,
    setCutOperation
  ] = useState<OperationRecord | null>(
    null
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

  const [priority, setPriority] =
    useState<OperationPriority>(
      "NORMAL"
    );

  const [notes, setNotes] =
    useState("");

  const [kindFilter, setKindFilter] =
    useState<"ALL" | OperationKind>("ALL");


  const [searchQuery, setSearchQuery] =
    useState("");

  const [
    expandedOperationIds,
    setExpandedOperationIds
  ] = useState<Record<string, boolean>>({});
const [showCompleted, setShowCompleted] =
    useState(false);
  const [
    showCreateOperation,
    setShowCreateOperation
  ] = useState(false);

  const [
    routingOperation,
    setRoutingOperation
  ] = useState<OperationRecord | null>(
    null
  );

  useEffect(() => {
    if (!scope) {
      return;
    }

    void loadSales(scope);
  }, [loadSales, scope]);
  useEffect(() => {
    function handleShortcut(
      event: KeyboardEvent
    ): void {
      if (
        event.altKey &&
        event.key.toLowerCase() === "n"
      ) {
        event.preventDefault();
        setShowCreateOperation(true);
      }

      if (
        event.key === "Escape"
      ) {
        setShowCreateOperation(false);
      }
    }

    window.addEventListener(
      "keydown",
      handleShortcut
    );

    return () =>
      window.removeEventListener(
        "keydown",
        handleShortcut
      );
  }, []);

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
            "TAILOR" &&
          user.providerType ===
            "TAILOR" &&
          Boolean(
            user.providerCustomerId?.trim()
          )
      );
    }

    if (kind === "INSTALLATION") {
      return users.filter(
        user =>
          isInstallationAssignableUser({
            id: user.id,
            name: user.name,
            phone: user.phone,
            role: user.role,
            isActive: user.isActive,
            providerCustomerId:
              user.providerCustomerId,
            providerType:
              user.providerType
          })
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
        .filter(operation =>
          matchesOperationSearch(
            operation,
            searchQuery
          )
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
      searchQuery,
      showCompleted,
      portalMode,
      providerWorkResult
    ]
  );

  const commandCenterSummary =
    useMemo(
      () =>
        buildOperationCommandCenterSummary(
          visibleOperations,
          new Date()
        ),
      [visibleOperations]
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

    const installationAssignment =
      kind === "INSTALLATION"
        ? resolveInstallationAssignment(
            selectedParty
              ? {
                  id: selectedParty.id,
                  name: selectedParty.name,
                  phone: selectedParty.phone,
                  role: selectedParty.role,
                  isActive:
                    selectedParty.isActive,
                  providerCustomerId:
                    selectedParty
                      .providerCustomerId,
                  providerType:
                    selectedParty
                      .providerType
                }
              : undefined
          )
        : null;

    if (
      installationAssignment?.mode ===
      "REJECTED"
    ) {
      window.alert(
        `Montaj ataması geçersiz: ${installationAssignment.reason}`
      );
      return;
    }

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
          party:
            kind === "INSTALLATION"
              ? installationAssignment?.party
              : selectedParty
                ? {
                    id:
                      selectedParty.providerCustomerId as string,
                    userId:
                      selectedParty.id,
                    name:
                      selectedParty.name,
                    phone:
                      selectedParty.phone,
                    assignmentType:
                      "EXTERNAL",
                    providerCustomerId:
                      selectedParty.providerCustomerId as string
                  }
                : undefined,
          supplierName,
          supplierPhone,
          scheduledAt,
          dueAt,
          priority,
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
        setPriority("NORMAL");
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
      resolveNextAllowedOperationStatus(
        operation,
        currentUser
          ? {
              userId: currentUser.id,
              role: currentUser.role
            }
          : null,
        new Date().toISOString()
      );

    if (!nextStatus) {
      window.alert(
        "Bu iş için sonraki durum bulunmuyor."
      );
      return;
    }

    const releaseProjection =
      resolveOperationReleaseProjection({
        operation,
        productionItems,
        sourcePlans: productionSourcePlans
      });

    const result = updateStatus(
      operation.id,
      nextStatus,
      {
        userId: currentUser.id,
        role: currentUser.role
      },
      new Date().toISOString(),
      releaseProjection.context
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
    <main className="min-h-screen bg-slate-100/70 px-3 py-3 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-4 md:px-5"><div className="mx-auto w-full max-w-[1600px]">
      <header className="flex min-h-14 items-center gap-3 rounded-t-lg border border-slate-200 bg-white px-4 py-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="truncate text-[14px] font-semibold tracking-[-0.01em] text-slate-950 dark:text-white">
              {portalMode.title}
            </h1>

            <span className="hidden text-slate-300 dark:text-slate-700 sm:inline">
              |
            </span>

            <span className="hidden truncate text-[13px] leading-5 text-slate-500 dark:text-slate-300 sm:inline">
              {portalMode.description}
            </span>

            {packageName ? (
              <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {getPackageDisplayLabel(packageName)}
              </span>
            ) : null}
          </div>
        </div>

        {portalMode.mode === "MANAGEMENT" &&
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
              setShowCreateOperation(true)
            }
            className="shrink-0 rounded-md bg-slate-900 px-3.5 py-2 text-[12px] font-bold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-500"
          >
            + Yeni Operasyon
            <span className="ml-2 hidden font-normal opacity-60 md:inline">
              Alt+N
            </span>
          </button>
        ) : null}
      </header>

      {showCreateOperation && portalMode.mode === "MANAGEMENT" &&
      canCreateOperation(
        currentUser
          ? {
              userId: currentUser.id,
              role: currentUser.role
            }
          : null
      ) ? (
      <div
        className="fixed inset-0 z-50 flex justify-end bg-slate-950/20 backdrop-blur-[1px]"
        onMouseDown={event => {
          if (
            event.target ===
            event.currentTarget
          ) {
            setShowCreateOperation(false);
          }
        }}
      >
        <section className="h-full w-full max-w-[460px] overflow-y-auto border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <h2 className="text-sm font-bold text-slate-950 dark:text-slate-50">
              Yeni Operasyon
            </h2>

            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Operasyon + bağlı Ajanda kaydı
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setShowCreateOperation(false)
            }
            className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Kapat
          </button>

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
          <div className="grid gap-3 px-4 pt-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Satış

              <select
                value={selectedSaleId}
                onChange={event =>
                  setSelectedSaleId(
                    event.target.value
                  )
                }
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-blue-950"
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
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-blue-950"
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
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-blue-950"
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
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-blue-950"
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
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-blue-950"
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
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-blue-950"
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
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-blue-950"
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Öncelik

              <select
                value={priority}
                onChange={event =>
                  setPriority(
                    event.target.value as
                      OperationPriority
                  )
                }
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-blue-950"
              >
                <option value="NORMAL">
                  Normal
                </option>
                <option value="PRIORITY">
                  Öncelikli
                </option>
                <option value="URGENT">
                  ACİL
                </option>
              </select>
            </label>

            <label className="text-sm font-medium text-slate-700 md:col-span-2 xl:col-span-3">
              İş Kartında Görünecek Not

              <textarea
                value={notes}
                onChange={event =>
                  setNotes(
                    event.target.value
                  )
                }
                rows={4}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-blue-950"
              />
            </label>
          </div>
        ) : null}

        {selectedSale && selectedCustomer ? (
          <div className="mx-4 mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
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
          className="mx-4 mb-4 mt-4 w-[calc(100%-2rem)] rounded-md bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
        >
          Operasyon ve Ajanda Kaydı Oluştur
        </button>
        </section>
      </div>
      ) : null}

      {portalMode.mode === "MANAGEMENT" ? (
        <section
          data-operation-command-center
          className="border-x border-b border-slate-200 bg-white/95 dark:border-slate-800 dark:bg-slate-900/70"
        >
          <div className="flex min-h-11 items-center overflow-x-auto border-b border-slate-200 text-[12px] dark:border-slate-800">
            {[
              {
                label: "Aktif",
                value: commandCenterSummary.active,
                tone: "text-slate-700 dark:text-slate-200"
              },
              {
                label: "Kritik",
                value: commandCenterSummary.critical,
                tone: "text-red-700 dark:text-red-300"
              },
              {
                label: "Termin Riski",
                value: commandCenterSummary.dueSoon,
                tone: "text-amber-700 dark:text-amber-300"
              },
              {
                label: "Bloke",
                value: commandCenterSummary.problem,
                tone: "text-red-800 dark:text-red-300"
              },
              {
                label: "Tamamlanan",
                value: commandCenterSummary.completed,
                tone: "text-emerald-700 dark:text-emerald-300"
              }
            ].map(item => (
              <div
                key={item.label}
                className="flex shrink-0 items-center gap-1 border-r border-slate-200 px-4 py-2.5 dark:border-slate-800"
              >
                <span className="text-[12px] text-slate-600 dark:text-slate-300">
                  {item.label}
                </span>
                <span className={`ml-1 rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${item.tone}`}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>

          <div className="flex min-h-10 flex-col gap-2 bg-slate-50/70 px-2.5 py-2 dark:bg-slate-950/35 md:h-10 md:flex-row md:items-center md:gap-3 md:py-0">
            <label
              className="sr-only"
              htmlFor="operation-search"
            >
              Operasyon ara
            </label>

            <input
              id="operation-search"
              value={searchQuery}
              onChange={event =>
                setSearchQuery(
                  event.target.value
                )
              }
              placeholder="Operasyon, cari, atanan ara..."
              className="h-8 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-[13px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:ring-blue-950 md:max-w-[420px]"
            />

            <select
              value={kindFilter}
              onChange={event =>
                setKindFilter(
                  event.target.value as
                    | "ALL"
                    | OperationKind
                )
              }
              className="h-8 shrink-0 rounded-md border border-slate-300 bg-white px-2.5 text-[12px] text-slate-700 outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              <option value="ALL">
                Tüm İş Türleri
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

            <label className="flex shrink-0 items-center gap-2 text-[12px] text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={event =>
                  setShowCompleted(
                    event.target.checked
                  )
                }
                className="h-3.5 w-3.5"
              />

              Tamamlananları göster
            </label>

            <span className="ml-auto shrink-0 text-[12px] font-medium tabular-nums text-slate-500 dark:text-slate-300">
              Görünen: {visibleOperations.length} iş
            </span>
          </div>
        </section>
      ) : null}

      <section className="mt-3">
        {portalMode.mode === "PROVIDER_READY" ? (
          <div
            data-provider-portal-filter
            className="flex flex-col gap-2 border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center"
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
        ) : null}
        {visibleOperations.length === 0 ? (
          <div className="flex min-h-[150px] max-h-[180px] items-center justify-center rounded-lg border border-slate-200 bg-white/70 px-4 py-5 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900/45">
            <div className="w-full max-w-[400px] rounded-lg border border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="mx-auto grid h-8 w-8 grid-cols-2 gap-1 rounded-md border border-slate-200 bg-slate-50 p-1.5 dark:border-slate-700 dark:bg-slate-800">
                <span className="rounded-sm bg-slate-300 dark:bg-slate-600" />
                <span className="rounded-sm bg-blue-400" />
                <span className="rounded-sm bg-amber-400" />
                <span className="rounded-sm bg-emerald-400" />
              </div>

              <h3 className="mt-2 text-[14px] font-semibold text-slate-900 dark:text-white">
                Aktif Operasyon Bulunmadı
              </h3>

              <p className="mt-1 text-[12px] leading-5 text-slate-500 dark:text-slate-300">
                {portalMode.mode === "PROVIDER_READY"
                  ? portalMode.emptyMessage
                  : "Kriterlere uygun operasyon kaydı yok veya tüm işler tamamlandı."}
              </p>

              {portalMode.mode === "MANAGEMENT" ? (
                <button
                  type="button"
                  onClick={() =>
                    setShowCreateOperation(true)
                  }
                  className="mt-3 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  + Yeni Operasyon Oluştur
                </button>
              ) : null}
            </div>
          </div>        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {visibleOperations.map(
              operation => {
                const late =
                  isLate(operation);

                const readiness =
                  deriveOperationReadiness(
                    operation
                  );

                const releaseProjection =
                  resolveOperationReleaseProjection({
                    operation,
                    productionItems,
                    sourcePlans: productionSourcePlans
                  });

                const risk =
                  deriveOperationRisk(
                    operation,
                    new Date()
                  );

                const timeline =
                  buildOperationTimeline(
                    operation
                  );

                const isExpanded =
                  Boolean(
                    expandedOperationIds[
                      operation.id
                    ]
                  );

                const nextStatus =
                  resolveNextAllowedOperationStatus(
                    operation,
                    currentUser
                      ? {
                          userId:
                            currentUser.id,
                          role:
                            currentUser.role
                        }
                      : null,
                    new Date().toISOString()
                  );
  return (
                  <article
                    data-provider-operation-card={
                      portalMode.mode === "PROVIDER_READY"
                        ? "true"
                        : undefined
                    }
                    key={operation.id}
                    className={`relative border-b border-slate-200 bg-white last:border-b-0 dark:border-slate-800 dark:bg-slate-900 ${late ? "bg-red-50/40 dark:bg-red-950/10" : ""}`}
                  >
                    <div
                      aria-hidden="true"
                      className={`absolute inset-y-0 left-0 w-1 ${
                        readiness.code === "BLOCKED"
                          ? "bg-red-500"
                          : risk.level === "MEDIUM"
                            ? "bg-amber-400"
                            : readiness.code === "COMPLETE"
                              ? "bg-emerald-500"
                              : "bg-blue-500"
                      }`}
                    />
                    <div className="grid min-h-12 grid-cols-1 gap-2 px-3 py-2 pl-4 sm:grid-cols-[minmax(220px,1.5fr)_minmax(150px,0.8fr)_minmax(180px,0.9fr)] sm:items-center">
                      <div className="min-w-0">
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

                          {operation.priority ===
                          "URGENT" ? (
                            <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">
                              ACİL
                            </span>
                          ) : operation.priority ===
                            "PRIORITY" ? (
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                              Öncelikli
                            </span>
                          ) : null}

                          {late ? (
                            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                              Gecikmiş
                            </span>
                          ) : null}
                        </div>

                        <h3 className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {operation.title}
                        </h3>

                        <p className="mt-0.5 truncate text-xs font-medium text-slate-600 dark:text-slate-300">
                          {operation.customerName}
                        </p>

                        <p className="mt-1 text-sm leading-5 text-slate-500">
                          {operation.party?.name}
                        </p>
                      </div>

                      <div className={`text-xs tabular-nums ${late ? "font-semibold text-red-700 dark:text-red-300" : "text-slate-500 dark:text-slate-400"}`}>
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

                    <div
                      data-operation-health-panel
                      className={`grid gap-2 border-t border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950 sm:grid-cols-2 xl:grid-cols-4 ${isExpanded ? "grid" : "hidden"}`}
                    >
                      <div
                          data-operation-release-panel
                          className={`rounded-xl border p-3 ${
                            releaseProjection.label === "BLOKELI"
                              ? "border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100"
                              : releaseProjection.label === "BEKLIYOR"
                                ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"
                                : "border-teal-200 bg-teal-50 text-teal-900 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-cyan-100"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[10px] font-black uppercase tracking-[0.14em] opacity-70">
                              Operasyon Serbestliği
                            </p>
                            <span
                              data-operation-release-state={releaseProjection.label}
                              className="rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-black tracking-wide shadow-sm dark:bg-slate-950/50"
                            >
                              {releaseProjection.label === "BLOKELI"
                                ? "Blokeli"
                                : releaseProjection.label === "BEKLIYOR"
                                  ? "Bağımlılık Bekliyor"
                                  : "Serbest"}
                            </span>
                          </div>

                          <p className="mt-3 text-xs font-black uppercase tracking-[0.12em] opacity-70">
                            Şimdi ne yapmalıyım?
                          </p>
                          <p className="mt-1 text-sm font-semibold leading-5">
                            {releaseProjection.nextAction}
                          </p>

                          {releaseProjection.decision?.waitingDependencyIds.length ? (
                            <p className="mt-2 text-xs opacity-80">
                              Bekleyen: {releaseProjection.decision.waitingDependencyIds.join(", ")}
                            </p>
                          ) : null}

                          {releaseProjection.decision?.blockedDependencyIds.length ? (
                            <p className="mt-2 text-xs opacity-80">
                              Blokeli: {releaseProjection.decision.blockedDependencyIds.join(", ")}
                            </p>
                          ) : null}
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                          Hazırlık
                        </p>
                        <div className="mt-2">
                          <WorkflowReadinessBadge
                            readiness={{
                              code: readiness.code,
                              label: readiness.label,
                              message: readiness.message,
                              tone: readinessTone(readiness.code)
                            }}
                          />
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {readiness.message}
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                          Risk
                        </p>
                        <div className="mt-2">
                          <WorkflowRiskBadge
                            risk={{
                              level: risk.level,
                              label: risk.label,
                              reasons: risk.reasons,
                              tone: riskTone(risk.level)
                            }}
                          />
                        </div>

                        {risk.reasons.length === 0 ? (
                          <p className="mt-1 text-xs text-slate-500">
                            Aktif kritik sinyal yok.
                          </p>
                        ) : null}
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-3 sm:col-span-2 lg:col-span-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                          Atama
                        </p>
                        <div className="mt-2">
                          <WorkflowAssignmentChip
                            assignment={{
                              label: "Atanmamış",
                              partyName: operation.party?.name,
                              assignmentType:
                                operation.party?.assignmentType
                            }}
                          />
                        </div>
                        {operation.party?.phone ? (
                          <div className="mt-1">
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                              Telefon kayıtlı
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="border-t border-slate-200 px-3 py-2 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedOperationIds(
                            previous => ({
                              ...previous,
                              [operation.id]:
                                !previous[
                                  operation.id
                                ]
                            })
                          )
                        }
                        className="flex w-full items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700"
                        aria-expanded={isExpanded}
                      >
                        <span>
                          {isExpanded
                            ? "Detayları Gizle"
                            : "İş Detaylarını Aç"}
                        </span>
                        <span aria-hidden="true">
                          {isExpanded ? "−" : "+"}
                        </span>
                      </button>
                    </div>

                    <div
                      className={`px-3 pb-3 ${
                        isExpanded
                          ? "block"
                          : "hidden"
                      }`}
                    >                    {operation.notes ? (
                      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950">
                        {operation.notes}
                      </div>
                    ) : null}

                    <ul className="mt-4 space-y-1.5 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                      {operation.details.map(
                        (detail, index) => (
                          <li
                            key={`${operation.id}:${index}`}
                            className="flex gap-2 before:mt-2 before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-slate-400"
                          >
                            {detail}
                          </li>
                        )
                      )}
                    </ul>

                      {timeline.length > 0 ? (
                        <div
                          data-operation-timeline
                          className="mt-4 rounded-xl border border-slate-200 bg-white p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-600">
                              Zaman Çizgisi
                            </p>
                            <span className="text-[10px] font-semibold text-slate-400">
                              Kayıtlı olaylar
                            </span>
                          </div>

                          <div className="mt-3">
                            <WorkflowTimeline
                              events={timeline.map(item => {
                                const event =
                                  toWorkflowEvent(item);

                                return {
                                  ...event,
                                  at: new Date(
                                    event.at
                                  ).toLocaleString(
                                    "tr-TR"
                                  )
                                };
                              })}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <div className={`${isExpanded ? "flex" : "hidden"} flex-col gap-2 border-t border-slate-200 p-3 dark:border-slate-800 sm:flex-row sm:flex-wrap [&_button]:w-full sm:[&_button]:w-auto [&_a]:w-full sm:[&_a]:w-auto`}>
                      {portalMode.mode === "PROVIDER_READY" &&
                      providerActor &&
                      providerLink ? (
                        <ProviderOperationActions
                          operation={operation}
                          actor={providerActor}
                          link={providerLink}
                          transitionContext={releaseProjection.context}
                        />
                      ) : null}
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const activeCompanyName =
                              await fetchActiveCompanyDisplayName();

                            openOperationPrintWindow(
                              operation,
                              activeCompanyName
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
                        onClick={async () => {
                          try {
                            const activeCompanyName =
                              await fetchActiveCompanyDisplayName();

                            window.open(
                              buildOperationWhatsAppUrl(
                                operation,
                                activeCompanyName
                              ),
                              "_blank",
                              "noopener,noreferrer"
                            );
                          } catch {
                            window.alert(
                              "Aktif şirket adı okunamadı. WhatsApp çıktısı oluşturulmadı."
                            );
                          }
                        }}
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
                      <>
                        <div className="mt-4 border-t border-slate-100 pt-4">
                          <button
                            type="button"
                            onClick={() =>
                              setCutOperation(
                                operation
                              )
                            }
                            className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
                          >
                            Kesim / Malzeme
                          </button>
                        </div>

                        <OperationChildSummary
                          parent={operation}
                          operations={operations}
                        />
                      </>
                    ) : null}
                  </article>
                );
              }
            )}
          </div>
        )}
      </section>
          {portalMode.mode === "MANAGEMENT" &&
      cutOperation &&
      currentUser ? (
        <MaterialCutDecisionPanel
          operation={cutOperation}
          sale={sales.find(
            sale =>
              sale.id ===
              cutOperation.saleId
          )}
          currentUserId={currentUser.id}
          suppliers={customers
            .filter(
              customer =>
                customer.cariType ===
                  "SUPPLIER" &&
                customer.approvalStatus ===
                  "APPROVED" &&
                !customer.isDeleted &&
                !customer.isArchived &&
                customer.isActive !== false &&
                !customer.isLockedForAllTransactions
            )
            .map(customer => ({
              id: customer.id,
              name: customer.name,
              phone:
                customer.phone ||
                undefined
            }))}
          onClose={() =>
            setCutOperation(null)
          }
        />
      ) : null}

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
            isActive: user.isActive,
            providerCustomerId:
              user.providerCustomerId,
            providerType:
              user.providerType
          }))}
          currentUserId={currentUser.id}
          onClose={() =>
            setRoutingOperation(null)
          }
          onRoute={routeChild}
        />
      ) : null}
</div></main>
  );
}
