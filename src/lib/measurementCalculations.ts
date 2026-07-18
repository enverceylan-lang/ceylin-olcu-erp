export type SystemType = "SINGLE" | "DOUBLE";
export type ChainDirection = "LEFT" | "RIGHT";
export type VerticalOpeningType = "SINGLE" | "DOUBLE";

export type MechanicalProductType =
  | "STOR"
  | "ZEBRA"
  | "AHSAP_JALUZI"
  | "JALUZI"
  | "PICASSO";

export type TulleStyle =
  | "PLEATED"
  | "CROSSOVER"
  | "REGISTER";

export type PleatType =
  | "TIGHT"
  | "NORMAL"
  | "SPARSE"
  | "AMERICAN"
  | "CUSTOM";

export interface AreaCalculation {
  actualWidthCm: number;
  actualHeightCm: number;
  billingWidthCm: number;
  billingHeightCm: number;
  quantity: number;
  unitM2: number;
  totalM2: number;
}

export interface PlicellCalculation extends AreaCalculation {
  systemType: SystemType;
  layerCount: number;
  minimumAreaApplied: boolean;
}

export interface MechanicalPart {
  id: string;
  groupType: "CAM_PENCERE" | "KAPI";
  actualWidthCm: number;
  actualHeightCm: number;
  billingWidthCm: number;
  billingHeightCm: number;
  unitM2: number;
  totalM2: number;
  chainDirection: ChainDirection;
}

export interface VerticalCurtainCalculation {
  measurementWidthCm: number;
  measurementHeightCm: number;
  salesM2: number;
  productionWidthCm: number;
  productionHeightCm: number;
  openingType: VerticalOpeningType;
}

export interface TulleCalculation {
  sourceWidthCm: number;
  pleatType: PleatType;
  pleatFactor: number;
  tulleStyle: TulleStyle;
  rawMeters: number;
  roundedMeters: number;
  manuallyOverridden: boolean;
}

export function roundUpTo10Cm(valueCm: number): number {
  if (!Number.isFinite(valueCm) || valueCm <= 0) return 0;
  return Math.ceil(valueCm / 10) * 10;
}

export function roundMetersUpTo10Cm(valueMeters: number): number {
  if (!Number.isFinite(valueMeters) || valueMeters <= 0) return 0;
  return Number((Math.ceil(valueMeters * 10) / 10).toFixed(2));
}

export function calculatePlicell(
  widthCm: number,
  heightCm: number,
  quantity = 1,
  systemType: SystemType = "SINGLE"
): PlicellCalculation {
  const safeQuantity = Math.max(1, Math.floor(quantity || 1));

  const billingWidthCm = roundUpTo10Cm(widthCm);
  const billingHeightCm = roundUpTo10Cm(heightCm);

  const rawUnitM2 =
    (billingWidthCm / 100) * (billingHeightCm / 100);

  const unitM2 = Number(Math.max(rawUnitM2, 1).toFixed(2));
  const layerCount = systemType === "DOUBLE" ? 2 : 1;

  return {
    actualWidthCm: widthCm,
    actualHeightCm: heightCm,
    billingWidthCm,
    billingHeightCm,
    quantity: safeQuantity,
    unitM2,
    totalM2: Number(
      (unitM2 * safeQuantity * layerCount).toFixed(2)
    ),
    systemType,
    layerCount,
    minimumAreaApplied: rawUnitM2 < 1
  };
}

export function calculateMechanicalCurtain(
  widthCm: number,
  heightCm: number,
  quantity = 1
): AreaCalculation {
  const safeQuantity = Math.max(1, Math.floor(quantity || 1));

  const billingWidthCm =
    widthCm < 100
      ? 100
      : roundUpTo10Cm(widthCm);

  const billingHeightCm =
    heightCm < 200
      ? 200
      : roundUpTo10Cm(heightCm);

  const unitM2 = Number(
    (
      (billingWidthCm / 100) *
      (billingHeightCm / 100)
    ).toFixed(2)
  );

  return {
    actualWidthCm: widthCm,
    actualHeightCm: heightCm,
    billingWidthCm,
    billingHeightCm,
    quantity: safeQuantity,
    unitM2,
    totalM2: Number((unitM2 * safeQuantity).toFixed(2))
  };
}

