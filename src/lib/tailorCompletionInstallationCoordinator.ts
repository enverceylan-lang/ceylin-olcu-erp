import {
  resolveInstallationAssignment
} from "@/lib/installationAssignmentService";
import { readErpScope } from "@/lib/customerTreeScope";
import { getSaleFulfillmentLines, isFulfillmentLineReady } from "@/lib/installationFulfillment";
import { shouldPublishTailorPlanning } from "@/lib/tailorPlanningEligibility";
import type { ErpScope } from "@/lib/erpScope";
import { useSupplyChainStore } from "@/store/useSupplyChainStore";
import type {
  OperationRecord
} from "@/lib/operationsWorkflow";
import {
  erpScopeMatches
} from "@/lib/erpScope";
import {
  useAuthStore
} from "@/store/useAuthStore";
import {
  useOperationsStore
} from "@/store/useOperationsStore";
import {
  useStore
} from "@/store/useStore";
import {
  useSalesStore
} from "@/store/salesStore";

export type TailorCompletionInstallationResult =
  | {
      outcome:
        "READY_NO_INSTALLATION";
    }
  | {
      outcome:
        "WAITING_ASSIGNMENT";
      reason:
        | "NO_ASSIGNED_INSTALLER"
        | "ASSIGNED_INSTALLER_NOT_FOUND"
        | "ASSIGNED_INSTALLER_INVALID";
    }
  | {
      outcome:
        "ROUTED" |
        "REPLAY";
      installationOperation:
        OperationRecord;
    }
  | {
      outcome:
        "READY_NOT_ROUTED";
      reason:
        | "MAIN_OPERATION_NOT_FOUND"
        | "INSTALLATION_ROUTE_REJECTED"
        | "FULFILLMENT_LINE_NOT_READY";
    }
  | {
      outcome:
        "REJECTED";
      reason:
        | "NOT_TAILOR"
        | "NOT_COMPLETED"
        | "SALE_NOT_FOUND";
    };

export function routeReadySaleInstallation(
  parent: OperationRecord, saleLineId: string, actorUserId: string, now: string,
): TailorCompletionInstallationResult {
  const sales = useSalesStore.getState().sales;
  const sale = sales.find(item => item.id === parent.saleId && erpScopeMatches(item, parent));
  if (!sale || sale.customerId !== parent.customerId || !(shouldPublishTailorPlanning(sale.status) || sale.status === "MONTAJA_GÖNDERİLDİ")) {
    return { outcome: "REJECTED", reason: "SALE_NOT_FOUND" };
  }
  const line = getSaleFulfillmentLines(sale).find(item => item.id === saleLineId);
  const app = useStore.getState();
  if (!line || !isFulfillmentLineReady(sale, line, app.productionItems,
      useSupplyChainStore.getState().supplierOrders, sales.filter(item => item.id === sale.id).length === 1)) {
    return { outcome: "READY_NOT_ROUTED", reason: "FULFILLMENT_LINE_NOT_READY" };
  }
  const operations = useOperationsStore.getState();
  const existing = operations.operations.find(item => item.kind === "INSTALLATION" &&
    item.saleId === sale.id && item.parentOperationId === parent.id && item.fulfillmentLineId === line.id &&
    item.status !== "CANCELLED" && erpScopeMatches(item, parent));
  if (existing) return { outcome: "REPLAY", installationOperation: existing };

  const requiresInstallation = app.products.find(product => product.id === line.stockItemId)?.requiresInstallation === true;
  const customer = app.customers.find(item => {
    const scope = readErpScope(item);
    return item.id === sale.customerId && !item.isDeleted && scope && erpScopeMatches(scope, sale);
  });
  const assignedInstallerId = requiresInstallation ? customer?.assignedInstallerId?.trim() : undefined;
  let party: OperationRecord["party"];
  if (assignedInstallerId) {
    const installer = useAuthStore.getState().users.find(user => user.id === assignedInstallerId);
    if (!installer) return { outcome: "WAITING_ASSIGNMENT", reason: "ASSIGNED_INSTALLER_NOT_FOUND" };
    const assignment = resolveInstallationAssignment(installer);
    if (assignment.mode !== "INTERNAL" && assignment.mode !== "EXTERNAL") {
      return { outcome: "WAITING_ASSIGNMENT", reason: "ASSIGNED_INSTALLER_INVALID" };
    }
    party = assignment.party;
  }

  const routed = operations.routeChild({
    parent, kind: "INSTALLATION", fulfillmentLineId: line.id,
    ...(party ? { party } : { fulfillmentMode: "STORE_PICKUP" as const }),
    scheduledAt: now, dueAt: now, createdByUserId: actorUserId, now,
  });
  if (routed.outcome === "REJECTED") return { outcome: "READY_NOT_ROUTED", reason: "INSTALLATION_ROUTE_REJECTED" };
  return { outcome: routed.outcome === "REPLAY" ? "REPLAY" : "ROUTED", installationOperation: routed.operation };
}

