export type ProcurementDecisionAction =
  | "CREATE_ORDER"
  | "OVERRIDE_NO_ORDER";

export type ProcurementUnit =
  | "mt"
  | "m2"
  | "adet";

export interface ProcurementOrderLineCommand {
  needId: string;
  saleItemId: string;
  stockItemId: string;
  supplierOrderLineId: string;
  productionOrderId: string;
  allocationId: string;
  purpose: "TAILOR_MATERIAL" | "MECHANICAL_PRODUCT";
  requiredQuantity: number;
  requiredUnit: ProcurementUnit;
}

export interface ProcurementCreateOrderCommand {
  action: "CREATE_ORDER";
  idempotencyKey: string;
  saleId: string;
  supplierId: string;
  supplierOrderId: string;
  lines: ProcurementOrderLineCommand[];
}

export interface ProcurementOverrideCommand {
  action: "OVERRIDE_NO_ORDER";
  idempotencyKey: string;
  needId: string;
  saleId: string;
  saleItemId: string;
  stockItemId: string;
  requiredQuantity: number;
  requiredUnit: ProcurementUnit;
  reasonCode: string;
  reasonText?: string;
}

export type ProcurementDecisionCommand =
  | ProcurementCreateOrderCommand
  | ProcurementOverrideCommand;

export type ProcurementContractDecision =
  | {
      allowed: true;
      command: ProcurementDecisionCommand;
    }
  | {
      allowed: false;
      code: string;
      status: 400 | 403;
    };

function text(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function quantity(value: unknown): number {
  return Number(value);
}

function unit(
  value: unknown,
): ProcurementUnit | null {
  const normalized = text(value);

  return ["mt", "m2", "adet"].includes(
    normalized,
  )
    ? normalized as ProcurementUnit
    : null;
}

export function decideProcurementServerContract(
  body: unknown,
): ProcurementContractDecision {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return {
      allowed: false,
      code: "PROCUREMENT_INVALID_JSON",
      status: 400,
    };
  }

  const source =
    body as Record<string, unknown>;

  const action =
    text(source.action).toUpperCase();

  if (
    action !== "CREATE_ORDER" &&
    action !== "OVERRIDE_NO_ORDER"
  ) {
    return {
      allowed: false,
      code: "PROCUREMENT_ACTION_INVALID",
      status: 400,
    };
  }

  if (action === "CREATE_ORDER") {
    if (
      !text(source.idempotencyKey) ||
      !text(source.saleId) ||
      !text(source.supplierId) ||
      !text(source.supplierOrderId) ||
      !Array.isArray(source.lines) ||
      source.lines.length === 0
    ) {
      return {
        allowed: false,
        code: "PROCUREMENT_BATCH_REQUIRED_FIELDS_MISSING",
        status: 400,
      };
    }

    const lines:
      ProcurementOrderLineCommand[] = [];

    const needIds =
      new Set<string>();
    const lineIds =
      new Set<string>();

    for (
      const rawLine of
      source.lines
    ) {
      if (
        !rawLine ||
        typeof rawLine !== "object" ||
        Array.isArray(rawLine)
      ) {
        return {
          allowed: false,
          code: "PROCUREMENT_BATCH_LINE_INVALID",
          status: 400,
        };
      }

      const row =
        rawLine as Record<
          string,
          unknown
        >;

      const requiredQuantity =
        quantity(
          row.requiredQuantity,
        );
      const requiredUnit =
        unit(row.requiredUnit);
      const needId =
        text(row.needId);
      const supplierOrderLineId =
        text(
          row.supplierOrderLineId,
        );

      const productionOrderId =
        text(row.productionOrderId);
      const allocationId =
        text(row.allocationId);
      const purpose =
        text(row.purpose);

      if (
        !needId ||
        !text(row.saleItemId) ||
        !text(row.stockItemId) ||
        !supplierOrderLineId ||
        !productionOrderId ||
        !allocationId ||
        (
          purpose !== "TAILOR_MATERIAL" &&
          purpose !== "MECHANICAL_PRODUCT"
        ) ||
        !Number.isFinite(
          requiredQuantity,
        ) ||
        requiredQuantity <= 0 ||
        !requiredUnit
      ) {
        return {
          allowed: false,
          code: "PROCUREMENT_BATCH_LINE_INVALID",
          status: 400,
        };
      }

      if (
        needIds.has(needId) ||
        lineIds.has(
          supplierOrderLineId,
        )
      ) {
        return {
          allowed: false,
          code: "PROCUREMENT_BATCH_DUPLICATE_LINE",
          status: 400,
        };
      }

      needIds.add(needId);
      lineIds.add(
        supplierOrderLineId,
      );

      lines.push({
        needId,
        saleItemId:
          text(row.saleItemId),
        stockItemId:
          text(row.stockItemId),
        supplierOrderLineId,
        productionOrderId,
        allocationId,
        purpose: purpose as
          | "TAILOR_MATERIAL"
          | "MECHANICAL_PRODUCT",
        requiredQuantity,
        requiredUnit,
      });
    }

    return {
      allowed: true,
      command: {
        action: "CREATE_ORDER",
        idempotencyKey:
          text(source.idempotencyKey),
        saleId:
          text(source.saleId),
        supplierId:
          text(source.supplierId),
        supplierOrderId:
          text(source.supplierOrderId),
        lines,
      },
    };
  }

  const requiredQuantity =
    quantity(
      source.requiredQuantity,
    );
  const requiredUnit =
    unit(source.requiredUnit);

  if (
    !text(source.idempotencyKey) ||
    !text(source.needId) ||
    !text(source.saleId) ||
    !text(source.saleItemId) ||
    !text(source.stockItemId) ||
    !Number.isFinite(
      requiredQuantity,
    ) ||
    requiredQuantity <= 0 ||
    !requiredUnit
  ) {
    return {
      allowed: false,
      code: "PROCUREMENT_REQUIRED_FIELDS_MISSING",
      status: 400,
    };
  }

  if (!text(source.reasonCode)) {
    return {
      allowed: false,
      code: "PROCUREMENT_OVERRIDE_REASON_REQUIRED",
      status: 400,
    };
  }

  return {
    allowed: true,
    command: {
      action: "OVERRIDE_NO_ORDER",
      idempotencyKey:
        text(source.idempotencyKey),
      needId:
        text(source.needId),
      saleId:
        text(source.saleId),
      saleItemId:
        text(source.saleItemId),
      stockItemId:
        text(source.stockItemId),
      requiredQuantity,
      requiredUnit,
      reasonCode:
        text(source.reasonCode),
      reasonText:
        text(source.reasonText) ||
        undefined,
    },
  };
}
