import {
  calculateSelectedProduct as calculateSelectedProductLegacy
} from '@/lib/measurementAdapter';

import {
  normalizeCalculationResult
} from './normalizeResult';

export {
  CALCULATION_ENGINE_VERSION
} from './version';

export type {
  CalculationEngineRequest,
  CalculationEngineResult,
  CalculationGroup,
  CalculationSalesItem,
  CalculationSeverity,
  CalculationUnit,
  CalculationWarning
} from './types';

export function calculateSelectedProduct(
  productType: string,
  width: number,
  height: number,
  rawValues: Parameters<typeof calculateSelectedProductLegacy>[3],
  siblingProducts: Parameters<typeof calculateSelectedProductLegacy>[4] = []
): ReturnType<typeof normalizeCalculationResult> {
  const legacyCalculation =
    calculateSelectedProductLegacy(
      productType,
      width,
      height,
      rawValues,
      siblingProducts
    );

  return normalizeCalculationResult(
    productType,
    legacyCalculation
  );
}
export {
  buildSaleCalculationLines,
  validateCalculationForSale
} from './salesBridge';

export type {
  SaleCalculationLine,
  SaleCalculationValidation
} from './salesBridge';
export {
  getStoredProductCalculation
} from './reportBridge';

export type {
  PlicellReportCam,
  PlicellReportCamResult,
  PlicellReportResult
} from './reportBridge';
