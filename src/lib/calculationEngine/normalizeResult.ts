import type {
  CalculationEngineResult,
  CalculationGroup,
  CalculationSalesItem,
  CalculationUnit,
  CalculationWarning
} from './types';

import {
  CALCULATION_ENGINE_VERSION
} from './version';

function numberOrUndefined(
  value: unknown
): number | undefined {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : undefined;
}

function positiveNumberOrUndefined(
  value: unknown
): number | undefined {
  const parsed = numberOrUndefined(value);

  return parsed !== undefined && parsed > 0
    ? parsed
    : undefined;
}

function inferUnit(
  productType: string,
  legacy: Record<string, any>
): CalculationUnit {
  const norm = productType.toUpperCase();

  if (
    positiveNumberOrUndefined(
      legacy.fabricUsageMeters
    ) !== undefined ||
    positiveNumberOrUndefined(
      legacy.birizTulMeters
    ) !== undefined
  ) {
    return 'mt';
  }

  if (
    positiveNumberOrUndefined(
      legacy.totalM2
    ) !== undefined ||
    positiveNumberOrUndefined(
      legacy.unitM2
    ) !== undefined ||
    Array.isArray(legacy.groups)
  ) {
    return 'm2';
  }

  if (
    norm === 'RUSTIK' ||
    norm === 'TAVAN_RUSTIK' ||
    norm === 'BIRIZ'
  ) {
    return 'adet';
  }

  return 'adet';
}

function normalizeGroups(
  groups: unknown
): CalculationGroup[] | undefined {
  if (!Array.isArray(groups)) {
    return undefined;
  }

  return groups.map(
    (group: Record<string, any>, index: number) => ({
      ...group,

      id:
        group.id ||
        group.generatedItemId ||
        `group-${index + 1}`,

      label:
        group.label ||
        (
          group.groupType === 'KAPI'
            ? 'Kapı'
            : group.groupType === 'CAM_PENCERE'
              ? 'Cam / Pencere'
              : `Parça ${index + 1}`
        ),

      groupType:
        group.groupType,

      realWidthCm:
        numberOrUndefined(
          group.realWidthCm ??
          group.actualWidthCm
        ),

      realHeightCm:
        numberOrUndefined(
          group.realHeightCm ??
          group.actualHeightCm
        ),

      billingWidthCm:
        numberOrUndefined(
          group.billingWidthCm ??
          group.calculatedWidthCm
        ),

      billingHeightCm:
        numberOrUndefined(
          group.billingHeightCm ??
          group.calculatedHeightCm
        ),

      productionWidthCm:
        numberOrUndefined(
          group.productionWidthCm
        ),

      productionHeightCm:
        numberOrUndefined(
          group.productionHeightCm
        ),

      unitM2:
        numberOrUndefined(
          group.unitM2
        ),

      totalM2:
        numberOrUndefined(
          group.totalM2
        ),

      chainDirection:
        group.chainDirection === 'LEFT'
          ? 'LEFT'
          : 'RIGHT',

      firstSegmentIndex:
        numberOrUndefined(
          group.firstSegmentIndex
        ),

      lastSegmentIndex:
        numberOrUndefined(
          group.lastSegmentIndex
        )
    })
  );
}

