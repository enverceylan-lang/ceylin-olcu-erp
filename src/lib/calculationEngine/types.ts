export type CalculationUnit =
  | 'm2'
  | 'mt'
  | 'adet';

export type CalculationSeverity =
  | 'INFO'
  | 'WARNING'
  | 'ERROR';

export interface CalculationWarning {
  code: string;
  message: string;
  severity: CalculationSeverity;
}

export interface CalculationSalesItem {
  id?: string;
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

export interface CalculationGroup {
  id?: string;
  label?: string;
  groupType?: string;

  realWidthCm?: number;
  realHeightCm?: number;

  billingWidthCm?: number;
  billingHeightCm?: number;

  productionWidthCm?: number;
  productionHeightCm?: number;

  unitM2?: number;
  totalM2?: number;

  chainDirection?: 'LEFT' | 'RIGHT';

  firstSegmentIndex?: number;
  lastSegmentIndex?: number;
}

export interface CalculationEngineResult {
  calculationVersion: string;

  productType: string;
  unit: CalculationUnit;
  quantity: number;

  realWidthCm?: number;
  realHeightCm?: number;

  billingWidthCm?: number;
  billingHeightCm?: number;

  productionWidthCm?: number;
  productionHeightCm?: number;

  unitM2?: number;
  totalM2?: number;
  fabricMeters?: number;

  groups?: CalculationGroup[];
  salesItems?: CalculationSalesItem[];
  warnings?: CalculationWarning[];

  description?: string;

  /**
   * Eski hesap alanlarının geçiş sürecinde korunması içindir.
   * Yeni tüketiciler mümkün olduğunca standart alanları kullanmalıdır.
   */
  legacyCalculation?: Record<string, unknown>;
}

export interface CalculationEngineRequest {
  measurement: unknown;
  productType: string;
  options?: Record<string, unknown>;
}