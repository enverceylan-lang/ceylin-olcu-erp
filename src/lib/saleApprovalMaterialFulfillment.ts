import type {
  ErpScope
} from "@/lib/erpScope";
import {
  buildSaleCutRequirementPlan
} from "@/lib/saleCutRequirementPlan";
import {
  optimizeSaleCutRequirementPlan,
  type SaleCutOptimizationResult
} from "@/lib/saleCutOptimizerAdapter";
import {
  buildSaleOperationWorkPackages
} from "@/lib/saleOperationWorkPackages";
import {
  executeSaleSupplyFulfillment,
  type SaleSupplyFulfillmentResult
} from "@/lib/saleSupplyFulfillmentOrchestrator";
import {
  buildProductionSourcePlansFromFulfillment
} from "@/lib/supplyFulfillmentProductionSourceBridge";
import {
  useProductionMaterialStore
} from "@/store/useProductionMaterialStore";
import {
  useSupplyChainStore
} from "@/store/useSupplyChainStore";
import {
  useStore
} from "@/store/useStore";
import type {
  Sale
} from "@/store/salesStore";

export type SaleApprovalMaterialFulfillmentResult =
  | {
      outcome: "SKIPPED";
      reason:
        | "NOT_APPROVED"
        | "NO_TAILOR_MATERIAL_PACKAGE";
    }
  | {
      outcome: "COMMITTED";
      reservationIds: string[];
      supplierOrderIds: string[];
      productionPlanCount: number;
    }
  | {
      outcome: "REJECTED";
      stage:
        | "ROUTING"
        | "CUT_PLAN"
        | "OPTIMIZATION"
        | "SUPPLIER_RESOLUTION"
        | "FULFILLMENT"
        | "SOURCE_BRIDGE"
        | "PRODUCTION_STORE";
      errors: string[];
    };

