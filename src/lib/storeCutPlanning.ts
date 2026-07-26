export type CutContinuity =
  | "SINGLE_PIECE_REQUIRED"
  | "MULTI_PIECE_ALLOWED";

export interface StoreCutRequirement {
  id: string;
  saleItemId: string;
  stockItemId: string;
  pieceLengthMeters: number;
  pieceCount: number;
  continuity: CutContinuity;
  requiredColorTone?: string;
  requiredPatternCode?: string;
  sameLotRequired?: boolean;
}

export interface StoreCutLot {
  id: string;
  stockItemId: string;
  onHandMeters: number;
  reservedMeters: number;
  unusableMeters?: number;
  lotCode?: string;
  colorTone?: string;
  patternCode?: string;
  isBlocked?: boolean;
}

export interface PlannedStoreCut {
  id: string;
  requirementId: string;
  lotId: string;
  lengthMeters: number;
}

export interface StoreCutPlanInput {
  requirements: StoreCutRequirement[];
  lots: StoreCutLot[];
  cuts: PlannedStoreCut[];
}

export interface StoreCutLotResult {
  lotId: string;
  availableBeforeMeters: number;
  plannedCutMeters: number;
  remainingAfterMeters: number;
}

export interface StoreCutRequirementResult {
  requirementId: string;
  requiredMeters: number;
  plannedMeters: number;
  planWasteMeters: number;
  isSatisfied: boolean;
}

export interface StoreCutPlanResult {
  valid: boolean;
  requiredMeters: number;
  plannedCutMeters: number;
  planWasteMeters: number;
  lotResults: StoreCutLotResult[];
  requirementResults: StoreCutRequirementResult[];
  errors: string[];
}

const EPSILON = 0.000001;