function normalizeSalesItems(
  productType: string,
  legacy: Record<string, any>,
  defaultUnit: CalculationUnit
): CalculationSalesItem[] {
  const sourceItems =
    Array.isArray(legacy.salesItems) &&
    legacy.salesItems.length > 0
      ? legacy.salesItems
      : [
          {
            productType,
            label: productType,
            totalM2: legacy.totalM2,
            fabricMeters:
              legacy.fabricUsageMeters,
            quantity:
              legacy.quantity
          }
        ];

  return sourceItems.map(
    (
      item: Record<string, any>,
      index: number
    ) => {
      const fabricMeters =
        positiveNumberOrUndefined(
          item.fabricMeters ??
          item.fabricUsageMeters ??
          (
            defaultUnit === 'mt'
              ? legacy.fabricUsageMeters
              : undefined
          )
        );

      const totalM2 =
        positiveNumberOrUndefined(
          item.totalM2 ??
          (
            defaultUnit === 'm2'
              ? legacy.totalM2
              : undefined
          )
        );

      const unit: CalculationUnit =
        fabricMeters !== undefined
          ? 'mt'
          : totalM2 !== undefined
            ? 'm2'
            : defaultUnit;

      const quantity =
        unit === 'mt'
          ? fabricMeters || 0
          : unit === 'm2'
            ? totalM2 || 0
            : Math.max(
                1,
                Number(
                  item.quantity ||
                  legacy.quantity ||
                  1
                )
              );

      return {
        ...item,

        id:
          item.id ||
          `${productType}-${index + 1}`,

        productType:
          String(
            item.productType ||
            productType
          ).toUpperCase(),

        label:
          String(
            item.label ||
            item.productType ||
            productType
          ),

        unit,
        quantity,

        unitM2:
          numberOrUndefined(
            item.unitM2 ??
            legacy.unitM2
          ),

        totalM2,

        fabricMeters,

        realWidthCm:
          numberOrUndefined(
            item.realWidthCm ??
            legacy.realWidthCm ??
            legacy.actualWidthCm
          ),

        realHeightCm:
          numberOrUndefined(
            item.realHeightCm ??
            legacy.realHeightCm ??
            legacy.actualHeightCm
          ),

        billingWidthCm:
          numberOrUndefined(
            item.billingWidthCm ??
            legacy.billingWidthCm ??
            legacy.billingWidth
          ),

        billingHeightCm:
          numberOrUndefined(
            item.billingHeightCm ??
            legacy.billingHeightCm ??
            legacy.billingHeight
          ),

        productionWidthCm:
          numberOrUndefined(
            item.productionWidthCm ??
            legacy.productionWidthCm ??
            legacy.productionWidth
          ),

        productionHeightCm:
          numberOrUndefined(
            item.productionHeightCm ??
            legacy.productionHeightCm ??
            legacy.productionHeight
          ),

        layerIndex:
          numberOrUndefined(
            item.layerIndex
          ) || index + 1,

        systemType:
          legacy.systemType === 'DOUBLE'
            ? 'DOUBLE'
            : 'SINGLE'
      };
    }
  );
}

function normalizeWarnings(
  legacy: Record<string, any>
): CalculationWarning[] {
  const warnings: CalculationWarning[] = [];

  const warningText =
    String(
      legacy.warning ||
      ''
    ).trim();

  if (warningText) {
    warnings.push({
      code: 'LEGACY_WARNING',
      message: warningText,
      severity: 'WARNING'
    });
  }

  if (
    legacy.minimumAreaApplied === true
  ) {
    warnings.push({
      code: 'MINIMUM_AREA_APPLIED',
      message:
        'Minimum faturalandırma alanı uygulandı.',
      severity: 'INFO'
    });
  }

  return warnings;
}

export function normalizeCalculationResult(
  productType: string,
  legacyCalculation: Record<string, any>
): Record<string, any> & CalculationEngineResult {
  const norm =
    String(productType || '')
      .toUpperCase();

  const unit =
    inferUnit(
      norm,
      legacyCalculation
    );

  const groups =
    normalizeGroups(
      legacyCalculation.groups
    );

  const salesItems =
    normalizeSalesItems(
      norm,
      legacyCalculation,
      unit
    );

  const normalized: CalculationEngineResult = {
    calculationVersion:
      CALCULATION_ENGINE_VERSION,

    productType: norm,
    unit,

    quantity:
      Math.max(
        1,
        Number(
          legacyCalculation.quantity ||
          1
        )
      ),

    realWidthCm:
      numberOrUndefined(
        legacyCalculation.realWidthCm ??
        legacyCalculation.actualWidthCm
      ),

    realHeightCm:
      numberOrUndefined(
        legacyCalculation.realHeightCm ??
        legacyCalculation.actualHeightCm
      ),

    billingWidthCm:
      numberOrUndefined(
        legacyCalculation.billingWidthCm ??
        legacyCalculation.billingWidth
      ),

    billingHeightCm:
      numberOrUndefined(
        legacyCalculation.billingHeightCm ??
        legacyCalculation.billingHeight
      ),

    productionWidthCm:
      numberOrUndefined(
        legacyCalculation.productionWidthCm ??
        legacyCalculation.productionWidth
      ),

    productionHeightCm:
      numberOrUndefined(
        legacyCalculation.productionHeightCm ??
        legacyCalculation.productionHeight
      ),

    unitM2:
      numberOrUndefined(
        legacyCalculation.unitM2
      ),

    totalM2:
      numberOrUndefined(
        legacyCalculation.totalSystemM2 ??
        legacyCalculation.totalM2
      ),

    fabricMeters:
      numberOrUndefined(
        legacyCalculation.fabricUsageMeters
      ),

    groups,
    salesItems,

    warnings:
      normalizeWarnings(
        legacyCalculation
      ),

    description:
      legacyCalculation.description,

    legacyCalculation
  };

  /*
   * Geçiş sürecinde eski alanlar korunur.
   * Yeni standart alanlar ayrıca aynı nesneye eklenir.
   */
  return {
    ...legacyCalculation,
    ...normalized
  };
}