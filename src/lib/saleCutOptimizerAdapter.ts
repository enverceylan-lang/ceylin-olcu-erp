import type {
  SaleCutRequirementPlanResult,
  SaleCutStockRequirement
} from "@/lib/saleCutRequirementPlan";
import {
  generateStoreCutSuggestions,
  type StoreCutSuggestion
} from "@/lib/storeCutSuggestions";
import type {
  CutContinuity,
  StoreCutLot,
  StoreCutRequirement
} from "@/lib/storeCutPlanning";

export interface SaleCutOptimizerPolicy {
  continuity?: CutContinuity;
  sameLotRequired?: boolean;
  requiredColorTone?: string;
  requiredPatternCode?: string;
  maxLotsPerSuggestion?: number;
  maxSuggestions?: number;
}

export interface SaleCutPieceOptimization {
  requirement: StoreCutRequirement;
  parentSaleItemId: string;
  roomName: string;
  openingName: string;
  productType: string;
  requiredMeters: number;
  suggestions: StoreCutSuggestion[];
}

export interface SaleCutStockOptimization {
  stockItemId: string;
  productType: string;
  totalMeters: number;
  pieces: SaleCutPieceOptimization[];
  fullyCovered: boolean;
  missingMeters: number;
}

export type SaleCutOptimizationResult =
  | {
      outcome: "READY";
      saleId: string;
      stockRequirements:
        SaleCutStockOptimization[];
      totalMeters: number;
      missingMeters: number;
    }
  | {
      outcome: "REJECTED";
      reason:
        | "CUT_REQUIREMENT_PLAN_NOT_READY"
        | "INVALID_POLICY";
      errors: string[];
    };

const EPSILON = 0.000001;

function roundMeters(
  value: number
): number {
  return Math.round(value * 1_000_000) /
    1_000_000;
}

function buildStoreRequirement(
  piece: SaleCutStockRequirement["pieces"][number],
  policy: SaleCutOptimizerPolicy
): StoreCutRequirement {
  return {
    id: `store-cut-requirement:${piece.id}`,
    saleItemId: piece.saleItemId,
    stockItemId: piece.stockItemId,
    pieceLengthMeters:
      piece.requiredMeters,
    pieceCount: 1,
    continuity:
      policy.continuity ??
      "SINGLE_PIECE_REQUIRED",
    requiredColorTone:
      policy.requiredColorTone,
    requiredPatternCode:
      policy.requiredPatternCode,
    sameLotRequired:
      policy.sameLotRequired
  };
}

function eligibleLots(
  requirement:
    SaleCutStockRequirement,
  lots: StoreCutLot[]
): StoreCutLot[] {
  return lots.filter(
    lot =>
      lot.stockItemId ===
      requirement.stockItemId
  );
}

function consumeSuggestionFromLots(
  lots: StoreCutLot[],
  suggestion: StoreCutSuggestion | undefined
): StoreCutLot[] {
  if (!suggestion) {
    return lots;
  }

  const consumedByLotId =
    new Map<string, number>();

  for (const cut of suggestion.cuts) {
    consumedByLotId.set(
      cut.lotId,
      roundMeters(
        (consumedByLotId.get(cut.lotId) || 0) +
          cut.lengthMeters
      )
    );
  }

  return lots.map(lot => {
    const consumed =
      consumedByLotId.get(lot.id) || 0;

    if (consumed <= EPSILON) {
      return lot;
    }

    return {
      ...lot,
      reservedMeters: roundMeters(
        Number(lot.reservedMeters || 0) +
          consumed
      )
    };
  });
}

export function optimizeSaleCutRequirementPlan(
  plan: SaleCutRequirementPlanResult,
  lots: StoreCutLot[],
  policyByStockItemId: Record<
    string,
    SaleCutOptimizerPolicy | undefined
  > = {}
): SaleCutOptimizationResult {
  if (plan.outcome !== "READY") {
    return {
      outcome: "REJECTED",
      reason:
        "CUT_REQUIREMENT_PLAN_NOT_READY",
      errors: plan.errors
    };
  }

  const stockRequirements:
    SaleCutStockOptimization[] = [];

  for (
    const stockRequirement of
    plan.requirements
  ) {
    const policy =
      policyByStockItemId[
        stockRequirement.stockItemId
      ] ?? {};

    if (
      policy.maxLotsPerSuggestion !==
        undefined &&
      (
        !Number.isInteger(
          policy.maxLotsPerSuggestion
        ) ||
        policy.maxLotsPerSuggestion < 1
      )
    ) {
      return {
        outcome: "REJECTED",
        reason: "INVALID_POLICY",
        errors: [
          `${stockRequirement.stockItemId}: maxLotsPerSuggestion pozitif tam sayı olmalıdır.`
        ]
      };
    }

    let stockLots =
      eligibleLots(
        stockRequirement,
        lots
      );

    const pieces:
      SaleCutPieceOptimization[] = [];

    for (const piece of stockRequirement.pieces) {
      const requirement =
        buildStoreRequirement(
          piece,
          policy
        );

      const suggestions =
        generateStoreCutSuggestions({
          requirement,
          lots: stockLots,
          maxLotsPerSuggestion:
            policy.maxLotsPerSuggestion,
          maxSuggestions:
            policy.maxSuggestions
        });

      pieces.push({
        requirement,
        parentSaleItemId:
          piece.parentSaleItemId,
        roomName: piece.roomName,
        openingName:
          piece.openingName,
        productType:
          piece.productType,
        requiredMeters:
          piece.requiredMeters,
        suggestions
      });

      stockLots =
        consumeSuggestionFromLots(
          stockLots,
          suggestions[0]
        );
    }

    const missingMeters =
      roundMeters(
        pieces.reduce(
          (total, piece) =>
            total +
            (
              piece.suggestions.length > 0
                ? 0
                : piece.requiredMeters
            ),
          0
        )
      );

    stockRequirements.push({
      stockItemId:
        stockRequirement.stockItemId,
      productType:
        stockRequirement.productType,
      totalMeters:
        stockRequirement.totalMeters,
      pieces,
      fullyCovered:
        missingMeters <= EPSILON,
      missingMeters
    });
  }

  const missingMeters =
    roundMeters(
      stockRequirements.reduce(
        (total, requirement) =>
          total +
          requirement.missingMeters,
        0
      )
    );

  return {
    outcome: "READY",
    saleId: plan.saleId,
    stockRequirements,
    totalMeters:
      plan.totalMeters,
    missingMeters
  };
}