function roundMeters(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function isPositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export function getAvailableLotMeters(lot: StoreCutLot): number {
  if (!Number.isFinite(lot.onHandMeters)) return 0;
  if (!Number.isFinite(lot.reservedMeters)) return 0;
  const unusableMeters = lot.unusableMeters ?? 0;
  if (!Number.isFinite(unusableMeters)) return 0;
  return roundMeters(
    Math.max(0, lot.onHandMeters - lot.reservedMeters - unusableMeters)
  );
}

export function evaluateStoreCutPlan(
  input: StoreCutPlanInput
): StoreCutPlanResult {
  const errors: string[] = [];
  const requirementById = new Map(
    input.requirements.map((requirement) => [requirement.id, requirement])
  );
  const lotById = new Map(input.lots.map((lot) => [lot.id, lot]));
  const seenRequirementIds = new Set<string>();
  const seenLotIds = new Set<string>();
  const seenCutIds = new Set<string>();

  input.requirements.forEach((requirement) => {
    if (seenRequirementIds.has(requirement.id)) {
      errors.push(`Mükerrer ihtiyaç kimliği: ${requirement.id}`);
    }
    seenRequirementIds.add(requirement.id);

    if (!isPositive(requirement.pieceLengthMeters)) {
      errors.push(`${requirement.id}: parça uzunluğu sıfırdan büyük olmalıdır.`);
    }
    if (!Number.isInteger(requirement.pieceCount) || requirement.pieceCount < 1) {
      errors.push(`${requirement.id}: parça adedi pozitif tam sayı olmalıdır.`);
    }
  });

  input.lots.forEach((lot) => {
    if (seenLotIds.has(lot.id)) {
      errors.push(`Mükerrer lot kimliği: ${lot.id}`);
    }
    seenLotIds.add(lot.id);

    if (!Number.isFinite(lot.onHandMeters) || lot.onHandMeters < 0) {
      errors.push(`${lot.id}: mevcut metre geçersiz.`);
    }
    if (!Number.isFinite(lot.reservedMeters) || lot.reservedMeters < 0) {
      errors.push(`${lot.id}: rezerve metre geçersiz.`);
    }
    if (
      !Number.isFinite(lot.unusableMeters ?? 0) ||
      (lot.unusableMeters ?? 0) < 0
    ) {
      errors.push(`${lot.id}: kullanılamaz metre geçersiz.`);
    }
    if (
      lot.reservedMeters + (lot.unusableMeters ?? 0) >
      lot.onHandMeters + EPSILON
    ) {
      errors.push(
        `${lot.id}: rezerve ve kullanılamaz metre mevcut metreden fazla olamaz.`
      );
    }
  });

  input.cuts.forEach((cut) => {
    if (seenCutIds.has(cut.id)) {
      errors.push(`Mükerrer kesim kimliği: ${cut.id}`);
    }
    seenCutIds.add(cut.id);

    const requirement = requirementById.get(cut.requirementId);
    const lot = lotById.get(cut.lotId);

    if (!requirement) {
      errors.push(`${cut.id}: kesim ihtiyacı bulunamadı.`);
    }
    if (!lot) {
      errors.push(`${cut.id}: top/lot bulunamadı.`);
    }
    if (!isPositive(cut.lengthMeters)) {
      errors.push(`${cut.id}: kesim uzunluğu sıfırdan büyük olmalıdır.`);
    }
    if (lot?.isBlocked) {
      errors.push(`${cut.id}: bloke top/lot kullanılamaz.`);
    }
    if (requirement && lot && requirement.stockItemId !== lot.stockItemId) {
      errors.push(`${cut.id}: ürün ile top/lot eşleşmiyor.`);
    }
  });

  const lotResults = input.lots.map((lot) => {
    const availableBeforeMeters = getAvailableLotMeters(lot);
    const plannedCutMeters = roundMeters(
      input.cuts
        .filter((cut) => cut.lotId === lot.id)
        .reduce((total, cut) => total + cut.lengthMeters, 0)
    );
    const remainingAfterMeters = roundMeters(
      availableBeforeMeters - plannedCutMeters
    );

    if (remainingAfterMeters < -EPSILON) {
      errors.push(`${lot.id}: planlanan kesim kullanılabilir metreyi aşıyor.`);
    }

    return {
      lotId: lot.id,
      availableBeforeMeters,
      plannedCutMeters,
      remainingAfterMeters: Math.max(0, remainingAfterMeters),
    };
  });

  const requirementResults = input.requirements.map((requirement) => {
    const requirementCuts = input.cuts.filter(
      (cut) => cut.requirementId === requirement.id
    );
    const requiredMeters = roundMeters(
      requirement.pieceLengthMeters * requirement.pieceCount
    );
    const plannedMeters = roundMeters(
      requirementCuts.reduce((total, cut) => total + cut.lengthMeters, 0)
    );

    let isSatisfied: boolean;
    if (requirement.continuity === "SINGLE_PIECE_REQUIRED") {
      const sufficientPieces = requirementCuts.filter(
        (cut) => cut.lengthMeters + EPSILON >= requirement.pieceLengthMeters
      ).length;
      isSatisfied =
        requirementCuts.length === requirement.pieceCount &&
        sufficientPieces === requirement.pieceCount;

      if (!isSatisfied) {
        errors.push(
          `${requirement.id}: tek parça zorunluluğu ve parça adedi karşılanmadı.`
        );
      }
    } else {
      isSatisfied = plannedMeters + EPSILON >= requiredMeters;
      if (!isSatisfied) {
        errors.push(`${requirement.id}: gerekli toplam kesim metresi karşılanmadı.`);
      }
    }

    return {
      requirementId: requirement.id,
      requiredMeters,
      plannedMeters,
      planWasteMeters: roundMeters(Math.max(0, plannedMeters - requiredMeters)),
      isSatisfied,
    };
  });

  const requiredMeters = roundMeters(
    requirementResults.reduce(
      (total, requirement) => total + requirement.requiredMeters,
      0
    )
  );
  const plannedCutMeters = roundMeters(
    input.cuts.reduce((total, cut) => total + cut.lengthMeters, 0)
  );

  return {
    valid: errors.length === 0,
    requiredMeters,
    plannedCutMeters,
    planWasteMeters: roundMeters(
      requirementResults.reduce(
        (total, requirement) => total + requirement.planWasteMeters,
        0
      )
    ),
    lotResults,
    requirementResults,
    errors,
  };
}
