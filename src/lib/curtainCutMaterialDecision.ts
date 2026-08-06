export type CurtainPleatClass =
  | "SPARSE"
  | "NORMAL"
  | "TIGHT";

export interface CurtainPleatRatios {
  SPARSE: number;
  NORMAL: number;
  TIGHT: number;
}

export const DEFAULT_CURTAIN_PLEAT_RATIOS:
  CurtainPleatRatios = {
    SPARSE: 2.1,
    NORMAL: 2.6,
    TIGHT: 3.1
  };

export interface CurtainCutMaterialDecisionInput {
  selectedPleat: CurtainPleatClass;

  /**
   * Merkezi hesap motorunun verdiği gerçek ihtiyaç.
   * Örn: 300 cm normal pile işi için sistem 8.40 m hesapladıysa
   * burada 8.40 kullanılır; tekrar width * ratio yapıp merkezi hesabı bozmayız.
   */
  requiredMeters: number;

  /**
   * İlgili top/lot üzerinde gerçekten kullanılabilir metre.
   */
  availableMeters: number;

  /**
   * Kesim sonrası bu miktardan küçük artıklar ayrı lot olarak tutulmayacak.
   * Ürün / stok grubu politikası tarafından verilir; motor sabit değer dayatmaz.
   */
  minimumReusableRemnantMeters: number;

  /**
   * Pile katsayıları ileride ürün/şirket ayarından gelebilir.
   */
  ratios?: CurtainPleatRatios;
}

export type CurtainCutMaterialDecisionStatus =
  | "EXACT_OR_MORE_AVAILABLE"
  | "USE_WHOLE_LOT"
  | "ACCEPT_WITH_USER_APPROVAL"
  | "SUPPLY_REQUIRED"
  | "INVALID";

export interface CurtainCutMaterialDecision {
  status: CurtainCutMaterialDecisionStatus;

  selectedPleat: CurtainPleatClass;
  selectedPleatRatio: number;

  requiredMeters: number;
  availableMeters: number;

  /**
   * Mevcut metrenin, merkezi hesap motorunun hedef metresine oranından
   * türetilmiş efektif pile katsayısı.
   *
   * effective = selectedRatio * available / required
   *
   * Böylece merkezi hesapta kenar/üretim payı varsa da pile kıyaslaması
   * doğru oransal zeminde kalır.
   */
  effectivePleatRatio: number;

  lowerAcceptanceBoundary: number;

  plannedProductionMeters: number;
  remnantMeters: number;
  inventoryRemainderMeters: number;
  wasteMeters: number;

  requiresUserApproval: boolean;
  shouldCreateSupplierOrder: boolean;

  reason:
    | "ENOUGH_USE_REQUIRED"
    | "SMALL_REMNANT_ABSORB_INTO_PRODUCTION"
    | "PLEAT_WITHIN_ACCEPTABLE_BAND"
    | "PLEAT_FELL_BELOW_SELECTED_CLASS"
    | "INVALID_INPUT";
}

const EPSILON = 0.000001;

function roundMeters(value: number): number {
  return Math.round(value * 1_000_000) /
    1_000_000;
}

function midpoint(left: number, right: number): number {
  return (left + right) / 2;
}

function validateRatios(
  ratios: CurtainPleatRatios
): boolean {
  return (
    Number.isFinite(ratios.SPARSE) &&
    Number.isFinite(ratios.NORMAL) &&
    Number.isFinite(ratios.TIGHT) &&
    ratios.SPARSE > 0 &&
    ratios.SPARSE < ratios.NORMAL &&
    ratios.NORMAL < ratios.TIGHT
  );
}

export function getCurtainPleatLowerBoundary(
  selected: CurtainPleatClass,
  ratios: CurtainPleatRatios =
    DEFAULT_CURTAIN_PLEAT_RATIOS
): number {
  if (selected === "TIGHT") {
    return midpoint(
      ratios.NORMAL,
      ratios.TIGHT
    );
  }

  if (selected === "NORMAL") {
    return midpoint(
      ratios.SPARSE,
      ratios.NORMAL
    );
  }

  return ratios.SPARSE;
}

