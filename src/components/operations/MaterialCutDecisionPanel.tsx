"use client";
import ProcurementDecisionPanel from "@/components/operations/ProcurementDecisionPanel";

import {
  useMemo,
  useState
} from "react";
import type {
  OperationRecord
} from "@/lib/operationsWorkflow";
import {
  buildSaleCutRequirementPlan
} from "@/lib/saleCutRequirementPlan";
import {
  decideCurtainCutMaterial,
  type CurtainPleatClass
} from "@/lib/curtainCutMaterialDecision";
import type {
  Sale,
  SaleItem
} from "@/store/salesStore";
import {
  useSupplyChainStore
} from "@/store/useSupplyChainStore";
import {
  optimizeSaleCutRequirementPlan
} from "@/lib/saleCutOptimizerAdapter";
import type {
  StoreCutLot
} from "@/lib/storeCutPlanning";
import {
  getSaleOperationWorkPackage
} from "@/lib/saleOperationWorkPackages";
import {
  executeTailorFulfillmentToProduction
} from "@/lib/tailorFulfillmentProductionCoordinator";
import {
  executeStoreCutCompletionToProduction
} from "@/lib/storeCutCompletionCoordinator";
import {
  useProductionMaterialStore
} from "@/store/useProductionMaterialStore";
import {
  executeSupplierReceiptToProduction
} from "@/lib/supplierReceiptProductionCoordinator";
import {
  executeMechanicalSupplierReceiptToInstallation
} from "@/lib/mechanicalSupplierReceiptInstallationCoordinator";
import {
  registerSupplierReceiptPayable
} from "@/lib/supplierReceiptPayableBridge";
import {
  useStore
} from "@/store/useStore";

interface MaterialSupplierOption {
  id: string;
  name: string;
  phone?: string;
}

interface MaterialCutDecisionPanelProps {
  operation: OperationRecord;
  sale?: Sale;
  currentUserId: string;
  suppliers: MaterialSupplierOption[];
  onClose(): void;
}

interface PieceSource {
  item: SaleItem;
  parent?: SaleItem;
}

function normalizeText(
  value: string | undefined
): string {
  return (value ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(",", ".");
}

function resolvePleatClass(
  item: SaleItem
): CurtainPleatClass | null {
  const text = normalizeText(
    item.pleatDetails
  );

  if (
    text.includes("sık") ||
    text.includes("x3.1") ||
    text.includes("3.10") ||
    text.includes("3.1")
  ) {
    return "TIGHT";
  }

  if (
    text.includes("normal") ||
    text.includes("x2.6") ||
    text.includes("2.60") ||
    text.includes("2.6")
  ) {
    return "NORMAL";
  }

  if (
    text.includes("seyrek") ||
    text.includes("x2.1") ||
    text.includes("2.10") ||
    text.includes("2.1")
  ) {
    return "SPARSE";
  }

  return null;
}

function pleatLabel(
  value: CurtainPleatClass
): string {
  if (value === "TIGHT") {
    return "Sık";
  }

  if (value === "NORMAL") {
    return "Normal";
  }

  return "Seyrek";
}

function numberText(
  value: number
): string {
  return new Intl.NumberFormat(
    "tr-TR",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }
  ).format(value);
}

function flattenSaleItems(
  sale: Sale
): Map<string, PieceSource> {
  const map =
    new Map<string, PieceSource>();

  sale.items.forEach(parent => {
    map.set(parent.id, {
      item: parent
    });

    parent.productionBreakdown?.forEach(
      detail => {
        map.set(detail.id, {
          item: detail,
          parent
        });
      }
    );
  });

  return map;
}

function availableLotMeters(
  lot: {
    onHandMeters: number;
    reservedMeters: number;
    unusableMeters?: number;
  }
): number {
  return Math.max(
    0,
    lot.onHandMeters -
      lot.reservedMeters -
      (lot.unusableMeters ?? 0)
  );
}

function decisionBadge(
  status: ReturnType<
    typeof decideCurtainCutMaterial
  >["status"]
): {
  label: string;
  className: string;
} {
  if (
    status ===
    "EXACT_OR_MORE_AVAILABLE"
  ) {
    return {
      label: "Uygun",
      className:
        "bg-emerald-50 text-emerald-700 border-emerald-200"
    };
  }

  if (status === "USE_WHOLE_LOT") {
    return {
      label: "Lotun tamamını kullan",
      className:
        "bg-blue-50 text-blue-700 border-blue-200"
    };
  }

  if (
    status ===
    "ACCEPT_WITH_USER_APPROVAL"
  ) {
    return {
      label: "Kullanıcı kararı",
      className:
        "bg-amber-50 text-amber-800 border-amber-200"
    };
  }

  if (status === "SUPPLY_REQUIRED") {
    return {
      label: "Tedarik gerekli",
      className:
        "bg-red-50 text-red-700 border-red-200"
    };
  }

  return {
    label: "Hesaplanamadı",
    className:
      "bg-slate-50 text-slate-700 border-slate-200"
  };
}

