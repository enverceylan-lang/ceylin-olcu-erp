export type SupplierOrderExchangeStatus =
  | "DRAFT"
  | "SENT"
  | "ACCEPTED"
  | "PREPARING"
  | "READY"
  | "SHIPPED"
  | "RECEIVED"
  | "CANCELLED";

export type SupplierInstruction =
  | {
      kind: "CUT_LENGTH";
      id: string;
      stockItemId: string;
      productType: string;
      saleItemId: string;
      parentSaleItemId: string;
      supplierOrderId: string;
      lengthMeters: number;
      splitAllowed: boolean;
      sequence: number;
    }
  | {
      kind: "MANUFACTURE_SIZE";
      id: string;
      stockItemId?: string;
      productType: string;
      widthCm: number;
      heightCm: number;
      quantity: number;
      sequence: number;
      technicalNotes?: string;
    }
  | {
      kind: "GOODS_QUANTITY";
      id: string;
      stockItemId: string;
      productType: string;
      quantity: number;
      unit: "mt" | "m2" | "adet" | "paket" | "set" | "kg";
      sequence: number;
    };

export interface SupplierOrderExchange {
  id: string;
  idempotencyKey: string;

  sourceTenantId: string;
  sourceCompanyId: string;

  supplierId: string;

  targetTenantId?: string;
  targetCompanyId?: string;

  sourcePurchaseOrderId: string;
  sourceSaleId?: string;

  status: SupplierOrderExchangeStatus;

  instructions: SupplierInstruction[];

  createdAt: string;
  updatedAt: string;
}

function hasText(
  value: string | undefined
): boolean {
  return Boolean(value?.trim());
}

export function validateSupplierOrderExchange(
  order: SupplierOrderExchange
): string[] {
  const errors: string[] = [];

  const required = [
    order.id,
    order.idempotencyKey,
    order.sourceTenantId,
    order.sourceCompanyId,
    order.supplierId,
    order.sourcePurchaseOrderId,
    order.createdAt,
    order.updatedAt
  ];

  if (required.some(value => !hasText(value))) {
    errors.push("Tedarikçi sipariş pasaportu eksik.");
  }

  if (
    Boolean(order.targetTenantId) !==
    Boolean(order.targetCompanyId)
  ) {
    errors.push(
      "Hedef ENVERP tenant ve company kimlikleri birlikte bulunmalıdır."
    );
  }

  if (order.instructions.length === 0) {
    errors.push(
      "Tedarikçi siparişinde en az bir üretim/kesim talimatı olmalıdır."
    );
  }

  const ids = new Set<string>();

  order.instructions.forEach(
    instruction => {
      if (!hasText(instruction.id)) {
        errors.push("Talimat kimliği zorunludur.");
      } else if (ids.has(instruction.id)) {
        errors.push(
          `Mükerrer talimat kimliği: ${instruction.id}`
        );
      } else {
        ids.add(instruction.id);
      }

      if (
        !Number.isInteger(
          instruction.sequence
        ) ||
        instruction.sequence < 1
      ) {
        errors.push(
          `${instruction.id}: sıra pozitif tam sayı olmalıdır.`
        );
      }

      if (
        instruction.kind === "CUT_LENGTH" &&
        (
          !hasText(instruction.stockItemId) ||
          !Number.isFinite(
            instruction.lengthMeters
          ) ||
          instruction.lengthMeters <= 0
        )
      ) {
        errors.push(
          `${instruction.id}: kesim talimatı geçersiz.`
        );
      }

      if (
        instruction.kind === "MANUFACTURE_SIZE" &&
        (
          !Number.isFinite(
            instruction.widthCm
          ) ||
          instruction.widthCm <= 0 ||
          !Number.isFinite(
            instruction.heightCm
          ) ||
          instruction.heightCm <= 0 ||
          !Number.isInteger(
            instruction.quantity
          ) ||
          instruction.quantity < 1
        )
      ) {
        errors.push(
          `${instruction.id}: üretim ölçüsü geçersiz.`
        );
      }

      if (
        instruction.kind === "GOODS_QUANTITY" &&
        (
          !hasText(instruction.stockItemId) ||
          !Number.isFinite(
            instruction.quantity
          ) ||
          instruction.quantity <= 0
        )
      ) {
        errors.push(
          `${instruction.id}: mal miktarı geçersiz.`
        );
      }
    }
  );

  return errors;
}

export function formatSupplierOrderForWhatsApp(
  order: SupplierOrderExchange,
  supplierName: string,
  companyName = "ENVerp"
): string {
  const lines: string[] = [
    companyName,
    `TEDARİKÇİ SİPARİŞİ — ${supplierName}`,
    `Sipariş: ${order.sourcePurchaseOrderId}`,
    ""
  ];

  order.instructions.forEach(
    instruction => {
      if (
        instruction.kind === "CUT_LENGTH"
      ) {
        lines.push(
          `${instruction.sequence}. ${instruction.productType} — ${instruction.lengthMeters} mt` +
          (
            instruction.splitAllowed
              ? " — parçalı olabilir"
              : " — tek parça"
          )
        );
        return;
      }

      if (
        instruction.kind ===
        "MANUFACTURE_SIZE"
      ) {
        lines.push(
          `${instruction.sequence}. ${instruction.productType} — ${instruction.widthCm}x${instruction.heightCm} cm — ${instruction.quantity} adet`
        );
        return;
      }

      lines.push(
        `${instruction.sequence}. ${instruction.productType} — ${instruction.quantity} ${instruction.unit}`
      );
    }
  );

  return lines.join("\n");
}