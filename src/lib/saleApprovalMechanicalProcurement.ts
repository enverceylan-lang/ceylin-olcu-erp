import type {
  ErpScope
} from "@/lib/erpScope";
import {
  getSaleOperationWorkPackage
} from "@/lib/saleOperationWorkPackages";
import type {
  SupplierOrderUnit
} from "@/lib/supplierSupplyFlow";
import type {
  Sale,
  SaleItem
} from "@/store/salesStore";
import {
  useStore
} from "@/store/useStore";
import {
  useSupplyChainStore
} from "@/store/useSupplyChainStore";

export type SaleApprovalMechanicalProcurementResult =
  | {
      outcome: "SKIPPED";
      reason:
        | "NOT_APPROVED"
        | "NO_MECHANICAL_PACKAGE";
    }
  | {
      outcome: "COMMITTED";
      supplierOrderIds: string[];
      createdSupplierOrderIds: string[];
    }
  | {
      outcome: "REJECTED";
      stage:
        | "STOCK_IDENTITY"
        | "QUANTITY"
        | "SUPPLIER_RESOLUTION"
        | "SUPPLIER_ORDER";
      errors: string[];
    };

interface MechanicalSourceLine {
  parentSaleItemId: string;
  item: SaleItem;
}

function unique(
  values: string[]
): string[] {
  return [...new Set(values)];
}

function sourceLines(
  parent: SaleItem
): MechanicalSourceLine[] {
  if (
    Array.isArray(
      parent.productionBreakdown
    ) &&
    parent.productionBreakdown.length > 0
  ) {
    return parent.productionBreakdown.map(
      item => ({
        parentSaleItemId:
          parent.id,
        item
      })
    );
  }

  return [
    {
      parentSaleItemId:
        parent.id,
      item: parent
    }
  ];
}

export function resolveMechanicalOrderQuantity(
  item: Pick<
    SaleItem,
    "metricSize" |
      "quantity" |
      "metricUnit"
  >
): {
  quantity: number;
  unit: SupplierOrderUnit;
} | null {
  const metricSize =
    Number(item.metricSize);

  const quantity =
    Number(item.quantity);

  if (
    !Number.isFinite(metricSize) ||
    metricSize <= 0 ||
    !Number.isFinite(quantity) ||
    quantity <= 0
  ) {
    return null;
  }

  /*
   * Sales screen commercial amount is:
   * unitPrice x metricSize x quantity.
   * Procurement uses the same commercial quantity semantic.
   */
  const orderedQuantity =
    Math.round(
      metricSize *
      quantity *
      1_000_000
    ) / 1_000_000;

  if (
    !Number.isFinite(
      orderedQuantity
    ) ||
    orderedQuantity <= 0
  ) {
    return null;
  }

  return {
    quantity:
      orderedQuantity,
    unit: item.metricUnit
  };
}

