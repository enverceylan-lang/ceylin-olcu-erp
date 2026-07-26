export type ProductionSourceType =
  | "STORE_CUT"
  | "READY_STOCK"
  | "SUPPLIER_ORDER";

export type ProductionSourceStatus =
  | "PLANNED"
  | "RESERVED"
  | "ORDERED"
  | "READY"
  | "CONSUMED"
  | "CANCELLED";

export type ProductionQuantityUnit = "mt" | "m2" | "adet";

export interface ProductionSourceAllocation {
  id: string;
  productionItemId: string;
  sourceType: ProductionSourceType;
  quantity: number;
  unit: ProductionQuantityUnit;
  status: ProductionSourceStatus;
  lotId?: string;
  reservationId?: string;
  supplierId?: string;
  supplierOrderId?: string;
}

export interface ProductionSourcePlan {
  id: string;
  productionItemId: string;
  requiredQuantity: number;
  unit: ProductionQuantityUnit;
  version: number;
  allocations: ProductionSourceAllocation[];
}

export interface ProductionSourceCoverage {
  allocatedQuantity: number;
  missingQuantity: number;
  excessQuantity: number;
  isFullyAllocated: boolean;
  isMixedSource: boolean;
}

const EPSILON = 0.000001;

function isPresent(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function roundQuantity(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function analyzeProductionSourcePlan(
  plan: ProductionSourcePlan
): ProductionSourceCoverage {
  const activeAllocations = plan.allocations.filter(
    (allocation) => allocation.status !== "CANCELLED"
  );
  const allocatedQuantity = roundQuantity(
    activeAllocations.reduce(
      (total, allocation) => total + allocation.quantity,
      0
    )
  );
  const missingQuantity = roundQuantity(
    Math.max(0, plan.requiredQuantity - allocatedQuantity)
  );
  const excessQuantity = roundQuantity(
    Math.max(0, allocatedQuantity - plan.requiredQuantity)
  );

  return {
    allocatedQuantity,
    missingQuantity,
    excessQuantity,
    isFullyAllocated:
      Math.abs(allocatedQuantity - plan.requiredQuantity) <= EPSILON,
    isMixedSource:
      new Set(activeAllocations.map((allocation) => allocation.sourceType))
        .size > 1,
  };
}

export function validateProductionSourcePlan(
  plan: ProductionSourcePlan
): string[] {
  const errors: string[] = [];
  const allocationIds = new Set<string>();

  if (!isPresent(plan.id)) errors.push("Kaynak planı kimliği zorunludur.");
  if (!isPresent(plan.productionItemId)) {
    errors.push("Üretim kalemi kimliği zorunludur.");
  }
  if (!Number.isFinite(plan.requiredQuantity) || plan.requiredQuantity <= 0) {
    errors.push("Gerekli üretim miktarı sıfırdan büyük olmalıdır.");
  }
  if (!Number.isInteger(plan.version) || plan.version < 1) {
    errors.push("Kaynak planı sürümü pozitif bir tam sayı olmalıdır.");
  }

  plan.allocations.forEach((allocation, index) => {
    const label = `Kaynak ${index + 1}`;

    if (!isPresent(allocation.id)) {
      errors.push(`${label}: kimlik zorunludur.`);
    } else if (allocationIds.has(allocation.id)) {
      errors.push(`${label}: mükerrer kaynak kimliği kullanılamaz.`);
    } else {
      allocationIds.add(allocation.id);
    }

    if (allocation.productionItemId !== plan.productionItemId) {
      errors.push(`${label}: üretim kalemi plan ile eşleşmiyor.`);
    }
    if (!Number.isFinite(allocation.quantity) || allocation.quantity <= 0) {
      errors.push(`${label}: miktar sıfırdan büyük olmalıdır.`);
    }
    if (allocation.unit !== plan.unit) {
      errors.push(`${label}: miktar birimi plan ile eşleşmiyor.`);
    }

    if (allocation.sourceType === "STORE_CUT") {
      if (!isPresent(allocation.lotId)) {
        errors.push(`${label}: mağaza kesimi için top/lot zorunludur.`);
      }
      if (!isPresent(allocation.reservationId)) {
        errors.push(`${label}: mağaza kesimi için rezervasyon zorunludur.`);
      }
      if (isPresent(allocation.supplierOrderId)) {
        errors.push(`${label}: mağaza kesimine tedarikçi siparişi bağlanamaz.`);
      }
    }

    if (allocation.sourceType === "READY_STOCK") {
      if (!isPresent(allocation.reservationId)) {
        errors.push(`${label}: hazır stok için rezervasyon zorunludur.`);
      }
      if (isPresent(allocation.supplierOrderId)) {
        errors.push(`${label}: hazır stoğa tedarikçi siparişi bağlanamaz.`);
      }
    }

    if (allocation.sourceType === "SUPPLIER_ORDER") {
      if (!isPresent(allocation.supplierId)) {
        errors.push(`${label}: tedarikçi zorunludur.`);
      }
      if (!isPresent(allocation.supplierOrderId)) {
        errors.push(`${label}: tedarikçi siparişi zorunludur.`);
      }
      if (isPresent(allocation.lotId) || isPresent(allocation.reservationId)) {
        errors.push(
          `${label}: tedarikçi siparişine stok lotu veya rezervasyonu bağlanamaz.`
        );
      }
    }
  });

  if (analyzeProductionSourcePlan(plan).excessQuantity > EPSILON) {
    errors.push("Kaynak tahsisi gerekli üretim miktarını aşamaz.");
  }

  return errors;
}

export function canManageProductionSource(role: string | null | undefined) {
  // Rol kodları sistem anahtarlarıdır; dil bağımsız ASCII dönüşümü kullanılır.
  const normalizedRole = role?.trim().toLowerCase();
  return normalizedRole === "admin" || normalizedRole === "office";
}