export function calculateMechanicalSystem(
  widthCm: number,
  heightCm: number,
  quantity = 1,
  systemType: SystemType = "SINGLE"
) {
  const base = calculateMechanicalCurtain(
    widthCm,
    heightCm,
    quantity
  );

  const layerCount = systemType === "DOUBLE" ? 2 : 1;

  return {
    ...base,
    systemType,
    layerCount,
    totalSystemM2: Number(
      (base.totalM2 * layerCount).toFixed(2)
    )
  };
}

export function calculateVerticalCurtain(
  widthCm: number,
  heightCm: number,
  openingType: VerticalOpeningType = "SINGLE"
): VerticalCurtainCalculation {
  const salesM2 = Number(
    ((widthCm / 100) * (heightCm / 100)).toFixed(2)
  );

  return {
    measurementWidthCm: widthCm,
    measurementHeightCm: heightCm,
    salesM2,

    // YalnÄ±z Ã¼retim ve sipariÅŸ Ã§Ä±ktÄ±larÄ±nda kullanÄ±lÄ±r.
    productionWidthCm: Math.max(0, widthCm - 10),
    productionHeightCm: heightCm,

    openingType
  };
}

export function calculateDetailMechanicalHeight(
  rawValues: Record<string, unknown>,
  fallbackHeightCm = 0
): number {
  const marbleHeight = Number(
    rawValues.kaloriferMermerBoyuCm || 0
  );

  if (marbleHeight > 0) {
    return marbleHeight;
  }

  const glassTop = Number(rawValues.camUstuCm || 0);
  const glassInside = Number(rawValues.camIciCm || 0);
  const glassBottom = Number(rawValues.camAltiCm || 0);

  if (glassTop > 0 || glassInside > 0 || glassBottom > 0) {
    return glassTop + glassInside + glassBottom;
  }

  return Number(fallbackHeightCm || 0);
}

function normalizeSegmentType(type: string):
  | "WALL"
  | "GLASS"
  | "WINDOW"
  | "DOOR"
  | "OTHER" {
  const value = String(type || "").toUpperCase();

  if (value === "WALL" || value === "D") return "WALL";
  if (value === "GLASS" || value === "C") return "GLASS";
  if (value === "WINDOW" || value === "P") return "WINDOW";
  if (value === "DOOR" || value === "K") return "DOOR";

  return "OTHER";
}

function getWallAllowance(widthCm: number): number {
  if (widthCm <= 0) return 0;

  // Duvar 10 cm'den kÃ¼Ã§Ã¼kse gerÃ§ek duvar kadar pay verilir.
  return Math.min(widthCm, 10);
}

