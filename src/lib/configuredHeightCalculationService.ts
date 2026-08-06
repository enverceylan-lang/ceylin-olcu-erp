import {
  resolveConfiguredProductHeight
} from "@/lib/measurementAdapter";
import {
  calculateCurtainCutHeight,
  calculateMechanicalCurtain,
  calculateVerticalCurtain
} from "@/lib/measurementCalculations";

type UnknownRecord =
  Record<string, unknown>;

const MECHANICAL_AREA_TYPES =
  new Set([
    "STOR",
    "ZEBRA",
    "AHSAP_JALUZI",
    "JALUZI",
    "PICASSO"
  ]);

const VERTICAL_TYPES =
  new Set([
    "DIKEY_STOR",
    "DIKEY_TUL"
  ]);

const TEXTILE_HEIGHT_TYPES =
  new Set([
    "TUL",
    "GUNESLIK",
    "FON"
  ]);

function asRecord(
  value: unknown
): UnknownRecord {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  )
    ? value as UnknownRecord
    : {};
}

function positiveNumber(
  value: unknown
): number {
  const parsed = Number(value);

  return (
    Number.isFinite(parsed) &&
    parsed > 0
  )
    ? parsed
    : 0;
}

function groupPartKey(
  productType: string,
  group: UnknownRecord,
  index: number
): string {
  return String(
    group.generatedItemId ||
    group.id ||
    `${productType}-${index}`
  );
}

function groupRealWidth(
  group: UnknownRecord
): number {
  return (
    positiveNumber(
      group.realWidthCm
    ) ||
    positiveNumber(
      group.actualWidthCm
    ) ||
    positiveNumber(
      group.calculatedWidthCm
    ) ||
    positiveNumber(
      group.billingWidthCm
    )
  );
}

function groupFallbackHeight(
  calculation: UnknownRecord,
  group: UnknownRecord
): number {
  return (
    positiveNumber(
      group.realHeightCm
    ) ||
    positiveNumber(
      group.actualHeightCm
    ) ||
    positiveNumber(
      group.productionHeightCm
    ) ||
    positiveNumber(
      group.calculatedHeightCm
    ) ||
    positiveNumber(
      group.billingHeightCm
    ) ||
    positiveNumber(
      calculation.realHeightCm
    ) ||
    positiveNumber(
      calculation.actualHeightCm
    ) ||
    positiveNumber(
      calculation.productionHeightCm
    ) ||
    positiveNumber(
      calculation.calculatedHeightCm
    ) ||
    positiveNumber(
      calculation.billingHeightCm
    )
  );
}

function updateMechanicalSalesItems(
  productType: string,
  previous: unknown,
  groups: UnknownRecord[]
): UnknownRecord[] {
  const previousItems =
    Array.isArray(previous)
      ? previous.map(asRecord)
      : [];

  return groups.map(
    (group, index) => {
      const old =
        previousItems[index] || {};

      return {
        ...old,
        id:
          String(
            old.id ||
            group.generatedItemId ||
            group.id ||
            `${productType}-part-${index + 1}`
          ),
        productType,
        label:
          String(
            old.label ||
            (
              group.groupType === "KAPI"
                ? `${productType} Kapı`
                : `${productType} Cam/Pencere`
            )
          ),
        unit: "m2",
        quantity:
          positiveNumber(
            group.totalM2
          ),
        unitM2:
          positiveNumber(
            group.unitM2
          ),
        totalM2:
          positiveNumber(
            group.totalM2
          ),
        realWidthCm:
          positiveNumber(
            group.realWidthCm
          ),
        realHeightCm:
          positiveNumber(
            group.realHeightCm
          ),
        billingWidthCm:
          positiveNumber(
            group.billingWidthCm ??
            group.calculatedWidthCm
          ),
        billingHeightCm:
          positiveNumber(
            group.billingHeightCm ??
            group.calculatedHeightCm
          ),
        productionWidthCm:
          positiveNumber(
            group.productionWidthCm ??
            group.realWidthCm
          ),
        productionHeightCm:
          positiveNumber(
            group.productionHeightCm ??
            group.realHeightCm
          )
      };
    }
  );
}

