import type { ErpScope } from "@/lib/erpScope";
import type {
  SaleCutOptimizationResult
} from "@/lib/saleCutOptimizerAdapter";
import type {
  StockReservationRequest
} from "@/lib/stockReservationGuard";
import {
  useSupplyChainStore
} from "@/store/useSupplyChainStore";
import {
  validateSupplierOrderExchange,
  type SupplierOrderExchange
} from "@/lib/supplierOrderExchange";
import type {
  ProductionSourceStatus,
  ProductionSourceType
} from "@/lib/productionSourceModel";

export interface FulfillmentMaterialAllocation {
  id: string;
  saleItemId: string;
  parentSaleItemId: string;
  stockItemId: string;
  sourceType: ProductionSourceType;
  quantity: number;
  status: ProductionSourceStatus;
  lotId?: string;
  reservationId?: string;
  supplierId?: string;
  supplierOrderId?: string;
}

export interface SaleSupplyFulfillmentInput
  extends ErpScope {
  saleId: string;
  productionOrderId: string;
  purchaseOrderId: string;
  supplierId?: string;
  supplierName?: string;
  createdByUserId: string;
  now: string;

  targetSupplierTenantId?: string;
  targetSupplierCompanyId?: string;

  /*
   * Sale approval may reserve usable stock while deliberately deferring
   * supplier-order creation to the Operations screen.
   */
  deferSupplierOrders?: boolean;

  optimization:
    SaleCutOptimizationResult;
}

export interface SaleSupplyFulfillmentResult {
  outcome:
    | "READY"
    | "PARTIAL"
    | "REJECTED";

  reservationIds: string[];
  supplierOrderIds: string[];

  /*
   * Yalnız bu invocation içinde CREATED olan kayıtlar.
   * Cross-store compensation REPLAY / önceden var olan kayda dokunmaz.
   */
  createdReservationIds?: string[];
  createdSupplierOrderIds?: string[];

  supplierOrder:
    SupplierOrderExchange | null;

  materialAllocations:
    FulfillmentMaterialAllocation[];

  reservedMeters: number;
  supplierMeters: number;

  errors: string[];
}

function roundMeters(
  value: number
): number {
  return Math.round(value * 1_000_000) /
    1_000_000;
}