export function createMechanicalPartsFromFacade(
  segments: Array<{
    id?: string;
    type: string;
    widthCm: number;
  }>,
  heightCm: number
): MechanicalPart[] {
  const MAX_MECHANICAL_WIDTH_CM = 270;

  interface RawPart {
    groupType: "CAM_PENCERE" | "KAPI";
    firstIndex: number;
    lastIndex: number;
    baseWidthCm: number;
  }

  const rawParts: RawPart[] = [];

  function getAdjacentWallAllowance(index: number): number {
    const segment = segments[index];

    if (
      !segment ||
      normalizeSegmentType(segment.type) !== "WALL"
    ) {
      return 0;
    }

    return getWallAllowance(Number(segment.widthCm || 0));
  }

  function addDoorPart(index: number): void {
    const widthCm = Number(segments[index]?.widthCm || 0);

    if (widthCm <= 0) return;

    rawParts.push({
      groupType: "KAPI",
      firstIndex: index,
      lastIndex: index,
      baseWidthCm: widthCm
    });
  }

  function splitWindowRun(
    runStartIndex: number,
    runEndIndex: number
  ): void {
    const leftOuterAllowance =
      getAdjacentWallAllowance(runStartIndex - 1);

    const rightOuterAllowance =
      getAdjacentWallAllowance(runEndIndex + 1);

    let currentStart = runStartIndex;
    let currentWidth = 0;

    const pushCurrentPart = (
      lastIndex: number
    ): void => {
      if (currentWidth <= 0) return;

      rawParts.push({
        groupType: "CAM_PENCERE",
        firstIndex: currentStart,
        lastIndex,
        baseWidthCm: currentWidth
      });
    };

    for (
      let index = runStartIndex;
      index <= runEndIndex;
      index++
    ) {
      const segmentWidth =
        Number(segments[index]?.widthCm || 0);

      if (segmentWidth <= 0) continue;

      const partStartsAtRunStart =
        currentStart === runStartIndex;

      const segmentEndsRun =
        index === runEndIndex;

      const projectedActualWidth =
        currentWidth +
        segmentWidth +
        (
          partStartsAtRunStart
            ? leftOuterAllowance
            : 0
        ) +
        (
          segmentEndsRun
            ? rightOuterAllowance
            : 0
        );

      /*
       * Yeni segment mevcut parçaya eklendiğinde
       * gerçek mekanik en 270 cm'yi aşacaksa,
       * önceki segment sınırından parçayı bitir.
       */
      if (
        currentWidth > 0 &&
        projectedActualWidth >
          MAX_MECHANICAL_WIDTH_CM
      ) {
        pushCurrentPart(index - 1);

        currentStart = index;
        currentWidth = segmentWidth;
      } else {
        currentWidth += segmentWidth;
      }
    }

    pushCurrentPart(runEndIndex);
  }
  let index = 0;

  while (index < segments.length) {
    const segmentType =
      normalizeSegmentType(segments[index]?.type);

    if (
      segmentType === "GLASS" ||
      segmentType === "WINDOW"
    ) {
      const runStartIndex = index;

      while (
        index + 1 < segments.length &&
        (
          normalizeSegmentType(
            segments[index + 1]?.type
          ) === "GLASS" ||
          normalizeSegmentType(
            segments[index + 1]?.type
          ) === "WINDOW"
        )
      ) {
        index++;
      }

      splitWindowRun(runStartIndex, index);
    } else if (segmentType === "DOOR") {
      /*
       * Her kapı ayrı mekanik perde parçasıdır.
       * Kapı, pencere grubuyla birleştirilmez.
       */
      addDoorPart(index);
    }

    index++;
  }

  const parts = rawParts.map((part, partIndex) => {
    const leftSegment = segments[part.firstIndex - 1];
    const rightSegment = segments[part.lastIndex + 1];

    const leftType = leftSegment
      ? normalizeSegmentType(leftSegment.type)
      : "OTHER";

    const rightType = rightSegment
      ? normalizeSegmentType(rightSegment.type)
      : "OTHER";

    /*
     * Yalnız gerçek duvar bulunan tarafa pay verilir.
     *
     * Cam-kapı birleşiminde pay verilmez.
     * İki mekanik perde parçasının birleşiminde de
     * orta tarafa pay verilmez.
     */
    const leftAllowance =
      leftType === "WALL"
        ? getWallAllowance(
            Number(leftSegment.widthCm || 0)
          )
        : 0;

    const rightAllowance =
      rightType === "WALL"
        ? getWallAllowance(
            Number(rightSegment.widthCm || 0)
          )
        : 0;

    const actualWidthCm =
      part.baseWidthCm +
      leftAllowance +
      rightAllowance;

    const calculation = calculateMechanicalCurtain(
      actualWidthCm,
      heightCm,
      1
    );

    return {
      id: `mechanical-part-${partIndex + 1}`,
      groupType: part.groupType,
      actualWidthCm,
      actualHeightCm: heightCm,
      billingWidthCm: calculation.billingWidthCm,
      billingHeightCm: calculation.billingHeightCm,
      unitM2: calculation.unitM2,
      totalM2: calculation.totalM2,
      chainDirection: "RIGHT" as ChainDirection
    };
  });

  return parts.map((part, partIndex) => {
    if (parts.length === 1) {
      return {
        ...part,
        chainDirection: "RIGHT" as ChainDirection
      };
    }

    /*
     * Yan yana iki mekanik perdede zincirler
     * orta birleşime değil dış kenarlara gelir.
     */
    if (partIndex === 0) {
      return {
        ...part,
        chainDirection: "LEFT" as ChainDirection
      };
    }

    if (partIndex === parts.length - 1) {
      return {
        ...part,
        chainDirection: "RIGHT" as ChainDirection
      };
    }

    return {
      ...part,
      chainDirection: "RIGHT" as ChainDirection
    };
  });
}
export function getPleatFactor(
  pleatType: PleatType,
  customFactor?: number
): number {
  if (pleatType === "TIGHT") return 3.1;
  if (pleatType === "NORMAL") return 2.6;
  if (pleatType === "SPARSE") return 2.1;
  if (pleatType === "AMERICAN") return 3.1;

  if (
    pleatType === "CUSTOM" &&
    Number.isFinite(customFactor) &&
    Number(customFactor) > 0
  ) {
    return Number(customFactor);
  }

  return 3.1;
}

