import type { Sale, SaleItem } from "@/store/salesStore";

export interface SaleCutPiece {
  id: string;
  saleId: string;
  saleItemId: string;
  parentSaleItemId: string;
  measurementId?: string;
  stockItemId: string;
  roomName: string;
  openingName: string;
  productType: string;
  requiredMeters: number;
}

export interface SaleCutStockRequirement {
  stockItemId: string;
  productType: string;
  totalMeters: number;
  pieces: SaleCutPiece[];
}

export type SaleCutRequirementPlanResult =
  | {
      outcome: "READY";
      saleId: string;
      requirements: SaleCutStockRequirement[];
      totalMeters: number;
    }
  | {
      outcome: "REJECTED";
      saleId: string;
      reason:
        | "NO_CUTTABLE_ITEMS"
        | "MISSING_STOCK_IDENTITY"
        | "INVALID_CUT_QUANTITY"
        | "STOCK_IDENTITY_MISMATCH"
        | "AGGREGATE_MISMATCH";
      errors: string[];
    };

const EPSILON = 0.01;

function roundMeters(value: number): number {
  return Math.round(value * 100) / 100;
}

function requiredMeters(item: SaleItem): number {
  const fabricMeters = Number(item.fabricMeters || 0);

  if (Number.isFinite(fabricMeters) && fabricMeters > 0) {
    return roundMeters(fabricMeters);
  }

  if (item.metricUnit === "mt") {
    const metricSize = Number(item.metricSize || 0);

    if (Number.isFinite(metricSize) && metricSize > 0) {
      return roundMeters(metricSize * Number(item.quantity || 1));
    }
  }

  return 0;
}

function sourceItems(item: SaleItem): SaleItem[] {
  if (Array.isArray(item.productionBreakdown) && item.productionBreakdown.length > 0) {
    return item.productionBreakdown;
  }

  return [item];
}

export function buildSaleCutRequirementPlan(
  sale: Sale
): SaleCutRequirementPlanResult {
  const pieces: SaleCutPiece[] = [];

  for (const saleItem of sale.items) {
    if (saleItem.isJumboComponent) {
      continue;
    }

    const breakdown = sourceItems(saleItem);
    const cuttableBreakdown = breakdown.filter(item => requiredMeters(item) > 0);

    if (cuttableBreakdown.length === 0) {
      continue;
    }

    const aggregateStockId = saleItem.stockItemId?.trim();
    const aggregateMeters = requiredMeters(saleItem);
    let breakdownTotal = 0;

    for (let index = 0; index < cuttableBreakdown.length; index += 1) {
      const detail = cuttableBreakdown[index];
      const detailStockId = detail.stockItemId?.trim() || aggregateStockId;

      if (!detailStockId) {
        return {
          outcome: "REJECTED",
          saleId: sale.id,
          reason: "MISSING_STOCK_IDENTITY",
          errors: [
            `${detail.roomName} / ${detail.windowName} / ${detail.productType}: stok kartı kimliği bulunamadı.`
          ]
        };
      }

      if (
        aggregateStockId &&
        detail.stockItemId?.trim() &&
        detail.stockItemId.trim() !== aggregateStockId
      ) {
        return {
          outcome: "REJECTED",
          saleId: sale.id,
          reason: "STOCK_IDENTITY_MISMATCH",
          errors: [
            `${detail.roomName} / ${detail.windowName} / ${detail.productType}: satış toplamı ile açıklık stok kartı eşleşmiyor.`
          ]
        };
      }

      const meters = requiredMeters(detail);

      if (!Number.isFinite(meters) || meters <= 0) {
        return {
          outcome: "REJECTED",
          saleId: sale.id,
          reason: "INVALID_CUT_QUANTITY",
          errors: [
            `${detail.roomName} / ${detail.windowName} / ${detail.productType}: kesim metresi geçersiz.`
          ]
        };
      }

      breakdownTotal = roundMeters(breakdownTotal + meters);

      pieces.push({
        id: ["cut-piece", sale.id, saleItem.id, detail.id, index].join(":"),
        saleId: sale.id,
        saleItemId: detail.id,
        parentSaleItemId: saleItem.id,
        measurementId: detail.measurementId,
        stockItemId: detailStockId,
        roomName: detail.roomName,
        openingName: detail.windowName,
        productType: detail.productType,
        requiredMeters: meters
      });
    }

    if (
      aggregateMeters > 0 &&
      Math.abs(aggregateMeters - breakdownTotal) > EPSILON
    ) {
      return {
        outcome: "REJECTED",
        saleId: sale.id,
        reason: "AGGREGATE_MISMATCH",
        errors: [
          `${saleItem.roomName} / ${saleItem.productType}: satış toplamı ${aggregateMeters} mt, açıklık toplamı ${breakdownTotal} mt.`
        ]
      };
    }
  }

  if (pieces.length === 0) {
    return {
      outcome: "REJECTED",
      saleId: sale.id,
      reason: "NO_CUTTABLE_ITEMS",
      errors: ["Satışta metre bazlı kesim ihtiyacı bulunamadı."]
    };
  }

  const grouped = new Map<string, SaleCutStockRequirement>();

  for (const piece of pieces) {
    const existing = grouped.get(piece.stockItemId);

    if (existing) {
      existing.pieces.push(piece);
      existing.totalMeters = roundMeters(existing.totalMeters + piece.requiredMeters);
      continue;
    }

    grouped.set(piece.stockItemId, {
      stockItemId: piece.stockItemId,
      productType: piece.productType,
      totalMeters: piece.requiredMeters,
      pieces: [piece]
    });
  }

  const requirements = Array.from(grouped.values());

  return {
    outcome: "READY",
    saleId: sale.id,
    requirements,
    totalMeters: roundMeters(
      requirements.reduce((total, requirement) => total + requirement.totalMeters, 0)
    )
  };
}