export function routeReadyInstallationsInScope(scope: ErpScope, actorUserId: string, now: string): void {
  const sales = useSalesStore.getState().sales;
  const state = useOperationsStore.getState();
  for (const parent of state.operations) {
    if (parent.kind !== "GENERAL" || parent.status === "CANCELLED" || parent.status === "COMPLETED" ||
        !erpScopeMatches(parent, scope)) continue;
    const sale = sales.find(item => item.id === parent.saleId && erpScopeMatches(item, parent));
    if (sale) for (const line of getSaleFulfillmentLines(sale)) routeReadySaleInstallation(parent, line.id, actorUserId, now);
  }
}

export function routeInstallationAfterTailorCompletion(
  input: {
    operation:
      OperationRecord;
    actorUserId:
      string;
    now:
      string;
  }
): TailorCompletionInstallationResult {
  const {
    operation,
    actorUserId,
    now
  } = input;

  if (
    operation.kind !==
    "TAILOR"
  ) {
    return {
      outcome:
        "REJECTED",
      reason:
        "NOT_TAILOR"
    };
  }

  if (
    operation.status !==
    "COMPLETED"
  ) {
    return {
      outcome:
        "REJECTED",
      reason:
        "NOT_COMPLETED"
    };
  }

  const sale =
    useSalesStore
      .getState()
      .sales
      .find(
        current =>
          current.id ===
            operation.saleId &&
          erpScopeMatches(
            current,
            operation
          )
      );

  if (!sale) {
    return {
      outcome:
        "REJECTED",
      reason:
        "SALE_NOT_FOUND"
    };
  }

  const operations =
    useOperationsStore
      .getState();

  const main =
    operations.operations.find(
      current =>
        current.id ===
          operation.parentOperationId &&
        current.kind === "GENERAL" &&
        current.saleId === operation.saleId &&
        erpScopeMatches(current, operation)
    ) ??
    operations.operations.find(
      current =>
        current.kind ===
          "GENERAL" &&
        current.saleId ===
          operation.saleId &&
        current.tenantId ===
          operation.tenantId &&
        current.companyId ===
          operation.companyId &&
        current.branchId ===
          operation.branchId &&
        current.accountingPeriodId ===
          operation.accountingPeriodId
    );

  if (!main) {
    return {
      outcome:
        "READY_NOT_ROUTED",
      reason:
        "MAIN_OPERATION_NOT_FOUND"
    };
  }

  if (operation.fulfillmentLineId) {
    return routeReadySaleInstallation(main, operation.fulfillmentLineId, actorUserId, now);
  }
  let result: TailorCompletionInstallationResult = { outcome: "READY_NOT_ROUTED", reason: "FULFILLMENT_LINE_NOT_READY" };
  for (const line of getSaleFulfillmentLines(sale)) {
    const candidate = routeReadySaleInstallation(main, line.id, actorUserId, now);
    if (candidate.outcome === "ROUTED" || candidate.outcome === "REPLAY" ||
        (result.outcome === "READY_NOT_ROUTED" && candidate.outcome === "WAITING_ASSIGNMENT")) result = candidate;
  }
  return result;
}
