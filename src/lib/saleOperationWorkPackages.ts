import type {
  Sale,
  SaleItem
} from "@/store/salesStore";
import {
  buildSaleOperationRoutingPlan,
  type SaleItemOperationRoute,
  type SaleItemRoutingDecision
} from "@/lib/saleOperationRoutingPlan";

export type SaleOperationWorkPackageKind =
  | "TAILOR_MATERIAL"
  | "SUPPLIER_MECHANICAL"
  | "SERVICE"
  | "ACCESSORY_POLICY"
  | "MANUAL_REVIEW";

export interface SaleOperationWorkPackage {
  id: string;
  saleId: string;
  kind: SaleOperationWorkPackageKind;
  route: SaleItemOperationRoute;
  itemIds: string[];
  items: SaleItem[];
  requiresTailor: boolean;
  requiresSupplier: boolean;
  requiresMaterialSourceDecision: boolean;
}

export interface SaleOperationWorkPackagePlan {
  saleId: string;
  packages: SaleOperationWorkPackage[];
  hasMixedOperationalRoutes: boolean;
  hasBlockingReview: boolean;
}

function packageKind(
  decision: SaleItemRoutingDecision
): SaleOperationWorkPackageKind {
  if (
    decision.route ===
    "TAILOR_AND_MATERIAL_SOURCE"
  ) {
    return "TAILOR_MATERIAL";
  }

  if (
    decision.route ===
    "SUPPLIER_MECHANICAL"
  ) {
    return "SUPPLIER_MECHANICAL";
  }

  if (
    decision.route ===
    "SERVICE_ONLY"
  ) {
    return "SERVICE";
  }

  if (
    decision.route ===
    "ACCESSORY_POLICY_REQUIRED"
  ) {
    return "ACCESSORY_POLICY";
  }

  return "MANUAL_REVIEW";
}

function packageId(
  saleId: string,
  kind: SaleOperationWorkPackageKind
): string {
  return [
    "sale-work-package",
    encodeURIComponent(saleId),
    kind
  ].join(":");
}

export function buildSaleOperationWorkPackages(
  sale: Sale
): SaleOperationWorkPackagePlan {
  const routingPlan =
    buildSaleOperationRoutingPlan(sale);

  const itemById =
    new Map(
      sale.items.map(item => [
        item.id,
        item
      ])
    );

  const grouped =
    new Map<
      SaleOperationWorkPackageKind,
      {
        route: SaleItemOperationRoute;
        decisions: SaleItemRoutingDecision[];
      }
    >();

  for (const decision of routingPlan.decisions) {
    const kind = packageKind(decision);
    const existing = grouped.get(kind);

    if (existing) {
      existing.decisions.push(decision);
      continue;
    }

    grouped.set(kind, {
      route: decision.route,
      decisions: [decision]
    });
  }

  const packages =
    Array.from(grouped.entries())
      .map(([kind, group]) => {
        const items =
          group.decisions
            .map(decision =>
              itemById.get(
                decision.saleItemId
              )
            )
            .filter(
              (
                item
              ): item is SaleItem =>
                Boolean(item)
            );

        return {
          id: packageId(
            sale.id,
            kind
          ),
          saleId: sale.id,
          kind,
          route: group.route,
          itemIds:
            items.map(item => item.id),
          items,
          requiresTailor:
            group.decisions.some(
              decision =>
                decision.requiresTailor
            ),
          requiresSupplier:
            group.decisions.some(
              decision =>
                decision.requiresSupplier
            ),
          requiresMaterialSourceDecision:
            group.decisions.some(
              decision =>
                decision
                  .requiresMaterialSourceDecision
            )
        };
      });

  const operationalKinds =
    new Set(
      packages
        .filter(
          workPackage =>
            workPackage.kind ===
              "TAILOR_MATERIAL" ||
            workPackage.kind ===
              "SUPPLIER_MECHANICAL"
        )
        .map(
          workPackage =>
            workPackage.kind
        )
    );

  return {
    saleId: sale.id,
    packages,
    hasMixedOperationalRoutes:
      operationalKinds.size > 1,
    hasBlockingReview:
      packages.some(
        workPackage =>
          workPackage.kind ===
            "ACCESSORY_POLICY" ||
          workPackage.kind ===
            "MANUAL_REVIEW"
      )
  };
}

export function getSaleOperationWorkPackage(
  sale: Sale,
  kind: SaleOperationWorkPackageKind
): SaleOperationWorkPackage | undefined {
  return buildSaleOperationWorkPackages(
    sale
  ).packages.find(
    workPackage =>
      workPackage.kind === kind
  );
}