export default function MaterialCutDecisionPanel({
  operation,
  sale,
  currentUserId,
  suppliers,
  onClose
}: MaterialCutDecisionPanelProps) {
  const getStoreCutLots =
    useSupplyChainStore(
      state => state.getStoreCutLots
    );

  const reservations =
    useSupplyChainStore(
      state => state.reservations
    );

  const supplierOrders =
    useSupplyChainStore(
      state => state.supplierOrders
    );

  const products =
    useStore(
      state => state.products
    );

  const productionPlans =
    useProductionMaterialStore(
      state => state.plans
    );

  const [cutCompletionDrafts, setCutCompletionDrafts] =
    useState<
      Record<
        string,
        {
          actualCutMeters: string;
          usableOutputMeters: string;
        }
      >
    >({});

  const [supplierReceiptDrafts, setSupplierReceiptDrafts] =
    useState<
      Record<string, string>
    >({});

  const [
    supplierReceiptUnitPriceDrafts,
    setSupplierReceiptUnitPriceDrafts
  ] =
    useState<
      Record<string, string>
    >({});

  const [minimumReusableRemnantMeters, setMinimumReusableRemnantMeters] =
    useState(1);

  const [
    selectedSupplierId,
    setSelectedSupplierId
  ] = useState("");

  const [isCommitting, setIsCommitting] =
    useState(false);

  const cutPlan =
    useMemo(() => {
      if (!sale) {
        return null;
      }

      return buildSaleCutRequirementPlan(
        sale
      );
    }, [sale]);

  const optimization =
    useMemo(() => {
      if (
        !cutPlan ||
        cutPlan.outcome !== "READY"
      ) {
        return null;
      }

      const lotsById =
        new Map<string, StoreCutLot>();

      for (
        const requirement of
        cutPlan.requirements
      ) {
        const lots =
          getStoreCutLots(
            operation,
            requirement.stockItemId
          );

        for (const lot of lots) {
          lotsById.set(
            lot.id,
            lot
          );
        }
      }

      return optimizeSaleCutRequirementPlan(
        cutPlan,
        [...lotsById.values()]
      );
    }, [
      cutPlan,
      getStoreCutLots,
      operation
    ]);

  const workPackage =
    useMemo(
      () =>
        sale
          ? getSaleOperationWorkPackage(
              sale,
              "TAILOR_MATERIAL"
            )
          : undefined,
      [sale]
    );

  const requiresSupplier =
    optimization?.outcome === "READY" &&
    optimization.missingMeters > 0;

  const selectedSupplier =
    suppliers.find(
      supplier =>
        supplier.id ===
        selectedSupplierId
    );

  const itemById =
    useMemo(
      () =>
        sale
          ? flattenSaleItems(sale)
          : new Map<
              string,
              PieceSource
            >(),
      [sale]
    );

  const pendingStoreCuts =
    useMemo(() => {
      if (!sale) {
        return [];
      }

      return productionPlans.flatMap(
        plan =>
          plan.allocations.flatMap(
            allocation => {
              if (
                allocation.sourceType !==
                  "STORE_CUT" ||
                allocation.status !==
                  "RESERVED" ||
                !allocation.reservationId
              ) {
                return [];
              }

              const reservation =
                reservations.find(
                  current =>
                    current.id ===
                      allocation
                        .reservationId &&
                    current.saleId ===
                      sale.id &&
                    current.status ===
                      "ACTIVE" &&
                    current.tenantId ===
                      operation.tenantId &&
                    current.companyId ===
                      operation.companyId &&
                    current.branchId ===
                      operation.branchId &&
                    current.accountingPeriodId ===
                      operation
                        .accountingPeriodId
                );

              if (!reservation) {
                return [];
              }

              return [
                {
                  plan,
                  allocation,
                  reservation
                }
              ];
            }
          )
      );
    }, [
      productionPlans,
      reservations,
      sale,
      operation
    ]);

  const pendingSupplierReceipts =
    useMemo(() => {
      if (!sale) {
        return [];
      }

      return supplierOrders
        .filter(
          order =>
            order.saleId === sale.id &&
            order.tenantId ===
              operation.tenantId &&
            order.companyId ===
              operation.companyId &&
            order.branchId ===
              operation.branchId &&
            order.accountingPeriodId ===
              operation
                .accountingPeriodId &&
            order.receivedQuantity <
              order.orderedQuantity
        )
        .filter(
          order =>
            order.purpose ===
              "MECHANICAL_PRODUCT" ||
            (order.purpose ===
              "TAILOR_MATERIAL" &&
            productionPlans.some(
              plan =>
                plan.allocations.some(
                  allocation =>
                    allocation.sourceType ===
                      "SUPPLIER_ORDER" &&
                    allocation.supplierOrderId ===
                      order.id
                )
            ))
        );
    }, [
      supplierOrders,
      productionPlans,
      sale,
      operation
    ]);

  const handleReceiveSupplierMaterial = (
    supplierOrder:
      (typeof pendingSupplierReceipts)[number]
  ) => {
    if (!currentUserId.trim()) {
      window.alert(
        "Aktif kullanıcı bulunamadı."
      );
      return;
    }

    const remaining =
      supplierOrder.orderedQuantity -
      supplierOrder.receivedQuantity;

    const purpose =
      supplierOrder.purpose;

    if (
      purpose !== "TAILOR_MATERIAL" &&
      purpose !== "MECHANICAL_PRODUCT"
    ) {
      window.alert(
        "Tedarikçi siparişi kullanım amacı eksik veya geçersiz."
      );
      return;
    }

    const unit =
      supplierOrder.orderedUnit ??
      "mt";

    const unitLabel =
      unit === "m2"
        ? "m²"
        : unit === "adet"
          ? "adet"
          : "m";

    const isMechanical =
      purpose ===
      "MECHANICAL_PRODUCT";

    const receivedQuantity =
      Number(
        (
          supplierReceiptDrafts[
            supplierOrder.id
          ] ??
          String(remaining)
        ).replace(",", ".")
      );

    if (
      !Number.isFinite(
        receivedQuantity
      ) ||
      receivedQuantity <= 0 ||
      receivedQuantity >
        remaining + 0.000001
    ) {
      window.alert(
        "Kontrol edilmiş gelen miktarı kalan sipariş miktarını aşmayacak şekilde girin."
      );
      return;
    }

    const unitPrice =
      Number(
        (
          supplierReceiptUnitPriceDrafts[
            supplierOrder.id
          ] ??
          ""
        ).replace(",", ".")
      );

    if (
      !Number.isFinite(
        unitPrice
      ) ||
      unitPrice <= 0
    ) {
      window.alert(
        "Tedarikçi teslimi için gerçek alış birim fiyatı zorunludur."
      );
      return;
    }

    const product =
      products.find(
        current =>
          current.id ===
          supplierOrder.stockItemId
      );

    const purchaseVatRate =
      Number(
        product?.purchaseVatRate
      );

    if (
      ![
        0,
        1,
        10,
        20
      ].includes(
        purchaseVatRate
      )
    ) {
      window.alert(
        "Stok kartında geçerli Alış KDV oranı (0, 1, 10 veya 20) bulunmalıdır."
      );
      return;
    }

    const supplier =
      suppliers.find(
        current =>
          current.id ===
          supplierOrder.supplierId
      );

    if (!supplier) {
      window.alert(
        "Siparişin bağlı olduğu tedarikçi cari bulunamadı."
      );
      return;
    }

    const confirmed =
      window.confirm(
        [
          "Tedarikçi teslimi kaydedilsin mi?",
          isMechanical
            ? "Girilen miktar fiziksel olarak gelmiş ve kontrol edilmiş mekanik ürün kabul edilecektir."
            : "Girilen miktar kontrol edilmiş ve terzi için kullanılabilir kabul edilecektir.",
          `Bu teslim: ${receivedQuantity} ${unitLabel}`,
          `Siparişte kalan: ${remaining} ${unitLabel}`
        ].join("\n")
      );

    if (!confirmed) {
      return;
    }

    setIsCommitting(true);

    try {
      const now =
        new Date().toISOString();

      const request = {
        tenantId:
          supplierOrder.tenantId,
        companyId:
          supplierOrder.companyId,
        branchId:
          supplierOrder.branchId,
        accountingPeriodId:
          supplierOrder
            .accountingPeriodId,
        id:
          `supplier-receipt:${supplierOrder.id}:${supplierOrder.receivedQuantity}:${receivedQuantity}`,
        idempotencyKey:
          `SUPPLIER_RECEIPT:${supplierOrder.id}:${supplierOrder.receivedQuantity}:${receivedQuantity}`,
        supplierOrderId:
          supplierOrder.id,
        receivedQuantity,
        receivedByUserId:
          currentUserId,
        receivedAt: now
      };

      if (isMechanical) {
        const result =
          executeMechanicalSupplierReceiptToInstallation({
            request,
            now
          });

        if (
          result.outcome ===
          "REJECTED"
        ) {
          window.alert(
            [
              "Mekanik ürün teslimi reddedildi.",
              ...result.errors
            ].join("\n")
          );
          return;
        }

        setSupplierReceiptDrafts(
          current => {
            const next = {
              ...current
            };
            delete next[
              supplierOrder.id
            ];
            return next;
          }
        );

        if (
          result.outcome ===
          "PARTIALLY_RECEIVED"
        ) {
          window.alert(
            "Kısmi mekanik ürün teslimi kaydedildi. Kalan miktar bekleniyor."
          );
          return;
        }

        if (
          result.outcome ===
          "WAITING_ASSIGNMENT"
        ) {
          window.alert(
            "Mekanik ürün tamamen teslim alındı ve montaja hazır. Montajcı ataması bekleniyor."
          );
          return;
        }

        if (
          result.outcome ===
          "READY_NOT_ROUTED"
        ) {
          window.alert(
            "Mekanik ürün tamamen teslim alındı. Montaj yönlendirmesi tamamlanamadı; Operasyonlar ekranında kontrol bekliyor."
          );
          return;
        }

        if (
          result.outcome ===
          "READY_NO_INSTALLATION"
        ) {
          window.alert(
            "Mekanik ürün tamamen teslim alındı. Bu stok kartı montaj gerektirmiyor."
          );
          return;
        }

        window.alert(
          result.outcome === "REPLAY"
            ? "Bu mekanik teslim daha önce kaydedilmiş. Mevcut montaj yönlendirmesi korundu."
            : "Mekanik ürün tamamen teslim alındı ve montaj iş emri oluşturuldu."
        );

        return;
      }

      const result =
        executeSupplierReceiptToProduction({
          request
        });

      if (
        result.outcome ===
        "REJECTED"
      ) {
        window.alert(
          [
            "Tedarikçi teslimi reddedildi.",
            ...result.errors
          ].join("\n")
        );
        return;
      }

      const persistedReceipt =
        useSupplyChainStore
          .getState()
          .supplierReceipts
          .filter(
            receipt =>
              receipt.supplierOrderId ===
                supplierOrder.id &&
              receipt.receivedAt ===
                now &&
              receipt.receivedQuantity ===
                receivedQuantity
          )
          .sort(
            (
              left,
              right
            ) =>
              right.id.localeCompare(
                left.id
              )
          )[0];

      if (!persistedReceipt) {
        window.alert(
          "Teslim kaydedildi ancak finans köprüsü için teslim kaydı bulunamadı."
        );
        return;
      }

      const payable =
        registerSupplierReceiptPayable({
          order:
            supplierOrder,
          receipt:
            persistedReceipt,
          supplierName:
            supplier.name,
          unitPrice,
          purchaseVatRate,
          stockCode:
            product?.stockCode,
          stockName:
            product?.name,
          createdByUserId:
            currentUserId
        });

      if (
        payable.outcome ===
        "REJECTED"
      ) {
        window.alert(
          `Teslim kaydedildi ancak tedarikçi cari borcu oluşturulamadı: ${payable.reason}`
        );
        return;
      }

      setSupplierReceiptDrafts(
        current => {
          const next = {
            ...current
          };
          delete next[
            supplierOrder.id
          ];
          return next;
        }
      );

      setSupplierReceiptUnitPriceDrafts(
        current => {
          const next = {
            ...current
          };

          delete next[
            supplierOrder.id
          ];

          return next;
        }
      );

      window.alert(
        result.releasedForCutting
          ? "Tedarikçi malzemesi teslim alındı ve kontrol edildi. Tüm kaynaklar hazır; üretim serbest bırakıldı."
          : result.supplierOrder.status ===
              "READY_FOR_TAILOR"
            ? "Tedarikçi siparişi tamamen teslim alındı ve terzi için hazır. Diğer malzeme kaynakları bekleniyor."
            : "Kısmi teslim kaydedildi. Yalnız gelen kullanılabilir miktar hazır sayıldı; kalan miktar bekleniyor."
      );
    }
    finally {
      setIsCommitting(false);
    }
  };

  const handleCompleteStoreCut = (
    entry:
      (typeof pendingStoreCuts)[number]
  ) => {
    if (!currentUserId.trim()) {
      window.alert(
        "Aktif kullanıcı bulunamadı."
      );
      return;
    }

    const draft =
      cutCompletionDrafts[
        entry.reservation.id
      ];

    const actualCutMeters =
      Number(
        (
          draft?.actualCutMeters ??
          String(
            entry.allocation.quantity
          )
        ).replace(",", ".")
      );

    const usableOutputMeters =
      Number(
        (
          draft?.usableOutputMeters ??
          String(
            entry.allocation.quantity
          )
        ).replace(",", ".")
      );

    if (
      !Number.isFinite(
        actualCutMeters
      ) ||
      !Number.isFinite(
        usableOutputMeters
      ) ||
      actualCutMeters <= 0 ||
      usableOutputMeters < 0
    ) {
      window.alert(
        "Gerçek kesim ve kullanılabilir çıktı miktarlarını kontrol edin."
      );
      return;
    }

    const confirmed =
      window.confirm(
        [
          "Mağaza kesimi tamamlandı olarak kaydedilsin mi?",
          `Gerçek kesim: ${actualCutMeters} m`,
          `Kullanılabilir çıktı: ${usableOutputMeters} m`
        ].join("\n")
      );

    if (!confirmed) {
      return;
    }

    setIsCommitting(true);

    try {
      const now =
        new Date().toISOString();

      const result =
        executeStoreCutCompletionToProduction({
          request: {
            tenantId:
              operation.tenantId,
            companyId:
              operation.companyId,
            branchId:
              operation.branchId,
            accountingPeriodId:
              operation
                .accountingPeriodId,
            id:
              `cut-completion:${entry.reservation.id}`,
            idempotencyKey:
              `STORE_CUT_COMPLETION:${entry.reservation.id}`,
            cutOrderId:
              `cut-order:${entry.reservation.id}`,
            reservationId:
              entry.reservation.id,
            saleId:
              entry.reservation.saleId,
            saleItemId:
              entry.reservation
                .saleItemId,
            productionOrderId:
              entry.reservation
                .productionOrderId,
            stockItemId:
              entry.reservation
                .stockItemId,
            stockLotId:
              entry.reservation
                .stockLotId,
            reservedMeters:
              entry.reservation
                .quantityMeters,
            plannedCutMeters:
              entry.allocation.quantity,
            actualCutMeters,
            usableOutputMeters,
            completedByUserId:
              currentUserId,
            completedAt: now
          }
        });

      if (
        result.outcome ===
        "REJECTED"
      ) {
        window.alert(
          [
            "Kesim tamamlama reddedildi.",
            ...result.errors
          ].join("\n")
        );
        return;
      }

      setCutCompletionDrafts(
        current => {
          const next = {
            ...current
          };
          delete next[
            entry.reservation.id
          ];
          return next;
        }
      );

      window.alert(
        result.releasedForCutting
          ? "Kesim tamamlandı. Malzeme kaynağı hazır ve üretim kesim aşamasına serbest bırakıldı."
          : "Kesim tamamlandı. Kullanılabilir malzeme henüz toplam ihtiyacı karşılamadığı için üretim kapısı kapalı tutuldu."
      );
    }
    finally {
      setIsCommitting(false);
    }
  };

  const handleCommit = () => {
    if (!sale) {
      window.alert(
        "Bağlı satış bulunamadı."
      );
      return;
    }

    if (!currentUserId.trim()) {
      window.alert(
        "Aktif kullanıcı bulunamadı."
      );
      return;
    }

    if (!workPackage) {
      window.alert(
        "Satışta TAILOR_MATERIAL iş paketi bulunamadı."
      );
      return;
    }

    if (
      !optimization ||
      optimization.outcome !== "READY"
    ) {
      window.alert(
        "Kesim optimizasyonu hazır değil."
      );
      return;
    }

    if (
      requiresSupplier &&
      !selectedSupplier
    ) {
      window.alert(
        "Stok eksiği için onaylı tedarikçi cari seçilmelidir."
      );
      return;
    }

    const confirmed =
      window.confirm(
        requiresSupplier
          ? "Stok rezervasyonu ve tedarik siparişi oluşturulsun mu?"
          : "Uygun stoklar bu satış için rezerve edilsin mi?"
      );

    if (!confirmed) {
      return;
    }

    setIsCommitting(true);

    try {
      const result =
        executeTailorFulfillmentToProduction({
          workPackage,
          fulfillmentInput: {
            tenantId:
              operation.tenantId,
            companyId:
              operation.companyId,
            branchId:
              operation.branchId,
            accountingPeriodId:
              operation.accountingPeriodId,
            saleId: sale.id,
            productionOrderId:
              `production-order:${sale.id}`,
            purchaseOrderId:
              `purchase-order:${sale.id}`,
            supplierId:
              selectedSupplier?.id,
            supplierName:
              selectedSupplier?.name,
            createdByUserId:
              currentUserId,
            now:
              new Date().toISOString(),
            optimization
          }
        });

      if (
        result.outcome ===
        "REJECTED"
      ) {
        window.alert(
          [
            "Malzeme işlemi reddedildi.",
            ...result.errors
          ].join("\n")
        );
        return;
      }

      window.alert(
        result.fulfillment
          .supplierMeters > 0
          ? "Stok rezervasyonu ve tedarik planı oluşturuldu. Eksik malzeme gelmeden üretim serbest bırakılmaz."
          : "Stok rezervasyonu ve üretim kaynak planı oluşturuldu. Malzeme hazırlama/kesim tamamlanmadan terzi işi serbest bırakılmaz."
      );

      onClose();
    }
    finally {
      setIsCommitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-end bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label="Kesim ve malzeme kararı"
      onClick={onClose}
    >
      <section
        className="h-full w-full max-w-3xl overflow-y-auto bg-white p-5 shadow-2xl"
        onClick={event =>
          event.stopPropagation()
        }
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Kesim / Malzeme Kararı
            </h2>

            <p className="mt-1 text-sm text-slate-600">
              {operation.customerName}
              {" — "}
              {operation.title}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Bu ekran ön izleme modundadır.
              Stok rezervasyonu, tedarik siparişi
              veya üretim serbest bırakma işlemi
              yapmaz.
            </p>
          </div>
      <ProcurementDecisionPanel
        operation={operation}
        sale={sale}
        currentUserId={currentUserId}
        suppliers={suppliers}
      />

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Kapat
          </button>
        </header>

        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <label className="block text-sm font-semibold text-slate-800">
            Mikro-artık sınırı
          </label>

          <div className="mt-2 flex items-center gap-3">
            <input
              type="number"
              min="0"
              step="0.1"
              value={
                minimumReusableRemnantMeters
              }
              onChange={event => {
                const value =
                  Number(
                    event.target.value
                  );

                setMinimumReusableRemnantMeters(
                  Number.isFinite(value) &&
                    value >= 0
                    ? value
                    : 0
                );
              }}
              className="w-32 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />

            <span className="text-sm text-slate-600">
              metre — yalnız simülasyon içindir,
              henüz ürün/stok politikasına
              kaydedilmez.
            </span>
          </div>
        </div>

        {!sale ? (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Operasyonun bağlı satış kaydı
            bulunamadı.
          </div>
        ) : null}

        {cutPlan?.outcome ===
        "REJECTED" ? (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="font-semibold text-amber-900">
              Kesim planı hazırlanamadı:
              {" "}
              {cutPlan.reason}
            </p>

            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">
              {cutPlan.errors.map(error => (
                <li key={error}>
                  {error}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {cutPlan?.outcome === "READY" ? (
          <div className="mt-5 space-y-5">
            {cutPlan.requirements.flatMap(
              requirement =>
                requirement.pieces.map(
                  piece => {
                    const source =
                      itemById.get(
                        piece.saleItemId
                      );

                    const pleat =
                      source
                        ? resolvePleatClass(
                            source.item
                          ) ??
                          (
                            source.parent
                              ? resolvePleatClass(
                                  source.parent
                                )
                              : null
                          )
                        : null;

                    const lots =
                      getStoreCutLots(
                        operation,
                        piece.stockItemId
                      );

                    return (
                      <article
                        key={piece.id}
                        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="font-bold text-slate-900">
                              {piece.roomName}
                              {" / "}
                              {piece.openingName}
                            </h3>

                            <p className="mt-1 text-sm text-slate-600">
                              {piece.productType}
                            </p>
                          </div>

                          <div className="text-right">
                            <div className="text-xs text-slate-500">
                              Gereken
                            </div>

                            <div className="text-lg font-bold text-slate-900">
                              {numberText(
                                piece.requiredMeters
                              )}{" "}
                              m
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                            Stok:
                            {" "}
                            {piece.stockItemId}
                          </span>

                          {pleat ? (
                            <span className="rounded-full bg-indigo-50 px-3 py-1 font-medium text-indigo-700">
                              {pleatLabel(pleat)}
                              {" pile"}
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-800">
                              Pile bilgisi
                              okunamadı
                            </span>
                          )}
                        </div>

                        {lots.length === 0 ? (
                          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                            Bu stok kartına bağlı
                            kullanılabilir lot
                            bulunamadı.
                          </div>
                        ) : (
                          <div className="mt-4 space-y-3">
                            {lots.map(lot => {
                              const available =
                                availableLotMeters(
                                  lot
                                );

                              if (!pleat) {
                                return (
                                  <div
                                    key={lot.id}
                                    className="rounded-lg border border-slate-200 p-3"
                                  >
                                    <div className="font-semibold text-slate-900">
                                      {lot.lotCode ||
                                        lot.id}
                                    </div>

                                    <div className="mt-1 text-sm text-slate-600">
                                      Kullanılabilir:
                                      {" "}
                                      {numberText(
                                        available
                                      )}{" "}
                                      m
                                    </div>

                                    <div className="mt-2 text-xs text-amber-700">
                                      Pile bilgisi
                                      olmadığı için
                                      tolerans kararı
                                      üretilmedi.
                                    </div>
                                  </div>
                                );
                              }

                              const decision =
                                decideCurtainCutMaterial({
                                  selectedPleat:
                                    pleat,
                                  requiredMeters:
                                    piece.requiredMeters,
                                  availableMeters:
                                    available,
                                  minimumReusableRemnantMeters
                                });

                              const badge =
                                decisionBadge(
                                  decision.status
                                );

                              return (
                                <div
                                  key={lot.id}
                                  className="rounded-lg border border-slate-200 p-3"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                      <div className="font-semibold text-slate-900">
                                        {lot.lotCode ||
                                          lot.id}
                                      </div>

                                      <div className="mt-1 text-xs text-slate-500">
                                        Kullanılabilir:
                                        {" "}
                                        {numberText(
                                          available
                                        )}{" "}
                                        m
                                      </div>
                                    </div>

                                    <span
                                      className={
                                        "rounded-full border px-3 py-1 text-xs font-semibold " +
                                        badge.className
                                      }
                                    >
                                      {badge.label}
                                    </span>
                                  </div>

                                  <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                                    <div>
                                      Efektif pile:
                                      {" "}
                                      <strong>
                                        ×
                                        {numberText(
                                          decision.effectivePleatRatio
                                        )}
                                      </strong>
                                    </div>

                                    <div>
                                      Üretime önerilen:
                                      {" "}
                                      <strong>
                                        {numberText(
                                          decision.plannedProductionMeters
                                        )}{" "}
                                        m
                                      </strong>
                                    </div>

                                    <div>
                                      Stokta kalacak:
                                      {" "}
                                      <strong>
                                        {numberText(
                                          decision.inventoryRemainderMeters
                                        )}{" "}
                                        m
                                      </strong>
                                    </div>

                                    <div>
                                      Fire:
                                      {" "}
                                      <strong>
                                        {numberText(
                                          decision.wasteMeters
                                        )}{" "}
                                        m
                                      </strong>
                                    </div>
                                  </div>

                                  {decision.status ===
                                  "USE_WHOLE_LOT" ? (
                                    <p className="mt-3 rounded-lg bg-blue-50 p-2 text-xs font-medium text-blue-800">
                                      Küçük artık ayrı
                                      lot yapılmaz;
                                      lotun tamamı
                                      üretime önerilir.
                                    </p>
                                  ) : null}

                                  {decision.status ===
                                  "ACCEPT_WITH_USER_APPROVAL" ? (
                                    <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs font-medium text-amber-800">
                                      Mevcut lot seçilen
                                      pile sınıfının
                                      tolerans bölgesinde.
                                      Gerçek işlemde
                                      kullanıcı onayı
                                      gerekecek.
                                    </p>
                                  ) : null}

                                  {decision.status ===
                                  "SUPPLY_REQUIRED" ? (
                                    <p className="mt-3 rounded-lg bg-red-50 p-2 text-xs font-medium text-red-700">
                                      Seçilen pile
                                      sınıfının altına
                                      düşüyor. Gerçek
                                      işlemde tedarik
                                      yolu açılacak.
                                    </p>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </article>
                    );
                  }
                )
            )}
          </div>
        ) : null}

        {pendingSupplierReceipts.length > 0 ? (
          <section className="mt-6 rounded-xl border border-cyan-200 bg-cyan-50 p-4">
            <h3 className="font-bold text-cyan-950">
              Tedarikçi Teslimini Al
            </h3>

            <p className="mt-2 text-sm text-cyan-900">
              Fiziksel olarak gelen ve kontrol edilen tedarikçi teslimini girin. Terzi malzemesi üretime, mekanik ürün ise operasyon/montaj akışına yönlendirilir.
            </p>

            <div className="mt-4 space-y-3">
              {pendingSupplierReceipts.map(
                supplierOrder => {
                  const remaining =
                    supplierOrder
                      .orderedQuantity -
                    supplierOrder
                      .receivedQuantity;

                  const displayUnit =
                    supplierOrder
                      .orderedUnit === "m2"
                      ? "m²"
                      : supplierOrder
                            .orderedUnit ===
                          "adet"
                        ? "adet"
                        : "m";

                  const supplierName =
                    suppliers.find(
                      supplier =>
                        supplier.id ===
                          supplierOrder
                            .supplierId
                    )?.name ??
                    supplierOrder
                      .supplierId;

                  return (
                    <div
                      key={
                        supplierOrder.id
                      }
                      className="rounded-lg border border-cyan-200 bg-white p-3"
                    >
                      <div className="text-sm font-semibold text-slate-900">
                        {supplierName}
                      </div>

                      <div className="mt-1 grid gap-1 text-xs text-slate-600 sm:grid-cols-3">
                        <div>
                          Sipariş:{" "}
                          {numberText(
                            supplierOrder
                              .orderedQuantity
                          )}{" "}
                          m
                        </div>

                        <div>
                          Alınan:{" "}
                          {numberText(
                            supplierOrder
                              .receivedQuantity
                          )}{" "}
                          m
                        </div>

                        <div>
                          Kalan:{" "}
                          {numberText(
                            remaining
                          )}{" "}
                          m
                        </div>
                      </div>

                      <label className="mt-3 block text-xs font-semibold text-slate-700">
                        Kontrol Edilmiş Gelen Miktar ({displayUnit})

                        <input
                          type="number"
                          min="0.01"
                          max={remaining}
                          step="0.01"
                          value={
                            supplierReceiptDrafts[
                              supplierOrder.id
                            ] ??
                            String(remaining)
                          }
                          onChange={event =>
                            setSupplierReceiptDrafts(
                              current => ({
                                ...current,
                                [supplierOrder.id]:
                                  event.target
                                    .value
                              })
                            )
                          }
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                        />
                      </label>

                      <label className="mt-3 block text-sm font-semibold text-slate-800">
                        Gerçek Alış Birim Fiyatı (KDV hariç)

                        <input
                          type="text"
                          inputMode="decimal"
                          value={
                            supplierReceiptUnitPriceDrafts[
                              supplierOrder.id
                            ] ??
                            ""
                          }
                          onChange={event =>
                            setSupplierReceiptUnitPriceDrafts(
                              current => ({
                                ...current,
                                [supplierOrder.id]:
                                  event.target.value
                              })
                            )
                          }
                          placeholder="Örn. 198,00"
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                        />

                        <span className="mt-1 block text-xs font-normal text-slate-500">
                          Teslim tarihindeki gerçek alış fiyatı snapshot olarak saklanır; sonraki stok kartı fiyat değişiklikleri geçmiş borcu değiştirmez.
                        </span>
                      </label>

                      <button
                        type="button"
                        onClick={() =>
                          handleReceiveSupplierMaterial(
                            supplierOrder
                          )
                        }
                        disabled={isCommitting}
                        className="mt-3 w-full rounded-lg bg-cyan-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Teslim Al ve Kontrol Edildi
                      </button>
                    </div>
                  );
                }
              )}
            </div>
          </section>
        ) : null}

        {pendingStoreCuts.length > 0 ? (
          <section className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <h3 className="font-bold text-emerald-950">
              Mağaza Kesimini Tamamla
            </h3>

            <p className="mt-2 text-sm text-emerald-900">
              Rezerve edilen kumaş fiziksel olarak kesildiğinde gerçek kesim ve kullanılabilir çıktı miktarını girin.
            </p>

            <div className="mt-4 space-y-3">
              {pendingStoreCuts.map(
                entry => {
                  const draft =
                    cutCompletionDrafts[
                      entry.reservation.id
                    ];

                  return (
                    <div
                      key={
                        entry.reservation.id
                      }
                      className="rounded-lg border border-emerald-200 bg-white p-3"
                    >
                      <div className="text-sm font-semibold text-slate-900">
                        Lot:{" "}
                        {entry.reservation.stockLotId}
                      </div>

                      <div className="mt-1 text-xs text-slate-600">
                        Rezerve:{" "}
                        {numberText(
                          entry.reservation
                            .quantityMeters
                        )}{" "}
                        m
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className="text-xs font-semibold text-slate-700">
                          Gerçek Kesim (m)

                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={
                              draft
                                ?.actualCutMeters ??
                              String(
                                entry.allocation
                                  .quantity
                              )
                            }
                            onChange={event =>
                              setCutCompletionDrafts(
                                current => ({
                                  ...current,
                                  [entry.reservation.id]:
                                    {
                                      actualCutMeters:
                                        event.target
                                          .value,
                                      usableOutputMeters:
                                        current[
                                          entry
                                            .reservation
                                            .id
                                        ]
                                          ?.usableOutputMeters ??
                                        String(
                                          entry
                                            .allocation
                                            .quantity
                                        )
                                    }
                                })
                              )
                            }
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                          />
                        </label>

                        <label className="text-xs font-semibold text-slate-700">
                          Kullanılabilir Çıktı (m)

                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={
                              draft
                                ?.usableOutputMeters ??
                              String(
                                entry.allocation
                                  .quantity
                              )
                            }
                            onChange={event =>
                              setCutCompletionDrafts(
                                current => ({
                                  ...current,
                                  [entry.reservation.id]:
                                    {
                                      actualCutMeters:
                                        current[
                                          entry
                                            .reservation
                                            .id
                                        ]
                                          ?.actualCutMeters ??
                                        String(
                                          entry
                                            .allocation
                                            .quantity
                                        ),
                                      usableOutputMeters:
                                        event.target
                                          .value
                                    }
                                })
                              )
                            }
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                          />
                        </label>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          handleCompleteStoreCut(
                            entry
                          )
                        }
                        disabled={isCommitting}
                        className="mt-3 w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Kesimi Tamamla
                      </button>
                    </div>
                  );
                }
              )}
            </div>

            <p className="mt-3 text-xs text-emerald-900">
              Kullanılabilir çıktı planlanan miktardan düşükse eksik miktar hazır sayılmaz ve üretim kapısı kapalı kalır.
            </p>
          </section>
        ) : null}

        {optimization?.outcome === "READY" ? (
          <section className="mt-6 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
            <h3 className="font-bold text-indigo-950">
              Malzeme Kaynağını Kesinleştir
            </h3>

            <p className="mt-2 text-sm text-indigo-900">
              Stoktan karşılanan:{" "}
              <strong>
                {numberText(
                  optimization.totalMeters -
                    optimization.missingMeters
                )}{" "}
                m
              </strong>
              {" — "}
              Eksik / tedarik:{" "}
              <strong>
                {numberText(
                  optimization.missingMeters
                )}{" "}
                m
              </strong>
            </p>

            {requiresSupplier ? (
              <label className="mt-4 block text-sm font-semibold text-slate-800">
                Tedarikçi Cari

                <select
                  value={selectedSupplierId}
                  onChange={event =>
                    setSelectedSupplierId(
                      event.target.value
                    )
                  }
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                >
                  <option value="">
                    Onaylı tedarikçi seçin
                  </option>

                  {suppliers.map(
                    supplier => (
                      <option
                        key={supplier.id}
                        value={supplier.id}
                      >
                        {supplier.name}
                      </option>
                    )
                  )}
                </select>

                {suppliers.length === 0 ? (
                  <span className="mt-2 block text-xs font-medium text-red-700">
                    Aktif ve onaylı SUPPLIER cari bulunamadı.
                    Tedarik işlemi kapalıdır.
                  </span>
                ) : null}
              </label>
            ) : (
              <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
                Mevcut stok planı yeterli. Tedarikçi seçimi gerekmez.
              </p>
            )}

            <button
              type="button"
              onClick={handleCommit}
              disabled={
                isCommitting ||
                !sale ||
                !currentUserId.trim() ||
                !workPackage ||
                (
                  requiresSupplier &&
                  !selectedSupplier
                )
              }
              className="mt-4 w-full rounded-lg bg-indigo-700 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCommitting
                ? "İşleniyor..."
                : "Malzeme Kaynağını Kesinleştir"}
            </button>

            <p className="mt-2 text-xs text-indigo-800">
              Bu işlem stok rezervasyonu ve gerekiyorsa
              tedarik siparişi oluşturur. Malzeme gerçekten
              hazır olmadan terzi üretimi serbest bırakılmaz.
            </p>
          </section>
        ) : null}
      </section>
    </div>
  );
}