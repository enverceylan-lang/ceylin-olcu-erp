import {
  calculatePlicell
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

function safePositiveNumber(
  value: unknown
): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) &&
    parsed > 0
    ? parsed
    : 0;
}

/**
 * Plicell cam listesinin tamamı yalnız merkezi kasa
 * içindeki ana calculatePlicell kuralından geçirilir.
 *
 * Görsel rapor, PDF, cari ekranı veya çizim bileşeni
 * kendi yuvarlama/minimum m² formülünü yazamaz.
 */
export function calculatePlicellReport(
  cams: PlicellReportCam[],
  commonHeightCm = 0,
  quantity = 1,
  systemType: 'SINGLE' | 'DOUBLE' = 'SINGLE'
): PlicellReportResult {
  const safeQuantity =
    Math.max(
      1,
      Math.floor(
        Number(quantity || 1)
      )
    );

  const validCams =
    Array.isArray(cams)
      ? cams.filter(cam =>
          safePositiveNumber(cam.widthCm) > 0 &&
          (
            safePositiveNumber(cam.heightCm) > 0 ||
            safePositiveNumber(commonHeightCm) > 0
          )
        )
      : [];

  const calculatedCams =
    validCams.map(
      (
        cam,
        index
      ): PlicellReportCamResult => {
        const widthCm =
          safePositiveNumber(cam.widthCm);

        const heightCm =
          safePositiveNumber(cam.heightCm) ||
          safePositiveNumber(commonHeightCm);

        /*
         * Her cam ayrı ayrı kasadan geçer.
         * Böylece minimum 1 m² kuralı cam bazında uygulanır.
         */
        const calculation =
          calculatePlicell(
            widthCm,
            heightCm,
            safeQuantity,
            'SINGLE'
          );

        return {
          id:
            String(
              cam.id ||
              `plicell-cam-${index + 1}`
            ),

          order:
            Number(cam.order || index + 1),

          realWidthCm:
            widthCm,

          realHeightCm:
            heightCm,

          billingWidthCm:
            calculation.billingWidthCm,

          billingHeightCm:
            calculation.billingHeightCm,

          unitM2:
            calculation.unitM2,

          totalM2:
            calculation.totalM2,

          note:
            cam.note
        };
      }
    );

  const singleLayerTotalM2 =
    Number(
      calculatedCams
        .reduce(
          (total, cam) =>
            total + cam.totalM2,
          0
        )
        .toFixed(2)
    );

  const layerCount =
    systemType === 'DOUBLE'
      ? 2
      : 1;

  return {
    calculationVersion:
      'CEYLIN-CALC-V1',

    quantity:
      safeQuantity,

    systemType,
    layerCount,

    cams:
      calculatedCams,

    singleLayerTotalM2,

    totalM2:
      Number(
        (
          singleLayerTotalM2 *
          layerCount
        ).toFixed(2)
      )
  };
}

/**
 * Rapor katmanlarında kayıtlı ürün hesabını bulur.
 * Burada yeni hesap yapılmaz.
 */
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