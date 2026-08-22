import type {
  ErpScope
} from "@/lib/erpScope";
import {
  executeSaleApprovalMaterialFulfillment,
  type SaleApprovalMaterialFulfillmentResult
} from "@/lib/saleApprovalMaterialFulfillment";
import {
  executeSaleApprovalMechanicalProcurement,
  type SaleApprovalMechanicalProcurementResult
} from "@/lib/saleApprovalMechanicalProcurement";
import {
  shouldSyncMainOperationForSaleStatus
} from "@/lib/saleOperationEligibility";
import {
  useOperationsStore
} from "@/store/useOperationsStore";
import type {
  Sale
} from "@/store/salesStore";

export type SaleApprovalOperationsResult =
  | {
      outcome:
        "COMMITTED";
      material:
        SaleApprovalMaterialFulfillmentResult;
      mechanical:
        SaleApprovalMechanicalProcurementResult;
    }
  | {
      outcome:
        "REJECTED";
      stage:
        | "MAIN_OPERATION"
        | "MATERIAL"
        | "MECHANICAL";
      errors:
        string[];
      material?:
        SaleApprovalMaterialFulfillmentResult;
      mechanical?:
        SaleApprovalMechanicalProcurementResult;
    };

export function executeSaleApprovalOperations(
  input: {
    sale:
      Sale;
    scope:
      ErpScope;
    customer: {
      id: string;
      name: string;
      phone: string;
      address: string;
    };
    actorUserId:
      string;
    now:
      string;
  }
): SaleApprovalOperationsResult {
  const {
    sale,
    scope,
    customer,
    actorUserId,
    now
  } = input;

  if (
    shouldSyncMainOperationForSaleStatus(
      sale.status
    )
  ) {
    const main =
      useOperationsStore
        .getState()
        .syncMainOperation({
          sale,
          scope,
          customer,
          createdByUserId:
            actorUserId
        });

    if (
      main.outcome ===
      "REJECTED"
    ) {
      return {
        outcome:
          "REJECTED",
        stage:
          "MAIN_OPERATION",
        errors: [
          `Ana operasyon reddedildi: ${main.reason}`
        ]
      };
    }
  }

  const material =
    executeSaleApprovalMaterialFulfillment({
      sale,
      scope,
      actorUserId,
      now
    });

  if (
    material.outcome ===
    "REJECTED"
  ) {
    return {
      outcome:
        "REJECTED",
      stage:
        "MATERIAL",
      errors:
        material.errors,
      material
    };
  }

  const mechanical =
    executeSaleApprovalMechanicalProcurement({
      sale,
      scope,
      actorUserId,
      now,
      deferSupplierOrders: true
    });

  if (
    mechanical.outcome ===
    "REJECTED"
  ) {
    return {
      outcome:
        "REJECTED",
      stage:
        "MECHANICAL",
      errors:
        mechanical.errors,
      material,
      mechanical
    };
  }

  return {
    outcome:
      "COMMITTED",
    material,
    mechanical
  };
}
