import type {
  CalculationEngineResult,
  CalculationSalesItem,
  CalculationUnit,
  CalculationWarning
} from './types';

export interface SaleCalculationLine {
  id: string;
  productType: string;
  label: string;

  unit: CalculationUnit;
  quantity: number;

  unitM2?: number;
  totalM2?: number;
  fabricMeters?: number;

  realWidthCm?: number;
  realHeightCm?: number;

  billingWidthCm?: number;
  billingHeightCm?: number;

  productionWidthCm?: number;
  productionHeightCm?: number;

  layerIndex?: number;
  systemType?: 'SINGLE' | 'DOUBLE';
}

export interface SaleCalculationValidation {
  valid: boolean;
  errors: string[];
  warnings: CalculationWarning[];

  calculatedTotalM2: number;
  salesItemsTotalM2: number;

  calculationVersion?: string;
}

function safeNumber(
  value: unknown
): number {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function positiveNumber(
  value: unknown
): number {
  return Math.max(
    0,
    safeNumber(value)
  );
}

function resolveLineQuantity(
  item: CalculationSalesItem
): number {
  if (item.unit === 'm2') {
    return positiveNumber(
      item.totalM2 ??
      item.quantity
    );
  }

  if (item.unit === 'mt') {
    return positiveNumber(
      item.fabricMeters ??
      item.quantity
    );
  }

  return Math.max(
    1,
    positiveNumber(item.quantity)
  );
}

/**
 * Satış satırları yalnız merkezi kasanın salesItems çıktısından üretilir.
 * Burada en × boy, minimum m² veya pile hesabı yapılmaz.
 */
export function buildSaleCalculationLines(
  calculation: Partial<CalculationEngineResult> | undefined,
  fallbackProductType = 'UNKNOWN',
  fallbackLabel = 'Ürün'
): SaleCalculationLine[] {
  if (!calculation) {
    return [];
  }

  const sourceItems =
    Array.isArray(calculation.salesItems)
      ? calculation.salesItems
      : [];

  return sourceItems
    .map(
      (
        item,
        index
      ): SaleCalculationLine => ({
        id:
          item.id ||
          `${fallbackProductType}-${index + 1}`,

        productType:
          String(
            item.productType ||
            fallbackProductType
          ).toUpperCase(),

        label:
          String(
            item.label ||
            fallbackLabel
          ),

        unit:
          item.unit,

        quantity:
          resolveLineQuantity(item),

        unitM2:
          item.unitM2 !== undefined
            ? positiveNumber(item.unitM2)
            : undefined,

        totalM2:
          item.totalM2 !== undefined
            ? positiveNumber(item.totalM2)
            : undefined,

        fabricMeters:
          item.fabricMeters !== undefined
            ? positiveNumber(item.fabricMeters)
            : undefined,

        realWidthCm:
          item.realWidthCm,

        realHeightCm:
          item.realHeightCm,

        billingWidthCm:
          item.billingWidthCm,

        billingHeightCm:
          item.billingHeightCm,

        productionWidthCm:
          item.productionWidthCm,

        productionHeightCm:
          item.productionHeightCm,

        layerIndex:
          item.layerIndex,

        systemType:
          item.systemType
      })
    )
    .filter(line => line.quantity > 0);
}

/**
 * Ölçü kasası toplamı ile satış satırlarının toplamını karşılaştırır.
 * Uyuşmazlık halinde satışa aktarım daha sonra durdurulacaktır.
 */
export function validateCalculationForSale(
  calculation: Partial<CalculationEngineResult> | undefined
): SaleCalculationValidation {
  const errors: string[] = [];

  if (!calculation) {
    return {
      valid: false,
      errors: [
        'Merkezi hesap sonucu bulunamadı.'
      ],
      warnings: [],
      calculatedTotalM2: 0,
      salesItemsTotalM2: 0
    };
  }

  const lines =
    buildSaleCalculationLines(
      calculation,
      calculation.productType ||
        'UNKNOWN',
      calculation.productType ||
        'Ürün'
    );

  if (lines.length === 0) {
    errors.push(
      'Satış kalemi üretilemedi.'
    );
  }

  const calculatedTotalM2 =
    positiveNumber(
      calculation.totalM2
    );

  const salesItemsTotalM2 =
    Number(
      lines
        .reduce(
          (total, line) =>
            total +
            positiveNumber(line.totalM2),
          0
        )
        .toFixed(2)
    );

  const hasM2Lines =
    lines.some(
      line => line.unit === 'm2'
    );

  if (
    hasM2Lines &&
    calculatedTotalM2 <= 0
  ) {
    errors.push(
      'Merkezi kasa m² toplamı sıfır veya eksik.'
    );
  }

  if (
    hasM2Lines &&
    salesItemsTotalM2 <= 0
  ) {
    errors.push(
      'Satış satırlarının m² toplamı sıfır veya eksik.'
    );
  }

  if (
    hasM2Lines &&
    calculatedTotalM2 > 0 &&
    salesItemsTotalM2 > 0 &&
    Math.abs(
      calculatedTotalM2 -
      salesItemsTotalM2
    ) > 0.01
  ) {
    errors.push(
      `Hesap uyuşmazlığı: kasa ${calculatedTotalM2.toFixed(
        2
      )} m², satış satırları ${salesItemsTotalM2.toFixed(
        2
      )} m².`
    );
  }

  return {
    valid: errors.length === 0,
    errors,

    warnings:
      Array.isArray(calculation.warnings)
        ? calculation.warnings
        : [],

    calculatedTotalM2,
    salesItemsTotalM2,

    calculationVersion:
      calculation.calculationVersion
  };
}