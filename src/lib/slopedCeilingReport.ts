export interface SlopedCeilingProductionHeights {
  left: number;
  middle: number;
  right: number;
}

export interface SlopedCeilingReportPresentation {
  isVisible: boolean;
  warningTitle: string;
  productionHeightsCm?: SlopedCeilingProductionHeights;
  productionHeightText: string;
}

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as UnknownRecord;
  }

  return {};
}

function positiveNumber(value: unknown): number {
  const parsed = Number(value || 0);

  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : 0;
}

export function getSlopedCeilingReportPresentation(
  calculationValue: unknown
): SlopedCeilingReportPresentation {
  const calculation = asRecord(calculationValue);
  const warning = String(
    calculation.warning || ""
  )
    .trim()
    .toUpperCase();

  const profile = asRecord(
    calculation.productionHeightsCm
  );

  const left = positiveNumber(profile.left);
  const middle = positiveNumber(profile.middle);
  const right = positiveNumber(profile.right);

  const hasCompleteProfile =
    left > 0 &&
    middle > 0 &&
    right > 0;

  const isVisible =
    warning === "TAVAN YAMUK" &&
    hasCompleteProfile;

  if (!isVisible) {
    return {
      isVisible: false,
      warningTitle: "",
      productionHeightText: ""
    };
  }

  return {
    isVisible: true,
    warningTitle: "TAVAN YAMUK",
    productionHeightsCm: {
      left,
      middle,
      right
    },
    productionHeightText:
      `Sol Dikim: ${left} cm | ` +
      `Orta Dikim: ${middle} cm | ` +
      `Sağ Dikim: ${right} cm`
  };
}