export function calculateTulleQuantity(
  sourceWidthCm: number,
  tulleStyle: TulleStyle = "PLEATED",
  pleatType: PleatType = "TIGHT",
  customFactor?: number,
  manualMeters?: number
): TulleCalculation {
  const sourceWidthMeters = sourceWidthCm / 100;

  let pleatFactor = getPleatFactor(
    pleatType,
    customFactor
  );

  let rawMeters = 0;

  if (tulleStyle === "REGISTER") {
    pleatFactor = 3.65;
    rawMeters = sourceWidthMeters * 3.65;
  } else {
    rawMeters = sourceWidthMeters * pleatFactor;

    if (tulleStyle === "CROSSOVER") {
      rawMeters += 1;
    }
  }

  /*
   * Kumaş metrajını 10 cm, yani 0.10 metre yukarı tamamla.
   *
   * 14.24  -> 14.30
   * 17.95  -> 18.00
   * 17.955 -> 18.00
   *
   * Number.EPSILON, tam 10 cm katlarının kayan nokta
   * hassasiyeti yüzünden gereksiz yere bir üst değere
   * çıkmasını önler.
   */
  const automaticRoundedMeters =
    Number(
      (
        Math.ceil(
          (rawMeters - Number.EPSILON) * 10
        ) / 10
      ).toFixed(2)
    );

  const hasManualOverride =
    Number.isFinite(manualMeters) &&
    Number(manualMeters) > 0;

  return {
    sourceWidthCm,
    pleatType,
    pleatFactor,
    tulleStyle,
    rawMeters: Number(rawMeters.toFixed(3)),
    roundedMeters: hasManualOverride
      ? Number(Number(manualMeters).toFixed(2))
      : automaticRoundedMeters,
    manuallyOverridden: hasManualOverride
  };
}

export function calculateSunshadeQuantity(
  sourceWidthCm: number,
  manualMeters?: number
) {
  const rawWidthCm = sourceWidthCm + 30;
  const roundedWidthCm = roundUpTo10Cm(rawWidthCm);

  const hasManualOverride =
    Number.isFinite(manualMeters) &&
    Number(manualMeters) > 0;

  return {
    sourceWidthCm,
    allowanceCm: 30,
    rawWidthCm,
    roundedWidthCm,
    meters: hasManualOverride
      ? Number(Number(manualMeters).toFixed(2))
      : Number((roundedWidthCm / 100).toFixed(2)),
    manuallyOverridden: hasManualOverride
  };
}

export function calculateCurtainCutHeight(
  measuredHeightCm: number,
  productType: "TUL" | "GUNESLIK" | "FON"
): number {
  if (productType === "TUL") {
    return Math.max(0, measuredHeightCm - 5);
  }

  if (productType === "GUNESLIK") {
    return Math.max(0, measuredHeightCm - 7);
  }

  return Math.max(0, measuredHeightCm - 4);
}