function recalculateSegmentedMechanical(
  productType: string,
  rawValues: UnknownRecord,
  overrides: UnknownRecord,
  calculation: UnknownRecord
): UnknownRecord {
  const sourceGroups =
    Array.isArray(calculation.groups)
      ? calculation.groups.map(asRecord)
      : [];

  if (sourceGroups.length === 0) {
    return calculation;
  }

  const configuredValues = {
    ...rawValues,
    ...overrides,
    partHeightOverrides:
      asRecord(
        overrides.partHeightOverrides
      )
  };

  const groups =
    sourceGroups.map(
      (group, index) => {
        const width =
          groupRealWidth(group);

        const fallbackHeight =
          groupFallbackHeight(
            calculation,
            group
          );

        const height =
          resolveConfiguredProductHeight(
            configuredValues,
            fallbackHeight,
            groupPartKey(
              productType,
              group,
              index
            )
          );

        if (
          width <= 0 ||
          height <= 0
        ) {
          return group;
        }

        const quantity =
          Math.max(
            1,
            positiveNumber(
              group.quantity
            ) || 1
          );

        const area =
          calculateMechanicalCurtain(
            width,
            height,
            quantity
          );

        return {
          ...group,
          realWidthCm:
            area.actualWidthCm,
          actualWidthCm:
            area.actualWidthCm,
          realHeightCm:
            area.actualHeightCm,
          actualHeightCm:
            area.actualHeightCm,

          calculatedWidthCm:
            area.billingWidthCm,
          calculatedHeightCm:
            area.billingHeightCm,
          billingWidthCm:
            area.billingWidthCm,
          billingHeightCm:
            area.billingHeightCm,

          productionWidthCm:
            area.actualWidthCm,
          productionHeightCm:
            area.actualHeightCm,

          quantity,
          unitM2:
            area.unitM2,
          totalM2:
            area.totalM2
        };
      }
    );

  const totalM2 =
    Number(
      groups
        .reduce(
          (sum, group) =>
            sum +
            positiveNumber(
              group.totalM2
            ),
          0
        )
        .toFixed(2)
    );

  const maxRealHeight =
    Math.max(
      0,
      ...groups.map(
        group =>
          positiveNumber(
            group.realHeightCm
          )
      )
    );

  const maxBillingHeight =
    Math.max(
      0,
      ...groups.map(
        group =>
          positiveNumber(
            group.billingHeightCm ??
            group.calculatedHeightCm
          )
      )
    );

  return {
    ...calculation,
    groups,
    realHeightCm:
      maxRealHeight ||
      calculation.realHeightCm,
    actualHeightCm:
      maxRealHeight ||
      calculation.actualHeightCm,
    billingHeightCm:
      maxBillingHeight ||
      calculation.billingHeightCm,
    calculatedHeightCm:
      maxBillingHeight ||
      calculation.calculatedHeightCm,
    productionHeightCm:
      maxRealHeight ||
      calculation.productionHeightCm,
    totalM2,
    salesItems:
      updateMechanicalSalesItems(
        productType,
        calculation.salesItems,
        groups
      )
  };
}

function recalculateSingleMechanical(
  productType: string,
  rawValues: UnknownRecord,
  overrides: UnknownRecord,
  calculation: UnknownRecord
): UnknownRecord {
  const configuredValues = {
    ...rawValues,
    ...overrides
  };

  const width =
    positiveNumber(
      calculation.realWidthCm
    ) ||
    positiveNumber(
      calculation.actualWidthCm
    ) ||
    positiveNumber(
      calculation.calculatedWidthCm
    ) ||
    positiveNumber(
      calculation.billingWidthCm
    );

  const fallbackHeight =
    groupFallbackHeight(
      calculation,
      {}
    );

  const height =
    resolveConfiguredProductHeight(
      configuredValues,
      fallbackHeight
    );

  if (
    width <= 0 ||
    height <= 0
  ) {
    return calculation;
  }

  const quantity =
    Math.max(
      1,
      positiveNumber(
        calculation.quantity
      ) || 1
    );

  const area =
    calculateMechanicalCurtain(
      width,
      height,
      quantity
    );

  const salesItems =
    updateMechanicalSalesItems(
      productType,
      calculation.salesItems,
      [
        {
          id:
            `${productType}-main`,
          groupType:
            "CAM_PENCERE",
          realWidthCm:
            area.actualWidthCm,
          realHeightCm:
            area.actualHeightCm,
          billingWidthCm:
            area.billingWidthCm,
          billingHeightCm:
            area.billingHeightCm,
          productionWidthCm:
            area.actualWidthCm,
          productionHeightCm:
            area.actualHeightCm,
          quantity,
          unitM2:
            area.unitM2,
          totalM2:
            area.totalM2
        }
      ]
    );

  return {
    ...calculation,
    realWidthCm:
      area.actualWidthCm,
    actualWidthCm:
      area.actualWidthCm,
    realHeightCm:
      area.actualHeightCm,
    actualHeightCm:
      area.actualHeightCm,

    billingWidthCm:
      area.billingWidthCm,
    calculatedWidthCm:
      area.billingWidthCm,
    billingHeightCm:
      area.billingHeightCm,
    calculatedHeightCm:
      area.billingHeightCm,

    productionWidthCm:
      area.actualWidthCm,
    productionHeightCm:
      area.actualHeightCm,

    quantity,
    unitM2:
      area.unitM2,
    totalM2:
      area.totalM2,
    salesItems
  };
}

