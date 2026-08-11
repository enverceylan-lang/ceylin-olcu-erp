import {
  resolveInstallationAssignment
} from "@/lib/installationAssignmentService";
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
        | "INSTALLATION_ROUTE_REJECTED";
    }
  | {
      outcome:
        "REJECTED";
      reason:
        | "NOT_TAILOR"
        | "NOT_COMPLETED"
        | "SALE_NOT_FOUND";
    };

function flattenSaleItems(
  sale:
    ReturnType<
      typeof useSalesStore.getState
    >["sales"][number]
) {
  return sale.items.flatMap(
    item =>
      Array.isArray(
        item.productionBreakdown
      ) &&
      item.productionBreakdown.length > 0
        ? item.productionBreakdown
        : [item]
  );
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

  const app =
    useStore.getState();

  const requiresInstallation =
    flattenSaleItems(sale)
      .some(item => {
        const product =
          app.products.find(
            candidate =>
              candidate.id ===
              item.stockItemId
          );

        return (
          product
            ?.requiresInstallation ===
          true
        );
      });

  if (!requiresInstallation) {
    return {
      outcome:
        "READY_NO_INSTALLATION"
    };
  }

  const customer =
    app.customers.find(
      current =>
        current.id ===
        sale.customerId
    );

  const assignedInstallerId =
    customer
      ?.assignedInstallerId
      ?.trim();

  if (!assignedInstallerId) {
    return {
      outcome:
        "WAITING_ASSIGNMENT",
      reason:
        "NO_ASSIGNED_INSTALLER"
    };
  }

  const installer =
    useAuthStore
      .getState()
      .users
      .find(
        user =>
          user.id ===
          assignedInstallerId
      );

  if (!installer) {
    return {
      outcome:
        "WAITING_ASSIGNMENT",
      reason:
        "ASSIGNED_INSTALLER_NOT_FOUND"
    };
  }

  const assignment =
    resolveInstallationAssignment(
      installer
    );

  if (
    assignment.mode ===
    "REJECTED"
  ) {
    return {
      outcome:
        "WAITING_ASSIGNMENT",
      reason:
        "ASSIGNED_INSTALLER_INVALID"
    };
  }

  if (
    assignment.mode ===
    "UNASSIGNED"
  ) {
    return {
      outcome:
        "WAITING_ASSIGNMENT",
      reason:
        "NO_ASSIGNED_INSTALLER"
    };
  }

  if (
    assignment.mode !==
      "INTERNAL" &&
    assignment.mode !==
      "EXTERNAL"
  ) {
    return {
      outcome:
        "WAITING_ASSIGNMENT",
      reason:
        "ASSIGNED_INSTALLER_INVALID"
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
        current.kind ===
          "GENERAL"
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

  const routed =
    operations.routeChild({
      parent:
        main,
      kind:
        "INSTALLATION",
      party:
        assignment.party,
      scheduledAt:
        now,
      dueAt:
        main.dueAt >= now
          ? main.dueAt
          : now,
      createdByUserId:
        actorUserId,
      now,
      notes:
        "Terzi işi tamamlandıktan sonra otomatik montaj yönlendirmesi."
    });

  if (
    routed.outcome ===
    "REJECTED"
  ) {
    return {
      outcome:
        "READY_NOT_ROUTED",
      reason:
        "INSTALLATION_ROUTE_REJECTED"
    };
  }

  return {
    outcome:
      routed.outcome ===
      "REPLAY"
        ? "REPLAY"
        : "ROUTED",
    installationOperation:
      routed.operation
  };
}
