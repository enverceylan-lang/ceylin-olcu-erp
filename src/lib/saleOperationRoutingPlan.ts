import type {
  Sale,
  SaleItem
} from "@/store/salesStore";
import {
  normalizeText,
  shouldCreateTailorProductionItem
} from "@/lib/productionRouting";

export type SaleItemOperationRoute =
  | "TAILOR_AND_MATERIAL_SOURCE"
  | "SUPPLIER_MECHANICAL"
  | "SERVICE_ONLY"
  | "ACCESSORY_POLICY_REQUIRED"
  | "MANUAL_REVIEW";

export interface SaleItemRoutingDecision {
  saleItemId: string;
  productGroup: string;
  productType: string;
  route: SaleItemOperationRoute;
  requiresTailor: boolean;
  requiresSupplier: boolean;
  requiresMaterialSourceDecision: boolean;
  reason: string;
}

export interface SaleOperationRoutingPlan {
  saleId: string;
  decisions: SaleItemRoutingDecision[];
  requiresTailor: boolean;
  requiresSupplier: boolean;
  requiresMaterialSourceDecision: boolean;
  requiresManualReview: boolean;
}

function normalized(value: string | undefined): string {
  return normalizeText(
    String(value || "").trim()
  );
}

function isMechanicalItem(
  item: SaleItem
): boolean {
  const group = normalized(item.productGroup);
  const type = normalized(item.productType);

  if (group.startsWith("0002")) {
    return true;
  }

  return [
    "STOR",
    "ZEBRA",
    "PLICELL",
    "JALUZI",
    "AHSAP",
    "PICASSO",
    "DIKEY",
    "MEKANIK"
  ].some(
    token =>
      group.includes(token) ||
      type.includes(token)
  );
}

function isServiceItem(
  item: SaleItem
): boolean {
  const group = normalized(item.productGroup);

  return (
    group.startsWith("0003") ||
    group.includes("HIZMET")
  );
}

function isAccessoryItem(
  item: SaleItem
): boolean {
  const group = normalized(item.productGroup);

  return (
    group.startsWith("0004") ||
    group.includes("AKSESUAR")
  );
}

export function decideSaleItemOperationRoute(
  item: SaleItem
): SaleItemRoutingDecision {
  if (isMechanicalItem(item)) {
    return {
      saleItemId: item.id,
      productGroup: item.productGroup,
      productType: item.productType,
      route: "SUPPLIER_MECHANICAL",
      requiresTailor: false,
      requiresSupplier: true,
      requiresMaterialSourceDecision: false,
      reason:
        "Mekanik ürün tedarikçi akışına gider; terziye gönderilmez."
    };
  }

  if (shouldCreateTailorProductionItem(item)) {
    return {
      saleItemId: item.id,
      productGroup: item.productGroup,
      productType: item.productType,
      route: "TAILOR_AND_MATERIAL_SOURCE",
      requiresTailor: true,
      requiresSupplier: false,
      requiresMaterialSourceDecision: true,
      reason:
        "Perde/dikim ürünü terziye gider; önce mağaza stoğu veya tedarik kaynağı belirlenmelidir."
    };
  }

  if (isServiceItem(item)) {
    return {
      saleItemId: item.id,
      productGroup: item.productGroup,
      productType: item.productType,
      route: "SERVICE_ONLY",
      requiresTailor: false,
      requiresSupplier: false,
      requiresMaterialSourceDecision: false,
      reason:
        "Hizmet kalemi fiziksel stok veya terzi üretimi gerektirmez."
    };
  }

  if (isAccessoryItem(item)) {
    return {
      saleItemId: item.id,
      productGroup: item.productGroup,
      productType: item.productType,
      route: "ACCESSORY_POLICY_REQUIRED",
      requiresTailor: false,
      requiresSupplier: false,
      requiresMaterialSourceDecision: true,
      reason:
        "Aksesuar için stok/tedarik politikası ürün kartından belirlenmelidir."
    };
  }

  return {
    saleItemId: item.id,
    productGroup: item.productGroup,
    productType: item.productType,
    route: "MANUAL_REVIEW",
    requiresTailor: false,
    requiresSupplier: false,
    requiresMaterialSourceDecision: false,
    reason:
      "Ürün grubu güvenli otomatik yönlendirme için yeterince tanımlı değil."
  };
}

export function buildSaleOperationRoutingPlan(
  sale: Sale
): SaleOperationRoutingPlan {
  const decisions =
    sale.items.map(
      decideSaleItemOperationRoute
    );

  return {
    saleId: sale.id,
    decisions,
    requiresTailor:
      decisions.some(
        decision =>
          decision.requiresTailor
      ),
    requiresSupplier:
      decisions.some(
        decision =>
          decision.requiresSupplier
      ),
    requiresMaterialSourceDecision:
      decisions.some(
        decision =>
          decision.requiresMaterialSourceDecision
      ),
    requiresManualReview:
      decisions.some(
        decision =>
          decision.route ===
            "MANUAL_REVIEW" ||
          decision.route ===
            "ACCESSORY_POLICY_REQUIRED"
      )
  };
}