interface SupplierResolution {
  id: string;
  name: string;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function rollbackCreated(
  scope: ErpScope,
  reservationIds: string[],
  supplierOrderIds: string[]
): void {
  useSupplyChainStore
    .getState()
    .rollbackFulfillmentCreated({
      scope,
      reservationIds:
        unique(reservationIds),
      supplierOrderIds:
        unique(supplierOrderIds)
    });
}

function buildSingleStockOptimization(
  saleId: string,
  stockRequirement:
    Extract<
      SaleCutOptimizationResult,
      { outcome: "READY" }
    >["stockRequirements"][number]
): SaleCutOptimizationResult {
  return {
    outcome: "READY",
    saleId,
    stockRequirements: [
      stockRequirement
    ],
    totalMeters:
      stockRequirement.totalMeters,
    missingMeters:
      stockRequirement.missingMeters
  };
}

export function executeSaleApprovalMaterialFulfillment(
  input: {
    sale: Sale;
    scope: ErpScope;
    actorUserId: string;
    now?: string;
  }
): SaleApprovalMaterialFulfillmentResult {
  if (
    input.sale.status !==
    "ONAYLANDI"
  ) {
    return {
      outcome: "SKIPPED",
      reason: "NOT_APPROVED"
    };
  }

  const packagePlan =
    buildSaleOperationWorkPackages(
      input.sale
    );

  if (packagePlan.hasBlockingReview) {
    return {
      outcome: "REJECTED",
      stage: "ROUTING",
      errors: [
        "Satışta otomatik yönlendirmeyi engelleyen aksesuar veya manuel inceleme kalemi bulunuyor."
      ]
    };
  }

  const workPackage =
    packagePlan.packages.find(
      candidate =>
        candidate.kind ===
        "TAILOR_MATERIAL"
    );

  if (!workPackage) {
    return {
      outcome: "SKIPPED",
      reason:
        "NO_TAILOR_MATERIAL_PACKAGE"
    };
  }

  /*
   * Kesim/lot motoruna yalnız TAILOR_MATERIAL kalemleri verilir.
   * SUPPLIER_MECHANICAL ayrı iş paketidir; m2/adet semantiği
   * metre kesim motoruna zorlanmaz.
   */
  const tailorSale: Sale = {
    ...input.sale,
    items: workPackage.items
  };

  const cutPlan =
    buildSaleCutRequirementPlan(
      tailorSale
    );

  if (cutPlan.outcome !== "READY") {
    return {
      outcome: "REJECTED",
      stage: "CUT_PLAN",
      errors: cutPlan.errors
    };
  }

  const supplyState =
    useSupplyChainStore.getState();

  const lotsById =
    new Map<
      string,
      ReturnType<
        typeof supplyState.getStoreCutLots
      >[number]
    >();

  for (
    const requirement of
    cutPlan.requirements
  ) {
    const lots =
      supplyState.getStoreCutLots(
        input.scope,
        requirement.stockItemId
      );

    for (const lot of lots) {
      lotsById.set(
        lot.id,
        lot
      );
    }
  }

  const optimization =
    optimizeSaleCutRequirementPlan(
      cutPlan,
      [...lotsById.values()]
    );

  if (
    optimization.outcome !==
    "READY"
  ) {
    return {
      outcome: "REJECTED",
      stage: "OPTIMIZATION",
      errors: optimization.errors
    };
  }

  const appState =
    useStore.getState();

  const supplierByStockItemId =
    new Map<
      string,
      SupplierResolution
    >();

  /*
   * Önce bütün eksik stokların tedarikçisi çözülür.
   * Böylece ilk stok için rezervasyon açıldıktan sonra
   * ikinci stokta tedarikçi eksikliği görülmesi gibi
   * yarım durum oluşmaz.
   */
  for (
    const stockRequirement of
    optimization.stockRequirements
  ) {
    if (
      stockRequirement.missingMeters <=
      0
    ) {
      continue;
    }

    const product =
      appState.products.find(
        candidate =>
          candidate.id ===
          stockRequirement.stockItemId
      );

    if (!product) {
      return {
        outcome: "REJECTED",
        stage:
          "SUPPLIER_RESOLUTION",
        errors: [
          `${stockRequirement.stockItemId}: stok kartı bulunamadı.`
        ]
      };
    }

    const supplierId =
      product
        .defaultSupplierCustomerId
        ?.trim() || "";

    if (!supplierId) {
      return {
        outcome: "REJECTED",
        stage:
          "SUPPLIER_RESOLUTION",
        errors: [
          `${product.stockCode} / ${product.name}: varsayılan tedarikçi cari tanımlı değil.`
        ]
      };
    }

    const supplier =
      appState.customers.find(
        candidate =>
          candidate.id === supplierId
      );

    if (!supplier) {
      return {
        outcome: "REJECTED",
        stage:
          "SUPPLIER_RESOLUTION",
        errors: [
          `${product.stockCode} / ${product.name}: bağlı tedarikçi cari bulunamadı.`
        ]
      };
    }

    const supplierName =
      supplier.name?.trim() || "";

    if (!supplierName) {
      return {
        outcome: "REJECTED",
        stage:
          "SUPPLIER_RESOLUTION",
        errors: [
          `${product.stockCode} / ${product.name}: tedarikçi cari adı boş.`
        ]
      };
    }

    supplierByStockItemId.set(
      stockRequirement.stockItemId,
      {
        id: supplier.id,
        name: supplierName
      }
    );
  }

  const createdReservationIds:
    string[] = [];

  const createdSupplierOrderIds:
    string[] = [];

  const reservationIds:
    string[] = [];

  const supplierOrderIds:
    string[] = [];

  const materialAllocations:
    SaleSupplyFulfillmentResult[
      "materialAllocations"
    ] = [];

  let reservedMeters = 0;
  let supplierMeters = 0;

  const now =
    input.now ??
    new Date().toISOString();

  for (
    const stockRequirement of
    optimization.stockRequirements
  ) {
    const supplier =
      supplierByStockItemId.get(
        stockRequirement.stockItemId
      );

    const fulfillment =
      executeSaleSupplyFulfillment({
        ...input.scope,
        saleId: input.sale.id,
        productionOrderId:
          `production-order:${input.sale.id}`,
        purchaseOrderId:
          [
            "purchase-order",
            input.sale.id,
            encodeURIComponent(
              stockRequirement.stockItemId
            )
          ].join(":"),
        supplierId:
          supplier?.id,
        supplierName:
          supplier?.name,
        createdByUserId:
          input.actorUserId,
        now,
        deferSupplierOrders: true,
        optimization:
          buildSingleStockOptimization(
            input.sale.id,
            stockRequirement
          )
      });

    if (
      fulfillment.outcome ===
      "REJECTED"
    ) {
      rollbackCreated(
        input.scope,
        createdReservationIds,
        createdSupplierOrderIds
      );

      return {
        outcome: "REJECTED",
        stage: "FULFILLMENT",
        errors: fulfillment.errors
      };
    }

    reservationIds.push(
      ...fulfillment.reservationIds
    );

    supplierOrderIds.push(
      ...fulfillment.supplierOrderIds
    );

    createdReservationIds.push(
      ...(
        fulfillment
          .createdReservationIds ??
        []
      )
    );

    createdSupplierOrderIds.push(
      ...(
        fulfillment
          .createdSupplierOrderIds ??
        []
      )
    );

    materialAllocations.push(
      ...fulfillment
        .materialAllocations
    );

    reservedMeters +=
      fulfillment.reservedMeters;

    supplierMeters +=
      fulfillment.supplierMeters;
  }

  const productionRequirements =
    optimization.stockRequirements
      .flatMap(
        stockRequirement =>
          stockRequirement.pieces.map(
            piece => ({
              saleItemId:
                piece.requirement
                  .saleItemId,
              parentSaleItemId:
                piece.parentSaleItemId,
              requiredQuantity:
                piece.requiredMeters
            })
          )
      );

  const combinedFulfillment:
    SaleSupplyFulfillmentResult = {
      outcome:
        supplierMeters > 0 &&
        reservedMeters > 0
          ? "PARTIAL"
          : "READY",
      reservationIds:
        unique(reservationIds),
      supplierOrderIds:
        unique(supplierOrderIds),
      createdReservationIds:
        unique(createdReservationIds),
      createdSupplierOrderIds:
        unique(createdSupplierOrderIds),
      /*
       * Tek bir exchange nesnesi çoklu tedarikçiyi temsil edemez.
       * Kalıcı gerçek kayıtlar supplierOrders + allocations içindedir.
       * Exchange katmanı stok kartı bazında orchestrator çağrılarında
       * doğrulanmış olur.
       */
      supplierOrder: null,
      materialAllocations,
      reservedMeters,
      supplierMeters,
      errors: []
    };

  const sourceBridge =
    buildProductionSourcePlansFromFulfillment(
      workPackage,
      combinedFulfillment,
      1,
      productionRequirements
    );

  if (
    sourceBridge.outcome ===
    "REJECTED"
  ) {
    rollbackCreated(
      input.scope,
      createdReservationIds,
      createdSupplierOrderIds
    );

    return {
      outcome: "REJECTED",
      stage: "SOURCE_BRIDGE",
      errors: sourceBridge.errors
    };
  }

  const productionSave =
    useProductionMaterialStore
      .getState()
      .savePlansAtomically(
        sourceBridge.plans
      );

  if (
    productionSave.outcome ===
    "REJECTED"
  ) {
    rollbackCreated(
      input.scope,
      createdReservationIds,
      createdSupplierOrderIds
    );

    return {
      outcome: "REJECTED",
      stage:
        "PRODUCTION_STORE",
      errors:
        productionSave.errors
    };
  }

  return {
    outcome: "COMMITTED",
    reservationIds:
      unique(reservationIds),
    supplierOrderIds:
      unique(supplierOrderIds),
    productionPlanCount:
      sourceBridge.plans.length
  };
}