export function decideCurtainCutMaterial(
  input: CurtainCutMaterialDecisionInput
): CurtainCutMaterialDecision {
  const ratios =
    input.ratios ??
    DEFAULT_CURTAIN_PLEAT_RATIOS;

  const selectedRatio =
    ratios[input.selectedPleat];

  const invalid =
    !validateRatios(ratios) ||
    !Number.isFinite(input.requiredMeters) ||
    input.requiredMeters <= 0 ||
    !Number.isFinite(input.availableMeters) ||
    input.availableMeters < 0 ||
    !Number.isFinite(
      input.minimumReusableRemnantMeters
    ) ||
    input.minimumReusableRemnantMeters < 0;

  if (invalid) {
    return {
      status: "INVALID",
      selectedPleat: input.selectedPleat,
      selectedPleatRatio:
        Number.isFinite(selectedRatio)
          ? selectedRatio
          : 0,
      requiredMeters:
        input.requiredMeters,
      availableMeters:
        input.availableMeters,
      effectivePleatRatio: 0,
      lowerAcceptanceBoundary: 0,
      plannedProductionMeters: 0,
      remnantMeters: 0,
      inventoryRemainderMeters: 0,
      wasteMeters: 0,
      requiresUserApproval: false,
      shouldCreateSupplierOrder: false,
      reason: "INVALID_INPUT"
    };
  }

  const effectivePleatRatio =
    roundMeters(
      selectedRatio *
        input.availableMeters /
        input.requiredMeters
    );

  const lowerAcceptanceBoundary =
    getCurtainPleatLowerBoundary(
      input.selectedPleat,
      ratios
    );

  if (
    input.availableMeters + EPSILON >=
    input.requiredMeters
  ) {
    const remnant =
      roundMeters(
        input.availableMeters -
        input.requiredMeters
      );

    if (
      remnant > EPSILON &&
      remnant + EPSILON <
        input.minimumReusableRemnantMeters
    ) {
      return {
        status: "USE_WHOLE_LOT",
        selectedPleat:
          input.selectedPleat,
        selectedPleatRatio:
          selectedRatio,
        requiredMeters:
          input.requiredMeters,
        availableMeters:
          input.availableMeters,
        effectivePleatRatio,
        lowerAcceptanceBoundary,
        plannedProductionMeters:
          input.availableMeters,
        remnantMeters: remnant,
        inventoryRemainderMeters: 0,
        wasteMeters: 0,
        requiresUserApproval: false,
        shouldCreateSupplierOrder: false,
        reason:
          "SMALL_REMNANT_ABSORB_INTO_PRODUCTION"
      };
    }

    return {
      status: "EXACT_OR_MORE_AVAILABLE",
      selectedPleat:
        input.selectedPleat,
      selectedPleatRatio:
        selectedRatio,
      requiredMeters:
        input.requiredMeters,
      availableMeters:
        input.availableMeters,
      effectivePleatRatio,
      lowerAcceptanceBoundary,
      plannedProductionMeters:
        input.requiredMeters,
      remnantMeters: remnant,
      inventoryRemainderMeters:
        remnant,
      wasteMeters: 0,
      requiresUserApproval: false,
      shouldCreateSupplierOrder: false,
      reason: "ENOUGH_USE_REQUIRED"
    };
  }

  if (
    effectivePleatRatio + EPSILON >=
    lowerAcceptanceBoundary
  ) {
    return {
      status:
        "ACCEPT_WITH_USER_APPROVAL",
      selectedPleat:
        input.selectedPleat,
      selectedPleatRatio:
        selectedRatio,
      requiredMeters:
        input.requiredMeters,
      availableMeters:
        input.availableMeters,
      effectivePleatRatio,
      lowerAcceptanceBoundary,
      plannedProductionMeters:
        input.availableMeters,
      remnantMeters: 0,
      inventoryRemainderMeters: 0,
      wasteMeters: 0,
      requiresUserApproval: true,
      shouldCreateSupplierOrder: false,
      reason:
        "PLEAT_WITHIN_ACCEPTABLE_BAND"
    };
  }

  return {
    status: "SUPPLY_REQUIRED",
    selectedPleat:
      input.selectedPleat,
    selectedPleatRatio:
      selectedRatio,
    requiredMeters:
      input.requiredMeters,
    availableMeters:
      input.availableMeters,
    effectivePleatRatio,
    lowerAcceptanceBoundary,
    plannedProductionMeters: 0,
    remnantMeters: 0,
    inventoryRemainderMeters:
      input.availableMeters,
    wasteMeters: 0,
    requiresUserApproval: false,
    shouldCreateSupplierOrder: true,
    reason:
      "PLEAT_FELL_BELOW_SELECTED_CLASS"
  };
}