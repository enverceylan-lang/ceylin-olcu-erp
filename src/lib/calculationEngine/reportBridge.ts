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

export interface PlicellReportCam {
  id?: string;
  order?: number;
  widthCm?: string | number;
  heightCm?: number;
  note?: string;
}

export interface PlicellReportCamResult {
  id: string;
  order: number;

  realWidthCm: number;
  realHeightCm: number;

  billingWidthCm: number;
  billingHeightCm: number;

  unitM2: number;
  totalM2: number;

  note?: string;
}

export interface PlicellReportResult {
  calculationVersion: string;
  quantity: number;
  systemType: 'SINGLE' | 'DOUBLE';
  layerCount: number;

  cams: PlicellReportCamResult[];

  singleLayerTotalM2: number;
  totalM2: number;
}

export function getStoredProductCalculation(
  measurementValue: unknown,
  productType?: string
): UnknownRecord {
  const measurement = asRecord(measurementValue);

  const normalizedType =
    String(
      productType ||
      measurement.productType ||
      ''
    ).toUpperCase();

  const selectedProducts =
    Array.isArray(measurement.selectedProducts)
      ? measurement.selectedProducts.map(asRecord)
      : [];

  const selectedProduct =
    selectedProducts.find(
      item =>
        String(item.productType || '').toUpperCase() ===
        normalizedType
    ) ||
    selectedProducts.find(
      item => item.isActive === true
    ) ||
    selectedProducts[0] ||
    {};

  return {
    ...asRecord(measurement.details),
    ...asRecord(selectedProduct.calculation)
  };
}