export function executeSaleSupplyFulfillment(
  input: SaleSupplyFulfillmentInput
): SaleSupplyFulfillmentResult {
  if (
    input.optimization.outcome !==
    "READY"
  ) {
    return {
      outcome: "REJECTED",
      reservationIds: [],
      supplierOrderIds: [],
      supplierOrder: null,
      materialAllocations: [],
      reservedMeters: 0,
      supplierMeters: 0,
      errors: [
        "Kesim optimizasyonu hazır değil."
      ]
    };
  }

  const store =
    useSupplyChainStore.getState();

  const createdReservationIds:
    string[] = [];
  const createdSupplierOrderIds:
    string[] = [];

  const rollbackFulfillment = () => {
    useSupplyChainStore
      .getState()
      .rollbackFulfillmentCreated({
        scope: {
          tenantId:
            input.tenantId,
          companyId:
            input.companyId,
          branchId:
            input.branchId,
          accountingPeriodId:
            input.accountingPeriodId
        },
        reservationIds:
          createdReservationIds,
        supplierOrderIds:
          createdSupplierOrderIds
      });
  };

  const reservationIds: string[] = [];
  const supplierOrderIds: string[] = [];
  const materialAllocations:
    FulfillmentMaterialAllocation[] = [];
  const supplierInstructions:
    SupplierOrderExchange["instructions"] = [];

  let reservedMeters = 0;
  let supplierMeters = 0;
  let supplierSequence = 1;

  for (
    const stockRequirement of
    input.optimization.stockRequirements
  ) {
    for (
      const piece of
      stockRequirement.pieces
    ) {
      const bestSuggestion =
        piece.suggestions[0];

      if (!bestSuggestion) {
        if (
          input.deferSupplierOrders ===
          true
        ) {
          supplierMeters =
            roundMeters(
              supplierMeters +
              piece.requiredMeters
            );

          continue;
        }

        const supplierId =
          input.supplierId?.trim() ?? "";
        const supplierName =
          input.supplierName?.trim() ?? "";

        if (
          supplierId.length === 0 ||
          supplierName.length === 0
        ) {
          rollbackFulfillment();

          return {
            outcome: "REJECTED",
            reservationIds: [],
            supplierOrderIds: [],
            createdReservationIds: [],
            createdSupplierOrderIds: [],
            supplierOrder: null,
            materialAllocations: [],
            reservedMeters: 0,
            supplierMeters: 0,
            errors: [
              "Stok yetersiz olduğu için gerçek tedarikçi cari seçilmelidir."
            ]
          };
        }

        const supplierOrderId =
          [
            "supplier-order",
            input.purchaseOrderId,
            encodeURIComponent(
              piece.requirement.id
            )
          ].join(":");

        const allocationId =
          [
            "supplier-allocation",
            input.productionOrderId,
            encodeURIComponent(
              piece.requirement.id
            )
          ].join(":");

        const supplierDecision =
          store.createSupplierOrder({
            tenantId:
              input.tenantId,
            companyId:
              input.companyId,
            branchId:
              input.branchId,
            accountingPeriodId:
              input.accountingPeriodId,

            id: supplierOrderId,
            idempotencyKey:
              `SUPPLIER_ORDER:${supplierOrderId}`,
            allocationId,
            supplierId,
            purchaseOrderId:
              input.purchaseOrderId,
            saleId:
              input.saleId,
            saleItemId:
              piece.requirement.saleItemId,
            productionOrderId:
              input.productionOrderId,
            stockItemId:
              piece.requirement.stockItemId,
            orderedQuantity:
              piece.requiredMeters,
            orderedUnit: "mt",
            purpose:
              "TAILOR_MATERIAL",
            createdByUserId:
              input.createdByUserId,
            createdAt:
              input.now
          });

        if (
          supplierDecision.outcome ===
          "REJECTED"
        ) {
          rollbackFulfillment();

          return {
            outcome: "REJECTED",
            reservationIds,
            supplierOrderIds,
            supplierOrder: null,
            materialAllocations,
            reservedMeters,
            supplierMeters,
            errors: [
              `Tedarik siparişi reddedildi: ${supplierDecision.reason}`
            ]
          };
        }

        supplierOrderIds.push(
          supplierDecision.value.id
        );

        if (
          supplierDecision.outcome ===
          "CREATED"
        ) {
          createdSupplierOrderIds.push(
            supplierDecision.value.id
          );
        }

        supplierInstructions.push({
          kind: "CUT_LENGTH",
          id:
            `supplier-cut:${piece.requirement.id}`,
          stockItemId:
            piece.requirement.stockItemId,
          productType:
            piece.productType,
          saleItemId:
            piece.requirement.saleItemId,
          parentSaleItemId:
            piece.parentSaleItemId,
          supplierOrderId:
            supplierDecision.value.id,
          lengthMeters:
            piece.requiredMeters,
          splitAllowed:
            piece.requirement.continuity ===
            "MULTI_PIECE_ALLOWED",
          sequence:
            supplierSequence
        });

        materialAllocations.push({
          id: allocationId,
          saleItemId:
            piece.requirement.saleItemId,
          parentSaleItemId:
            piece.parentSaleItemId,
          stockItemId:
            piece.requirement.stockItemId,
          sourceType:
            "SUPPLIER_ORDER",
          quantity:
            piece.requiredMeters,
          status: "ORDERED",
          supplierId,
          supplierOrderId:
            supplierDecision.value.id
        });

        supplierSequence += 1;
        supplierMeters =
          roundMeters(
            supplierMeters +
            piece.requiredMeters
          );

        continue;
      }

      for (
        let cutIndex = 0;
        cutIndex <
        bestSuggestion.cuts.length;
        cutIndex += 1
      ) {
        const cut =
          bestSuggestion.cuts[cutIndex];

        const reservationId =
          [
            "reservation",
            input.saleId,
            piece.requirement.id,
            cut.lotId,
            cutIndex + 1
          ].join(":");

        const allocationId =
          [
            "allocation",
            input.productionOrderId,
            piece.requirement.id,
            cut.lotId,
            cutIndex + 1
          ].join(":");

        const request:
          StockReservationRequest = {
            tenantId:
              input.tenantId,
            companyId:
              input.companyId,
            branchId:
              input.branchId,
            accountingPeriodId:
              input.accountingPeriodId,

            id: reservationId,
            idempotencyKey:
              `STOCK_RESERVATION:${reservationId}`,
            allocationId,
            saleId:
              input.saleId,
            saleItemId:
              piece.requirement.saleItemId,
            productionOrderId:
              input.productionOrderId,
            stockItemId:
              piece.requirement.stockItemId,
            stockLotId:
              cut.lotId,
            quantityMeters:
              cut.lengthMeters,
            createdByUserId:
              input.createdByUserId,
            createdAt:
              input.now
          };

        const result =
          store.reserveStock(
            request
          );

        if (
          result.outcome ===
          "REJECTED"
        ) {
          rollbackFulfillment();

          return {
            outcome: "REJECTED",
            reservationIds,
            supplierOrderIds,
            supplierOrder: null,
            materialAllocations,
            reservedMeters,
            supplierMeters,
            errors: [
              `Rezervasyon reddedildi: ${result.reason}`
            ]
          };
        }

        reservationIds.push(
          result.value.id
        );

        if (
          result.outcome ===
          "CREATED"
        ) {
          createdReservationIds.push(
            result.value.id
          );
        }

        materialAllocations.push({
          id: allocationId,
          saleItemId:
            piece.requirement.saleItemId,
          parentSaleItemId:
            piece.parentSaleItemId,
          stockItemId:
            piece.requirement.stockItemId,
          sourceType:
            "STORE_CUT",
          quantity:
            cut.lengthMeters,
          status: "RESERVED",
          lotId:
            cut.lotId,
          reservationId:
            result.value.id
        });

        reservedMeters =
          roundMeters(
            reservedMeters +
            cut.lengthMeters
          );
      }
    }
  }

  let supplierOrder:
    SupplierOrderExchange | null =
      null;

  if (
    supplierInstructions.length > 0
  ) {
    supplierOrder = {
      id:
        `supplier-exchange:${input.purchaseOrderId}`,
      idempotencyKey:
        `SUPPLIER_EXCHANGE:${input.purchaseOrderId}`,
      sourceTenantId:
        input.tenantId,
      sourceCompanyId:
        input.companyId,
      supplierId:
        input.supplierId?.trim() ?? "",
      targetTenantId:
        input.targetSupplierTenantId,
      targetCompanyId:
        input.targetSupplierCompanyId,
      sourcePurchaseOrderId:
        input.purchaseOrderId,
      sourceSaleId:
        input.saleId,
      status: "DRAFT",
      instructions:
        supplierInstructions,
      createdAt:
        input.now,
      updatedAt:
        input.now
    };

    const errors =
      validateSupplierOrderExchange(
        supplierOrder
      );

    if (errors.length > 0) {
      rollbackFulfillment();

      return {
        outcome: "REJECTED",
        reservationIds,
        supplierOrderIds,
        supplierOrder: null,
        materialAllocations,
        reservedMeters,
        supplierMeters,
        errors
      };
    }
  }

  return {
    outcome:
      supplierMeters > 0 &&
      reservedMeters > 0
        ? "PARTIAL"
        : "READY",
    reservationIds:
      [...new Set(reservationIds)],
    supplierOrderIds:
      [...new Set(supplierOrderIds)],
    createdReservationIds:
      [...new Set(createdReservationIds)],
    createdSupplierOrderIds:
      [...new Set(createdSupplierOrderIds)],
    supplierOrder,
    materialAllocations,
    reservedMeters,
    supplierMeters,
    errors: []
  };
}