function recalculateVertical(
  rawValues: UnknownRecord,
  overrides: UnknownRecord,
  calculation: UnknownRecord
): UnknownRecord {
  const configuredValues = {
    ...rawValues,
    ...overrides
  };

  const width =
    positiveNumber(
      calculation.realWidthCm
    ) ||
    positiveNumber(
      calculation.measurementWidthCm
    ) ||
    positiveNumber(
      calculation.actualWidthCm
    );

  const fallbackHeight =
    positiveNumber(
      calculation.realHeightCm
    ) ||
    positiveNumber(
      calculation.measurementHeightCm
    ) ||
    positiveNumber(
      calculation.actualHeightCm
    );

  const height =
    resolveConfiguredProductHeight(
      configuredValues,
      fallbackHeight
    );

  if (
    width <= 0 ||
    height <= 0
  ) {
    return calculation;
  }

  const vertical =
    calculateVerticalCurtain(
      width,
      height,
      String(
        calculation.openingType ||
        overrides.openingType ||
        "SINGLE"
      ) === "DOUBLE"
        ? "DOUBLE"
        : "SINGLE"
    );

  const salesM2 =
    vertical.salesM2;

  const previousItems =
    Array.isArray(
      calculation.salesItems
    )
      ? calculation.salesItems.map(
          asRecord
        )
      : [];

  const first = previousItems[0] || {};

  return {
    ...calculation,
    realWidthCm:
      vertical.measurementWidthCm,
    actualWidthCm:
      vertical.measurementWidthCm,
    realHeightCm:
      vertical.measurementHeightCm,
    actualHeightCm:
      vertical.measurementHeightCm,
    productionWidthCm:
      vertical.productionWidthCm,
    productionHeightCm:
      vertical.productionHeightCm,
    unitM2:
      salesM2,
    totalM2:
      salesM2,
    salesItems: [
      {
        ...first,
        unit: "m2",
        quantity: salesM2,
        unitM2: salesM2,
        totalM2: salesM2,
        realWidthCm:
          vertical.measurementWidthCm,
        realHeightCm:
          vertical.measurementHeightCm,
        productionWidthCm:
          vertical.productionWidthCm,
        productionHeightCm:
          vertical.productionHeightCm
      }
    ]
  };
}

function recalculateTextileHeight(
  productType: string,
  rawValues: UnknownRecord,
  overrides: UnknownRecord,
  calculation: UnknownRecord
): UnknownRecord {
  const configuredValues = {
    ...rawValues,
    ...overrides
  };

  const fallbackHeight =
    positiveNumber(
      calculation.realHeightCm
    ) ||
    positiveNumber(
      calculation.actualHeightCm
    ) ||
    positiveNumber(
      calculation.billingHeightCm
    ) ||
    positiveNumber(
      calculation.calculatedHeightCm
    ) ||
    positiveNumber(
      rawValues.height
    ) ||
    positiveNumber(
      rawValues.boy
    );

  const height =
    resolveConfiguredProductHeight(
      configuredValues,
      fallbackHeight
    );

  if (height <= 0) {
    return calculation;
  }

  const productionHeight =
    calculateCurtainCutHeight(
      height,
      productType as
        "TUL" |
        "GUNESLIK" |
        "FON"
    );

  const previousItems =
    Array.isArray(
      calculation.salesItems
    )
      ? calculation.salesItems.map(
          asRecord
        )
      : [];

  const salesItems =
    previousItems.map(
      item => ({
        ...item,
        realHeightCm:
          height,
        billingHeightCm:
          height,
        productionHeightCm:
          productionHeight
      })
    );

  return {
    ...calculation,
    realHeightCm:
      height,
    actualHeightCm:
      height,
    billingHeightCm:
      height,
    calculatedHeightCm:
      height,
    productionHeightCm:
      productionHeight,
    salesItems
  };
}

export function recalculateConfiguredHeightCalculation(
  input: {
    productType: string;
    rawValues: unknown;
    userOverrides: unknown;
    calculation: unknown;
  }
): UnknownRecord {
  const productType =
    String(
      input.productType || ""
    ).toUpperCase();

  const rawValues =
    asRecord(input.rawValues);

  const overrides =
    asRecord(input.userOverrides);

  const calculation =
    asRecord(input.calculation);

  /*
   * Plicell kendi cam-listesi hesabını kullanır.
   * Bu genel boy override köprüsüne dahil edilmez.
   */
  if (productType === "PLICELL") {
    return calculation;
  }

  if (
    MECHANICAL_AREA_TYPES.has(
      productType
    )
  ) {
    return Array.isArray(
      calculation.groups
    ) &&
    calculation.groups.length > 0
      ? recalculateSegmentedMechanical(
          productType,
          rawValues,
          overrides,
          calculation
        )
      : recalculateSingleMechanical(
          productType,
          rawValues,
          overrides,
          calculation
        );
  }

  if (
    VERTICAL_TYPES.has(
      productType
    )
  ) {
    return recalculateVertical(
      rawValues,
      overrides,
      calculation
    );
  }

  if (
    TEXTILE_HEIGHT_TYPES.has(
      productType
    )
  ) {
    return recalculateTextileHeight(
      productType,
      rawValues,
      overrides,
      calculation
    );
  }

  return calculation;
}