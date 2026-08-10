import type {
  SupplierOrder,
  SupplierReceiptRequest
} from "@/lib/supplierSupplyFlow";
import type {
  ProductionSourceAllocation,
  ProductionSourcePlan
} from "@/lib/productionSourceModel";
import {
  useProductionMaterialStore,
  type SaveProductionSourcePlanResult
} from "@/store/useProductionMaterialStore";
import {
  useSupplyChainStore
} from "@/store/useSupplyChainStore";

const EPSILON = 0.000001;

export interface SupplierReceiptProductionInput {
  request: SupplierReceiptRequest;
}

export type SupplierReceiptProductionResult =
  | {
      outcome: "COMMITTED" | "REPLAY";
      supplierOrder: SupplierOrder;
      plan: ProductionSourcePlan;
      productionResult:
        SaveProductionSourcePlanResult;
      releasedForCutting: boolean;
    }
  | {
      outcome: "REJECTED";
      stage:
        | "SUPPLY"
        | "SOURCE_PLAN"
        | "PRODUCTION_STORE";
      errors: string[];
    };

function sameScope(
  left: {
    tenantId: string;
    companyId: string;
    branchId: string;
    accountingPeriodId: string;
  },
  right: {
    tenantId: string;
    companyId: string;
    branchId: string;
    accountingPeriodId: string;
  }
): boolean {
  return (
    left.tenantId === right.tenantId &&
    left.companyId === right.companyId &&
    left.branchId === right.branchId &&
    left.accountingPeriodId ===
      right.accountingPeriodId
  );
}

function buildSupplierPlan(
  plan: ProductionSourcePlan,
  supplierOrder: SupplierOrder
): ProductionSourcePlan {
  const matching =
    plan.allocations.filter(
      allocation =>
        allocation.sourceType ===
          "SUPPLIER_ORDER" &&
        allocation.supplierOrderId ===
          supplierOrder.id
    );

  const otherAllocations =
    plan.allocations.filter(
      allocation =>
        !(
          allocation.sourceType ===
            "SUPPLIER_ORDER" &&
          allocation.supplierOrderId ===
            supplierOrder.id
        )
    );

  const supplierId =
    matching[0]?.supplierId ??
    supplierOrder.supplierId;

  const readyQuantity =
    Math.min(
      supplierOrder.receivedQuantity,
      supplierOrder.orderedQuantity
    );

  const pendingQuantity =
    Math.max(
      0,
      supplierOrder.orderedQuantity -
        readyQuantity
    );

  const rebuilt:
    ProductionSourceAllocation[] = [];

  if (readyQuantity > EPSILON) {
    rebuilt.push({
      id:
        `supplier-ready:${supplierOrder.id}`,
      productionItemId:
        plan.productionItemId,
      sourceType: "SUPPLIER_ORDER",
      quantity: readyQuantity,
      unit: plan.unit,
      status: "READY",
      supplierId,
      supplierOrderId:
        supplierOrder.id
    });
  }

  if (pendingQuantity > EPSILON) {
    rebuilt.push({
      id:
        `supplier-pending:${supplierOrder.id}`,
      productionItemId:
        plan.productionItemId,
      sourceType: "SUPPLIER_ORDER",
      quantity: pendingQuantity,
      unit: plan.unit,
      status: "ORDERED",
      supplierId,
      supplierOrderId:
        supplierOrder.id
    });
  }

  return {
    ...plan,
    version: plan.version + 1,
    allocations: [
      ...otherAllocations,
      ...rebuilt
    ]
  };
}

export function executeSupplierReceiptToProduction(
  input: SupplierReceiptProductionInput
): SupplierReceiptProductionResult {
  const supplyBefore =
    useSupplyChainStore.getState();

  const orderBefore =
    supplyBefore.supplierOrders.find(
      order =>
        order.id ===
          input.request
            .supplierOrderId &&
        sameScope(
          order,
          input.request
        )
    );

  if (!orderBefore) {
    return {
      outcome: "REJECTED",
      stage: "SUPPLY",
      errors: [
        "Tedarikçi siparişi bulunamadı."
      ]
    };
  }

  if (
    orderBefore.purpose !==
    "TAILOR_MATERIAL"
  ) {
    return {
      outcome: "REJECTED",
      stage: "SUPPLY",
      errors: [
        "Mekanik ürün teslimi terzi üretim teslim hattından işlenemez."
      ]
    };
  }

  const receipt =
    supplyBefore
      .receiveSupplierMaterial(
        input.request
      );

  if (
    receipt.outcome === "REJECTED"
  ) {
    return {
      outcome: "REJECTED",
      stage: "SUPPLY",
      errors: [receipt.reason]
    };
  }

  const supplyAfter =
    useSupplyChainStore.getState();

  const orderAfter =
    supplyAfter.supplierOrders.find(
      order =>
        order.id ===
          input.request
            .supplierOrderId &&
        sameScope(
          order,
          input.request
        )
    );

  if (!orderAfter) {
    if (
      receipt.outcome === "CREATED"
    ) {
      supplyAfter
        .rollbackSupplierReceiptCreated({
          scope: input.request,
          receiptId:
            receipt.value.id,
          supplierOrder:
            orderBefore
        });
    }

    return {
      outcome: "REJECTED",
      stage: "SUPPLY",
      errors: [
        "Teslim alma sonrası tedarikçi siparişi bulunamadı."
      ]
    };
  }

  const productionStore =
    useProductionMaterialStore
      .getState();

  const plan =
    productionStore.plans.find(
      current =>
        current.allocations.some(
          allocation =>
            allocation.sourceType ===
              "SUPPLIER_ORDER" &&
            allocation.supplierOrderId ===
              orderAfter.id
        )
    );

  if (!plan) {
    if (
      receipt.outcome === "CREATED"
    ) {
      useSupplyChainStore
        .getState()
        .rollbackSupplierReceiptCreated({
          scope: input.request,
          receiptId:
            receipt.value.id,
          supplierOrder:
            orderBefore
        });
    }

    return {
      outcome: "REJECTED",
      stage: "SOURCE_PLAN",
      errors: [
        "Tedarikçi siparişine bağlı üretim kaynak planı bulunamadı."
      ]
    };
  }

  const nextPlan =
    receipt.outcome === "REPLAY"
      ? plan
      : buildSupplierPlan(
          plan,
          orderAfter
        );

  const productionResult =
    receipt.outcome === "REPLAY"
      ? productionStore
          .refreshProductionItem(
            plan.productionItemId
          )
      : productionStore
          .savePlan(nextPlan);

  if (
    productionResult.outcome ===
    "REJECTED"
  ) {
    if (
      receipt.outcome === "CREATED"
    ) {
      useSupplyChainStore
        .getState()
        .rollbackSupplierReceiptCreated({
          scope: input.request,
          receiptId:
            receipt.value.id,
          supplierOrder:
            orderBefore
        });
    }

    return {
      outcome: "REJECTED",
      stage: "PRODUCTION_STORE",
      errors:
        productionResult.errors
    };
  }

  return {
    outcome:
      receipt.outcome === "REPLAY"
        ? "REPLAY"
        : "COMMITTED",
    supplierOrder: orderAfter,
    plan: productionResult.plan,
    productionResult,
    releasedForCutting:
      productionResult
        .releasedForCutting
  };
}