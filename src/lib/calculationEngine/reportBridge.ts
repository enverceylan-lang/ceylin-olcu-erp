import {
} from '@/lib/measurementCalculations';

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
  measurement: any,
  productType?: string
): Record<string, any> {
  const normalizedType =
    String(
      productType ||
      measurement?.productType ||
      ''
    ).toUpperCase();

  const selectedProduct =
    Array.isArray(
      measurement?.selectedProducts
    )
      ? measurement.selectedProducts.find(
          (item: any) =>
            String(
              item?.productType || ''
            ).toUpperCase() ===
            normalizedType
        ) ||
        measurement.selectedProducts.find(
          (item: any) =>
            item?.isActive
        ) ||
        measurement.selectedProducts[0]
      : undefined;

  return {
    ...(measurement?.details || {}),
    ...(selectedProduct?.calculation || {})
  };
}