export function executeSaleApprovalMechanicalProcurement(
  input: {
    sale: Sale;
    scope: ErpScope;
    actorUserId: string;
    now?: string;
  }
): SaleApprovalMechanicalProcurementResult {
  if (
    input.sale.status !==
    "ONAYLANDI"
  ) {
    return {
      outcome: "SKIPPED",
      reason: "NOT_APPROVED"
    };
  }

  const workPackage =
    getSaleOperationWorkPackage(
      input.sale,
      "SUPPLIER_MECHANICAL"
    );

  if (!workPackage) {
    return {
      outcome: "SKIPPED",
      reason:
        "NO_MECHANICAL_PACKAGE"
    };
  }

  const appState =
    useStore.getState();

  const lines =
    workPackage.items.flatMap(
      sourceLines
    );

  const prepared =
    lines.map(line => {
      const stockItemId =
        line.item.stockItemId?.trim() ||
        workPackage.items.find(
          parent =>
            parent.id ===
            line.parentSaleItemId
        )?.stockItemId?.trim() ||
        "";

      if (!stockItemId) {
        return {
          outcome:
            "REJECTED" as const,
          stage:
            "STOCK_IDENTITY" as const,
          error:
            `${line.item.roomName} / ${line.item.windowName} / ${line.item.productType}: stok kartı kimliği yok.`
        };
      }

      const resolvedQuantity =
        resolveMechanicalOrderQuantity(
          line.item
        );

      if (!resolvedQuantity) {
        return {
          outcome:
            "REJECTED" as const,
          stage:
            "QUANTITY" as const,
          error:
            `${line.item.roomName} / ${line.item.windowName} / ${line.item.productType}: mekanik sipariş miktarı geçersiz.`
        };
      }

      const product =
        appState.products.find(
          candidate =>
            candidate.id ===
            stockItemId
        );

      if (!product) {
        return {
          outcome:
            "REJECTED" as const,
          stage:
            "STOCK_IDENTITY" as const,
          error:
            `${stockItemId}: mekanik stok kartı bulunamadı.`
        };
      }

      const supplierId =
        product
          .defaultSupplierCustomerId
          ?.trim() || "";

      if (!supplierId) {
        return {
          outcome:
            "REJECTED" as const,
          stage:
            "SUPPLIER_RESOLUTION" as const,
          error:
            `${product.stockCode} / ${product.name}: varsayılan tedarikçi cari tanımlı değil.`
        };
      }

      const supplier =
        appState.customers.find(
          candidate =>
            candidate.id ===
            supplierId
        );

      if (!supplier) {
        return {
          outcome:
            "REJECTED" as const,
          stage:
            "SUPPLIER_RESOLUTION" as const,
          error:
            `${product.stockCode} / ${product.name}: bağlı tedarikçi cari bulunamadı.`
        };
      }

      return {
        outcome:
          "READY" as const,
        line,
        stockItemId,
        product,
        supplier,
        resolvedQuantity
      };
    });

  const firstRejected =
    prepared.find(
      result =>
        result.outcome ===
        "REJECTED"
    );

  if (
    firstRejected &&
    firstRejected.outcome ===
      "REJECTED"
  ) {
    return {
      outcome: "REJECTED",
      stage:
        firstRejected.stage,
      errors: [
        firstRejected.error
      ]
    };
  }

  const readyLines =
    prepared.filter(
      (
        result
      ): result is Extract<
        (typeof prepared)[number],
        { outcome: "READY" }
      > =>
        result.outcome === "READY"
    );

  const supplyStore =
    useSupplyChainStore.getState();

  const supplierOrderIds:
    string[] = [];

  const createdSupplierOrderIds:
    string[] = [];

  const now =
    input.now ??
    new Date().toISOString();

  for (
    const entry of readyLines
  ) {
    const supplierId =
      entry.supplier.id;

    const orderId =
      [
        "supplier-order",
        "mechanical",
        input.sale.id,
        encodeURIComponent(
          entry.line.item.id
        )
      ].join(":");

    const allocationId =
      [
        "mechanical-allocation",
        input.sale.id,
        encodeURIComponent(
          entry.line.item.id
        )
      ].join(":");

    const purchaseOrderId =
      [
        "purchase-order",
        "mechanical",
        input.sale.id,
        encodeURIComponent(
          supplierId
        )
      ].join(":");

    const result =
      supplyStore
        .createSupplierOrder({
          ...input.scope,
          id: orderId,
          idempotencyKey:
            `MECHANICAL_SUPPLIER_ORDER:${orderId}`,
          allocationId,
          supplierId,
          purchaseOrderId,
          saleId:
            input.sale.id,
          saleItemId:
            entry.line.item.id,
          productionOrderId:
            `mechanical-order:${input.sale.id}`,
          stockItemId:
            entry.stockItemId,
          orderedQuantity:
            entry.resolvedQuantity
              .quantity,
          orderedUnit:
            entry.resolvedQuantity.unit,
          purpose:
            "MECHANICAL_PRODUCT",
          createdByUserId:
            input.actorUserId,
          createdAt: now
        });

    if (
      result.outcome ===
      "REJECTED"
    ) {
      useSupplyChainStore
        .getState()
        .rollbackFulfillmentCreated({
          scope: input.scope,
          reservationIds: [],
          supplierOrderIds:
            createdSupplierOrderIds
        });

      return {
        outcome: "REJECTED",
        stage: "SUPPLIER_ORDER",
        errors: [
          `${entry.product.stockCode} / ${entry.product.name}: mekanik tedarik siparişi reddedildi: ${result.reason}`
        ]
      };
    }

    supplierOrderIds.push(
      result.value.id
    );

    if (
      result.outcome ===
      "CREATED"
    ) {
      createdSupplierOrderIds.push(
        result.value.id
      );
    }
  }

  return {
    outcome: "COMMITTED",
    supplierOrderIds:
      unique(supplierOrderIds),
    createdSupplierOrderIds:
      unique(
        createdSupplierOrderIds
      )
  };
}