import {
  evaluateStoreCutPlan,
  getAvailableLotMeters,
  type PlannedStoreCut,
  type StoreCutLot,
  type StoreCutPlanResult,
  type StoreCutRequirement,
} from "./storeCutPlanning";

export interface StoreCutSuggestionInput {
  requirement: StoreCutRequirement;
  lots: StoreCutLot[];
  maxLotsPerSuggestion?: number;
  maxSuggestions?: number;
}

export interface StoreCutSuggestion {
  id: string;
  score: number;
  cuts: PlannedStoreCut[];
  lotIds: string[];
  totalWasteMeters: number;
  remainingMeters: number;
  exhaustedLotCount: number;
  warnings: string[];
  evaluation: StoreCutPlanResult;
}

const EPSILON = 0.000001;

function roundMeters(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function normalizeCode(value: string | undefined): string {
  return value?.trim().toLocaleUpperCase("tr-TR") ?? "";
}

function isCompatible(
  requirement: StoreCutRequirement,
  lot: StoreCutLot
): boolean {
  if (lot.isBlocked || lot.stockItemId !== requirement.stockItemId) {
    return false;
  }
  if (
    requirement.requiredColorTone &&
    normalizeCode(lot.colorTone) !==
      normalizeCode(requirement.requiredColorTone)
  ) {
    return false;
  }
  if (
    requirement.requiredPatternCode &&
    normalizeCode(lot.patternCode) !==
      normalizeCode(requirement.requiredPatternCode)
  ) {
    return false;
  }
  return getAvailableLotMeters(lot) > EPSILON;
}

function createSubsets<T>(items: T[], maxSize: number): T[][] {
  const subsets: T[][] = [];

  function visit(start: number, current: T[]) {
    if (current.length > 0) subsets.push([...current]);
    if (current.length === maxSize) return;

    for (let index = start; index < items.length; index += 1) {
      current.push(items[index]);
      visit(index + 1, current);
      current.pop();
    }
  }

  visit(0, []);
  return subsets;
}

function buildSinglePieceCuts(
  requirement: StoreCutRequirement,
  lots: StoreCutLot[]
): PlannedStoreCut[] | null {
  const remainingByLot = new Map(
    lots.map((lot) => [lot.id, getAvailableLotMeters(lot)])
  );
  const cuts: PlannedStoreCut[] = [];

  for (let piece = 0; piece < requirement.pieceCount; piece += 1) {
    const lot = lots
      .filter(
        (candidate) =>
          (remainingByLot.get(candidate.id) ?? 0) + EPSILON >=
          requirement.pieceLengthMeters
      )
      .sort(
        (left, right) =>
          (remainingByLot.get(left.id) ?? 0) -
          (remainingByLot.get(right.id) ?? 0)
      )[0];

    if (!lot) return null;

    cuts.push({
      id: `suggested-cut-${piece + 1}`,
      requirementId: requirement.id,
      lotId: lot.id,
      lengthMeters: requirement.pieceLengthMeters,
    });
    remainingByLot.set(
      lot.id,
      roundMeters(
        (remainingByLot.get(lot.id) ?? 0) - requirement.pieceLengthMeters
      )
    );
  }

  return cuts;
}

function buildMultiPieceCuts(
  requirement: StoreCutRequirement,
  lots: StoreCutLot[]
): PlannedStoreCut[] | null {
  let remainingNeed = roundMeters(
    requirement.pieceLengthMeters * requirement.pieceCount
  );
  const cuts: PlannedStoreCut[] = [];
  const sortedLots = [...lots].sort(
    (left, right) =>
      getAvailableLotMeters(left) - getAvailableLotMeters(right)
  );

  for (const lot of sortedLots) {
    if (remainingNeed <= EPSILON) break;
    const cutMeters = roundMeters(
      Math.min(remainingNeed, getAvailableLotMeters(lot))
    );
    if (cutMeters <= EPSILON) continue;

    cuts.push({
      id: `suggested-cut-${cuts.length + 1}`,
      requirementId: requirement.id,
      lotId: lot.id,
      lengthMeters: cutMeters,
    });
    remainingNeed = roundMeters(remainingNeed - cutMeters);
  }

  return remainingNeed <= EPSILON ? cuts : null;
}

function hasCompatibleLotGroup(
  requirement: StoreCutRequirement,
  lots: StoreCutLot[]
): boolean {
  if (!requirement.sameLotRequired) return true;
  const lotCodes = new Set(lots.map((lot) => normalizeCode(lot.lotCode)));
  return lotCodes.size === 1 && !lotCodes.has("");
}

export function generateStoreCutSuggestions(
  input: StoreCutSuggestionInput
): StoreCutSuggestion[] {
  const maxLots = Math.max(1, Math.min(input.maxLotsPerSuggestion ?? 3, 6));
  const maxSuggestions = Math.max(1, input.maxSuggestions ?? 20);
  const compatibleLots = input.lots.filter((lot) =>
    isCompatible(input.requirement, lot)
  );
  const uniqueSuggestions = new Map<string, StoreCutSuggestion>();

  for (const lots of createSubsets(compatibleLots, maxLots)) {
    if (!hasCompatibleLotGroup(input.requirement, lots)) continue;

    const cuts =
      input.requirement.continuity === "SINGLE_PIECE_REQUIRED"
        ? buildSinglePieceCuts(input.requirement, lots)
        : buildMultiPieceCuts(input.requirement, lots);
    if (!cuts) continue;

    const usedLotIds = [...new Set(cuts.map((cut) => cut.lotId))].sort();
    const usedLots = lots.filter((lot) => usedLotIds.includes(lot.id));
    const evaluation = evaluateStoreCutPlan({
      requirements: [input.requirement],
      lots: usedLots,
      cuts,
    });
    if (!evaluation.valid) continue;

    const remainingMeters = roundMeters(
      evaluation.lotResults.reduce(
        (total, lot) => total + lot.remainingAfterMeters,
        0
      )
    );
    const exhaustedLotCount = evaluation.lotResults.filter(
      (lot) => lot.remainingAfterMeters <= EPSILON
    ).length;
    const warnings: string[] = [];
    if (usedLotIds.length > 1) warnings.push("Birden fazla top/lot kullanılacak.");
    if (
      input.requirement.continuity === "MULTI_PIECE_ALLOWED" &&
      cuts.length > 1
    ) {
      warnings.push("İhtiyaç parçalı kesimle karşılanacak.");
    }

    const score = Math.round(
      1000 -
        evaluation.planWasteMeters * 100 -
        usedLotIds.length * 10 +
        exhaustedLotCount * 15 -
        remainingMeters * 0.01
    );
    const key = cuts
      .map((cut) => `${cut.lotId}:${cut.lengthMeters}`)
      .sort()
      .join("|");

    uniqueSuggestions.set(key, {
      id: `cut-suggestion-${uniqueSuggestions.size + 1}`,
      score,
      cuts,
      lotIds: usedLotIds,
      totalWasteMeters: evaluation.planWasteMeters,
      remainingMeters,
      exhaustedLotCount,
      warnings,
      evaluation,
    });
  }

  return [...uniqueSuggestions.values()]
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.lotIds.length - right.lotIds.length ||
        left.remainingMeters - right.remainingMeters
    )
    .slice(0, maxSuggestions);
}
