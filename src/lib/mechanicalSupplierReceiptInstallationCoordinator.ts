import type {
  SupplierOrder,
  SupplierReceiptRequest
} from "@/lib/supplierSupplyFlow";
import { routeReadySaleInstallation } from "@/lib/tailorCompletionInstallationCoordinator";
import type {
  OperationRecord
} from "@/lib/operationsWorkflow";
import {
  useOperationsStore
} from "@/store/useOperationsStore";
import {
  useStore
} from "@/store/useStore";
import {
  useSupplyChainStore
} from "@/store/useSupplyChainStore";

export type MechanicalReceiptInstallationResult =
  | {
      outcome: "PARTIALLY_RECEIVED";
      supplierOrder: SupplierOrder;
      installationOperation?: undefined;
    }
  | {
      outcome: "READY_NO_INSTALLATION";
      supplierOrder: SupplierOrder;
      installationOperation?: undefined;
    }
  | {
      outcome: "WAITING_ASSIGNMENT";
      supplierOrder: SupplierOrder;
      installationOperation?: undefined;
      reason:
        | "NO_ASSIGNED_INSTALLER"
        | "ASSIGNED_INSTALLER_NOT_FOUND"
        | "ASSIGNED_INSTALLER_INVALID";
    }
  | {
      outcome: "ROUTED";
      supplierOrder: SupplierOrder;
      installationOperation: OperationRecord;
    }
  | {
      outcome: "READY_NOT_ROUTED";
      supplierOrder: SupplierOrder;
      installationOperation?: undefined;
      reason:
        | "MAIN_OPERATION_NOT_FOUND"
        | "INSTALLATION_ROUTE_REJECTED";
    }
  | {
      outcome: "REPLAY";
      supplierOrder: SupplierOrder;
      installationOperation?: OperationRecord;
    }
  | {
      outcome: "REJECTED";
      stage: "SUPPLY" | "ORDER_PURPOSE" | "STOCK_IDENTITY";
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

function findMainOperation(
  saleId: string,
  scope: SupplierReceiptRequest
): OperationRecord | undefined {
  return useOperationsStore
    .getState()
    .operations.find(
      operation =>
        operation.kind === "GENERAL" &&
        operation.saleId === saleId &&
        operation.status !== "CANCELLED" &&
        sameScope(operation, scope)
    );
}

export function executeMechanicalSupplierReceiptToInstallation(
  input: {
    request: SupplierReceiptRequest;
    now?: string;
  }
): MechanicalReceiptInstallationResult {
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
    "MECHANICAL_PRODUCT"
  ) {
    return {
      outcome: "REJECTED",
      stage: "ORDER_PURPOSE",
      errors: [
        "Bu teslim mekanik ürün siparişi değildir."
      ]
    };
  }

  const receipt =
    supplyBefore.receiveSupplierMaterial(
      input.request
    );

  if (
    receipt.outcome ===
    "REJECTED"
  ) {
    return {
      outcome: "REJECTED",
      stage: "SUPPLY",
      errors: [receipt.reason]
    };
  }

  const orderAfter =
    useSupplyChainStore
      .getState()
      .supplierOrders.find(
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
    return {
      outcome: "REJECTED",
      stage: "SUPPLY",
      errors: [
        "Teslim alma sonrası mekanik sipariş bulunamadı."
      ]
    };
  }

  if (
    orderAfter.status ===
    "PARTIALLY_RECEIVED"
  ) {
    return {
      outcome:
        "PARTIALLY_RECEIVED",
      supplierOrder: orderAfter
    };
  }

  if (
    orderAfter.status !==
    "READY_FOR_OPERATION"
  ) {
    return {
      outcome: "REJECTED",
      stage: "SUPPLY",
      errors: [
        `Beklenmeyen mekanik sipariş durumu: ${orderAfter.status}`
      ]
    };
  }

  const appState =
    useStore.getState();

  const product =
    appState.products.find(
      candidate =>
        candidate.id ===
        orderAfter.stockItemId
    );

  if (!product) {
    return {
      outcome: "REJECTED",
      stage: "STOCK_IDENTITY",
      errors: [
        `${orderAfter.stockItemId}: stok kartı bulunamadı.`
      ]
    };
  }

  const parent = findMainOperation(orderAfter.saleId, input.request);
  if (!parent) return { outcome: "READY_NOT_ROUTED", supplierOrder: orderAfter, reason: "MAIN_OPERATION_NOT_FOUND" };
  const result = routeReadySaleInstallation(parent, orderAfter.saleItemId,
    input.request.receivedByUserId, input.now ?? input.request.receivedAt);
  if (result.outcome === "ROUTED" || result.outcome === "REPLAY") {
    return { outcome: result.outcome, supplierOrder: orderAfter, installationOperation: result.installationOperation };
  }
  if (result.outcome === "WAITING_ASSIGNMENT") {
    return { outcome: result.outcome, supplierOrder: orderAfter, reason: result.reason };
  }
  return { outcome: "READY_NOT_ROUTED", supplierOrder: orderAfter, reason: "INSTALLATION_ROUTE_REJECTED" };
}
