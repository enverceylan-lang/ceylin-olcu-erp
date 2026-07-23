import React from 'react';
import { X, Printer, Share2, Loader2, ZoomIn, ZoomOut, RotateCcw, Move } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Customer, MEASUREMENT_TEMPLATES, WindowItem, ProductMeasurement } from '@/store/useStore';
import { getTemplateLabel, getMeasurementDimensions, resolveMeasurementProductLabel, resolveMeasurementProductGroup } from '@/lib/measurementAdapter';
import { getValidNote } from '@/lib/reportFormatters';
import {
  getStoredProductCalculation
} from '@/lib/calculationEngine';
import { renderSimpleWidthHeightDiagram, renderCurtainDetailDiagram } from '@/lib/measurementDiagram';
import { TechnicalMeasurementSketch } from './TechnicalMeasurementSketch';
import { PlicellMeasurementSketch } from './PlicellMeasurementSketch';
import { formatFacadeForReport } from '@/lib/facadeHelper';
import { useMeasurementStore, MeasurementRecord } from '@/store/measurementStore';

const MECHANICAL_VISUAL_PRODUCT_TYPES =
  new Set([
    'STOR',
    'ZEBRA',
    'AHSAP_JALUZI',
    'JALUZI',
    'PICASSO'
  ]);

function getSameOpeningMeasurements(
  products: MeasurementRecord[],
  current: MeasurementRecord
) {
  const currentRoomId =
    String(current?.roomId || '');

  const currentOpeningId =
    String(
      current?.openingId ||
      current?.windowId ||
      ''
    );

  const matches = products.filter(item => {
    const itemRoomId =
      String(item?.roomId || '');

    const itemOpeningId =
      String(
        item?.openingId ||
        item?.windowId ||
        ''
      );

    if (
      currentOpeningId &&
      itemOpeningId
    ) {
      return (
        itemOpeningId === currentOpeningId &&
        (
          !currentRoomId ||
          !itemRoomId ||
          itemRoomId === currentRoomId
        )
      );
    }

    return item?.id === current?.id;
  });

  return matches.length > 0
    ? matches
    : [current];
}

function getSketchProductTypes(
  products: any[],
  current: any
): string[] {
  const sameOpening =
    getSameOpeningMeasurements(products, current);

  const rawTypes: string[] = [];

  sameOpening.forEach(item => {
    if (item?.productType) {
      rawTypes.push(String(item.productType));
    }

    if (Array.isArray(item?.selectedProducts)) {
      item.selectedProducts.forEach((sp: any) => {
        if (sp?.isActive !== false && sp?.productType) {
          rawTypes.push(String(sp.productType));
        }
      });
    }
  });

  return Array.from(new Set(rawTypes));
}
function getSketchProductHeights(
  products: any[],
  current: any
): Array<{
  productType: string;
  label: string;
  heightCm: number;
}> {
  const sameOpening =
    getSameOpeningMeasurements(products, current);

  const result =
    new Map<
      string,
      {
        productType: string;
        label: string;
        heightCm: number;
      }
    >();

  const labels: Record<string, string> = {
    TUL: 'Tül Boy',
    GUNESLIK: 'Güneşlik Boy',
    FON: 'Fon Boy',
    STOR: 'Stor Boy',
    ZEBRA: 'Zebra Boy',
    DIKEY_STOR: 'Dikey Stor Boy',
    DIKEY_TUL: 'Dikey Tül Boy',
    AHSAP_JALUZI: 'Ahşap Jaluzi Boy',
    JALUZI: 'Jaluzi Boy',
    PICASSO: 'Picasso Boy',
    PLICELL: 'Plicell Boy'
  };

  sameOpening.forEach(item => {
    const rawValues =
      item?.rawValues || {};

    const fullHeight =
      Math.max(
        Number(rawValues.solYukseklikCm || 0),
        Number(rawValues.ortaYukseklikCm || 0),
        Number(rawValues.sagYukseklikCm || 0),
        Number(rawValues.height || 0),
        Number(rawValues.windowHeight || 0)
      );

    const activeProducts =
      Array.isArray(item?.selectedProducts)
        ? item.selectedProducts.filter(
            (product: any) =>
              product?.isActive !== false
          )
        : [];

    activeProducts.forEach((product: any) => {
      const productType =
        String(
          product?.productType || ''
        ).toUpperCase();

      if (!productType) {
        return;
      }

      const calculation =
        product?.calculation || {};

      const mechanicalProductTypes =
        new Set([
          'STOR',
          'ZEBRA',
          'DIKEY_STOR',
          'DIKEY_TUL',
          'AHSAP_JALUZI',
          'JALUZI',
          'PICASSO',
          'PLICELL'
        ]);

      const groupHeights =
        Array.isArray(calculation.groups)
          ? calculation.groups
              .map((group: any) =>
                Number(
                  group?.realHeightCm ||
                  group?.calculatedHeightCm ||
                  group?.billingHeight ||
                  0
                )
              )
              .filter(
                (value: number) =>
                  value > 0
              )
          : [];

      const mechanicalHeight =
        Math.max(
          Number(
            calculation.realHeightCm ||
            calculation.calculatedHeightCm ||
            calculation.billingHeight ||
            calculation.heightCm ||
            calculation.height ||
            0
          ),
          ...groupHeights,
          0
        );

      const overrides =
        product?.userOverrides || {};

      const customHeight =
        Number(
          overrides.customHeightCm ||
          calculation.customHeightCm ||
          0
        );

      const heightSource =
        String(
          overrides.heightSource ||
          calculation.heightSource ||
          ''
        ).toUpperCase();

      let resolvedHeight = 0;

      if (customHeight > 0) {
        resolvedHeight = customHeight;
      } else if (
        heightSource.includes('KALORIFER') ||
        heightSource.includes('MERMER')
      ) {
        resolvedHeight =
          Number(
            rawValues.kaloriferMermerBoyuCm || 0
          );
      } else if (heightSource.includes('SOL')) {
        resolvedHeight =
          Number(rawValues.solYukseklikCm || 0);
      } else if (heightSource.includes('ORTA')) {
        resolvedHeight =
          Number(rawValues.ortaYukseklikCm || 0);
      } else if (heightSource.includes('SAG')) {
        resolvedHeight =
          Number(rawValues.sagYukseklikCm || 0);
      } else if (
        heightSource.includes('CAM') &&
        heightSource.includes('ICI')
      ) {
        resolvedHeight =
          Number(rawValues.camIciCm || 0);
      } else if (
        mechanicalProductTypes.has(productType) &&
        mechanicalHeight > 0
      ) {
        resolvedHeight = mechanicalHeight;
      } else if (
        productType === 'GUNESLIK' &&
        Number(
          rawValues.kaloriferMermerBoyuCm || 0
        ) > 0
      ) {
        resolvedHeight =
          Number(
            rawValues.kaloriferMermerBoyuCm || 0
          );
      } else {
        resolvedHeight = fullHeight;
      }

      if (resolvedHeight <= 0) {
        return;
      }

      result.set(productType, {
        productType,
        label:
          labels[productType] ||
          productType + ' Boy',
        heightCm: resolvedHeight
      });
    });
  });

  return Array.from(result.values());
}

function shouldSuppressSunshadeFacadeHeight(
  measurement: any
): boolean {
  const activeProducts =
    Array.isArray(measurement?.selectedProducts)
      ? measurement.selectedProducts.filter(
          (product: any) =>
            product?.isActive !== false
        )
      : [];

  const sunshade =
    activeProducts.find(
      (product: any) =>
        String(
          product?.productType || ''
        ).toUpperCase() === 'GUNESLIK'
    );

  if (!sunshade) {
    return false;
  }

  const calculation =
    sunshade?.calculation || {};

  const overrides =
    sunshade?.userOverrides || {};

  const customHeight =
    Number(
      overrides.customHeightCm ||
      calculation.customHeightCm ||
      0
    );

  const mermerHeight =
    Number(
      measurement?.rawValues
        ?.kaloriferMermerBoyuCm ||
      0
    );

  return (
    customHeight > 0 ||
    mermerHeight > 0
  );
}

function getSketchFonPlacement(
  measurements: any[]
): 'LEFT' | 'BOTH' | undefined {
  for (const measurement of measurements) {
    const fonProduct =
      measurement?.selectedProducts?.find(
        (product: any) =>
          product?.isActive !== false &&
          String(
            product?.productType || ''
          ).toUpperCase() === 'FON'
      );

    const placement =
      fonProduct?.calculation?.fonPlacement;

    if (
      placement === 'LEFT' ||
      placement === 'BOTH'
    ) {
      return placement;
    }
  }

  return undefined;
}

function getGeneralSketchProductHeights(
  products: any[],
  current: any
): Array<{
  productType: string;
  label: string;
  heightCm: number;
}> {
  const allowedProductTypes =
    new Set([
      'TUL',
      'FON',
      'GUNESLIK'
    ]);

  return getSketchProductHeights(
    products,
    current
  ).filter(item =>
    allowedProductTypes.has(
      String(
        item.productType || ''
      ).toUpperCase()
    )
  );
}

function buildMechanicalVisualPanels(
  measurements: any[]
): Array<{
  id?: string;
  productType: string;
  groupType?: string;
  widthCm: number;
  heightCm: number;
  chainDirection?: 'LEFT' | 'RIGHT';

  startCm?: number;
  endCm?: number;

  firstSegmentIndex?: number;
  lastSegmentIndex?: number;
}> {
  const panels: Array<{
    id?: string;
    productType: string;
    groupType?: string;
    widthCm: number;
    heightCm: number;
    chainDirection?: 'LEFT' | 'RIGHT';

    startCm?: number;
    endCm?: number;

    firstSegmentIndex?: number;
    lastSegmentIndex?: number;
  }> = [];

  measurements.forEach(measurement => {
    if (!measurement) return;

    const candidates: any[] = [];

    if (
      MECHANICAL_VISUAL_PRODUCT_TYPES.has(
        String(
          measurement.productType || ''
        ).toUpperCase()
      )
    ) {
      candidates.push({
        productType:
          measurement.productType,
        calculation:
          measurement.calculation ||
          measurement.details
      });
    }

    if (
      Array.isArray(
        measurement.selectedProducts
      )
    ) {
      measurement.selectedProducts
        .filter(
          (product: any) =>
            product?.isActive !== false &&
            MECHANICAL_VISUAL_PRODUCT_TYPES.has(
              String(
                product?.productType || ''
              ).toUpperCase()
            )
        )
        .forEach((product: any) => {
          candidates.push(product);
        });
    }

    candidates.forEach(candidate => {
      const productType =
        String(
          candidate.productType || ''
        ).toUpperCase();

      const calculation =
        candidate.calculation ||
        candidate.details ||
        {};

      const groups =
        Array.isArray(calculation.groups)
          ? calculation.groups
          : [];

      groups.forEach(
        (group: any, index: number) => {
          panels.push({
            id:
              group.generatedItemId ||
              `${measurement.id || 'measurement'}-${productType}-${index}`,
            productType,
            groupType:
              group.groupType,
            widthCm:
              Number(
                group.realWidthCm ||
                group.actualWidthCm ||
                group.billingWidthCm ||
                0
              ),
            heightCm:
              Number(
                group.realHeightCm ||
                group.actualHeightCm ||
                group.calculatedHeightCm ||
                group.billingHeightCm ||
                0
              ),
            chainDirection:
              group.chainDirection === 'LEFT'
                ? 'LEFT'
                : 'RIGHT',

            startCm:
              Number(
                group.startCm || 0
              ),

            endCm:
              Number(
                group.endCm || 0
              ),

            firstSegmentIndex:
              Number.isFinite(
                Number(
                  group.firstSegmentIndex
                )
              )
                ? Number(
                    group.firstSegmentIndex
                  )
                : undefined,

            lastSegmentIndex:
              Number.isFinite(
                Number(
                  group.lastSegmentIndex
                )
              )
                ? Number(
                    group.lastSegmentIndex
                  )
                : undefined
          });
        }
      );
    });
  });

  return panels;
}

function buildCalculationReportDetails(
  productType: string,
  calculation: any
): string[] {
  const calc = calculation || {};
  const details: string[] = [];
  const type = String(productType || '').toUpperCase();

  const systemType =
    calc.systemType === 'DOUBLE'
      ? 'Çiftli Sistem'
      : calc.systemType === 'SINGLE'
        ? 'Tekli Sistem'
        : '';

  if (systemType) {
    details.push(systemType);
  }

  if (
    calc.billingWidth !== undefined &&
    calc.billingHeight !== undefined
  ) {
    details.push(
      `Hesap Ölçüsü: ${calc.billingWidth} × ${calc.billingHeight} cm`
    );
  } else if (
    calc.billingWidthCm !== undefined &&
    calc.billingHeightCm !== undefined
  ) {
    details.push(
      `Hesap Ölçüsü: ${calc.billingWidthCm} × ${calc.billingHeightCm} cm`
    );
  }

  if (calc.totalM2 !== undefined) {
    details.push(
      `Alan: ${Number(calc.totalM2).toFixed(2)} m²`
    );
  }

  if (
    calc.chainDirection === 'LEFT' ||
    calc.chainDirection === 'RIGHT'
  ) {
    details.push(
      `Zincir: ${
        calc.chainDirection === 'LEFT'
          ? 'Sol'
          : 'Sağ'
      }`
    );
  }

  if (type === 'FON') {
    if (calc.fonPlacement === 'LEFT') {
      details.push('Fon Yerleşimi: Sol Kanat');
    } else if (calc.fonPlacement === 'BOTH') {
      details.push('Fon Yerleşimi: Sol ve Sağ Kanat');
    }

    if (calc.wings !== undefined) {
      details.push(`Fon Kanat Adedi: ${calc.wings}`);
    }
  }

  if (
    type === 'DIKEY_STOR' ||
    type === 'DIKEY_TUL'
  ) {
    if (
      calc.productionWidth !== undefined &&
      calc.productionHeight !== undefined
    ) {
      details.push(
        `Üretim: ${calc.productionWidth} × ${calc.productionHeight} cm`
      );
    }

    if (calc.openingType === 'DOUBLE') {
      details.push('Açılım: Ortadan İki Yana');
    } else if (calc.openingType === 'SINGLE') {
      details.push('Açılım: Tek Açılır');
    }
  }

  if (type === 'TUL') {
    if (calc.tulleStyle === 'REGISTER') {
      details.push('Model: Register');
    } else if (calc.tulleStyle === 'CROSSOVER') {
      details.push('Model: Kruvaze');
    } else if (calc.tulleStyle === 'PLEATED') {
      details.push('Model: Pileli');
    }

    if (calc.pleatFactor !== undefined) {
      details.push(`Pile: ${calc.pleatFactor} Kat`);
    }

    if (calc.fabricUsageMeters !== undefined) {
      details.push(
        `Kumaş: ${Number(calc.fabricUsageMeters).toFixed(2)} m`
      );
    }

    if (calc.cutHeightCm !== undefined) {
      details.push(`Kesim Boyu: ${calc.cutHeightCm} cm`);
    }
  }

  if (type === 'GUNESLIK') {
    if (calc.fabricUsageMeters !== undefined) {
      details.push(
        `Kumaş: ${Number(calc.fabricUsageMeters).toFixed(2)} m`
      );
    }

    if (calc.cutHeightCm !== undefined) {
      details.push(`Kesim Boyu: ${calc.cutHeightCm} cm`);
    }
  }

  if (type === 'FON') {
    if (calc.fabricUsageMeters !== undefined) {
      details.push(
        `Kumaş: ${Number(calc.fabricUsageMeters).toFixed(2)} m`
      );
    }

    if (calc.wings !== undefined) {
      details.push(`Kanat: ${calc.wings}`);
    }

    if (
      calc.cutHeightCm !== undefined ||
      calc.billingHeight !== undefined
    ) {
      details.push(
        `Kesim Boyu: ${
          calc.cutHeightCm ??
          calc.billingHeight
        } cm`
      );
    }
  }

  if (
    Array.isArray(calc.salesItems) &&
    calc.salesItems.length > 1
  ) {
    details.push(
      `Satış Kalemleri: ${calc.salesItems
        .map((item: any) => item.label)
        .filter(Boolean)
        .join(' + ')}`
    );
  }

  return Array.from(new Set(details));
}
interface MeasurementVisualReportProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  users: { id: string; name: string }[];
  measurements?: MeasurementRecord[];
}

export function MeasurementVisualReport({ isOpen, onClose, customer, users, measurements: propMeasurements }: MeasurementVisualReportProps) {
  const [isGeneratingPdf, setIsGeneratingPdf] = React.useState(false);
  const [previewNode, setPreviewNode] = React.useState<React.ReactNode | null>(null);
  const [previewZoom, setPreviewZoom] = React.useState(1);
  const [previewOffset, setPreviewOffset] = React.useState({ x: 0, y: 0 });
  const [isPreviewDragging, setIsPreviewDragging] = React.useState(false);
  const previewDragStartRef = React.useRef({
    pointerX: 0,
    pointerY: 0,
    offsetX: 0,
    offsetY: 0
  });

  const { measurements: storeMeasurements } = useMeasurementStore();

  const clampPreviewZoom = React.useCallback(
    (value: number) =>
      Math.min(4, Math.max(1, value)),
    []
  );

  const resetPreviewTransform = React.useCallback(() => {
    setPreviewZoom(1);
    setPreviewOffset({ x: 0, y: 0 });
    setIsPreviewDragging(false);
  }, []);

  const closePreview = React.useCallback(() => {
    setPreviewNode(null);
    resetPreviewTransform();
  }, [resetPreviewTransform]);

  const changePreviewZoom = React.useCallback(
    (nextZoom: number) => {
      const clampedZoom =
        clampPreviewZoom(nextZoom);

      setPreviewZoom(clampedZoom);

      if (clampedZoom === 1) {
        setPreviewOffset({ x: 0, y: 0 });
      }
    },
    [clampPreviewZoom]
  );

  const handlePreviewWheel = React.useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const zoomStep =
        event.deltaY < 0 ? 0.25 : -0.25;

      setPreviewZoom(currentZoom => {
        const nextZoom =
          clampPreviewZoom(
            currentZoom + zoomStep
          );

        if (nextZoom === 1) {
          setPreviewOffset({
            x: 0,
            y: 0
          });
        }

        return nextZoom;
      });
    },
    [clampPreviewZoom]
  );

  const handlePreviewPointerDown = React.useCallback(
    (
      event:
        React.PointerEvent<HTMLDivElement>
    ) => {
      if (previewZoom <= 1) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      event.currentTarget.setPointerCapture(
        event.pointerId
      );

      previewDragStartRef.current = {
        pointerX: event.clientX,
        pointerY: event.clientY,
        offsetX: previewOffset.x,
        offsetY: previewOffset.y
      };

      setIsPreviewDragging(true);
    },
    [
      previewOffset.x,
      previewOffset.y,
      previewZoom
    ]
  );

  const handlePreviewPointerMove = React.useCallback(
    (
      event:
        React.PointerEvent<HTMLDivElement>
    ) => {
      if (!isPreviewDragging) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const dragStart =
        previewDragStartRef.current;

      setPreviewOffset({
        x:
          dragStart.offsetX +
          event.clientX -
          dragStart.pointerX,
        y:
          dragStart.offsetY +
          event.clientY -
          dragStart.pointerY
      });
    },
    [isPreviewDragging]
  );

  const finishPreviewDrag = React.useCallback(
    (
      event:
        React.PointerEvent<HTMLDivElement>
    ) => {
      if (
        event.currentTarget.hasPointerCapture(
          event.pointerId
        )
      ) {
        event.currentTarget.releasePointerCapture(
          event.pointerId
        );
      }

      setIsPreviewDragging(false);
    },
    []
  );

  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closePreview();
      }
    };

    window.addEventListener(
      'keydown',
      handleEsc
    );

    return () =>
      window.removeEventListener(
        'keydown',
        handleEsc
      );
  }, [closePreview]);

  React.useEffect(() => {
    if (previewNode) {
      resetPreviewTransform();
    }
  }, [
    previewNode,
    resetPreviewTransform
  ]);

  if (!isOpen) return null;

  const activeMeasurements = (propMeasurements || storeMeasurements).filter(
    m => m.customerId === customer.id && !m.isDeleted && !m.isArchived
  );

  // Determine global "Ölçüyü Alan"
  const allMeasuredBy = new Set<string>();
  activeMeasurements.forEach(p => {
    if (p.measuredBy) allMeasuredBy.add(p.measuredBy);
  });
  const sameMeasuredBy = allMeasuredBy.size === 1 ? Array.from(allMeasuredBy)[0] : null;

  // Date checks
  const uniqueDays = new Set<string>();
  activeMeasurements.forEach(p => {
    if (p.measuredDate) {
      const dayStr = new Date(p.measuredDate).toLocaleDateString('tr-TR');
      uniqueDays.add(dayStr);
    }
  });
  const showDateOnMeasurements = uniqueDays.size > 1;

  let globalPlicellCount = 0;
  let globalPlicellM2 = 0;
  let globalMechanicalCount = 0;
  let globalMechanicalM2 = 0;

  const renderSelectedProductsSection = (p: MeasurementRecord) => {
    const activeItems = p.selectedProducts?.filter(sp => sp.isActive) || [];
    if (activeItems.length === 0) {
      return (
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1">
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider block">Seçilen Ürünler & Hesaplar</span>
          <div className="text-xs text-slate-300 dark:text-slate-400 bg-slate-900/50 p-2.5 rounded border border-slate-800">
            Ürün: {resolveMeasurementProductLabel(p)} (Hesaplama otomatik)
          </div>
        </div>
      );
    }
    return (
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider block">Seçilen Ürünler & Hesaplar</span>
        <div className="space-y-2">
          {activeItems.map(item => {
            const label = resolveMeasurementProductLabel({ productType: item.productType });
            const desc = item.calculation?.description || 'Otomatik hesaplanıyor';

            const calc = item.calculation || {};

            const detailsList: string[] =
              buildCalculationReportDetails(
                item.productType,
                calc
              );




            if (item.productType === 'RUSTIK' && calc.billingWidth) {
              detailsList.push(`Rustik Boru Eni: ${calc.billingWidth} cm, Boy: ${calc.billingHeight} cm`);
            }
            if (item.productType === 'TAVAN_RUSTIK') {
              if (
                calc.quantity !== undefined &&
                calc.pieceLengthMeters !== undefined &&
                calc.totalLengthMeters !== undefined
              ) {
                detailsList.push(
                  `Tavan Rustik: ${calc.quantity} adet × ${calc.pieceLengthMeters} mt | Toplam: ${calc.totalLengthMeters} mt`
                );
              }

              if (calc.legLengthCm !== undefined) {
                detailsList.push(
                  `Ayak Boyu: ${calc.legLengthCm} cm`
                );
              }
            }





            if (
              (item.productType === 'STOR' ||
               item.productType === 'ZEBRA') &&
              calc.hemModel &&
              calc.hemModel !== 'Düz'
            ) {
              detailsList.push(`Etek: ${calc.hemModel}`);
            }

            if (
              (item.productType === 'STOR' ||
               item.productType === 'ZEBRA') &&
              calc.laserHem
            ) {
              detailsList.push('Lazer Etek: Aktif');
            }
            if (item.productType === 'BIRIZ' && calc.birizTulMeters) {
              detailsList.push(`Biriz Tül: ${calc.birizTulMeters} m, Demir: ${calc.rodLengthMeters} m (2 çubuk), Başlık: ${calc.capsCount} adet`);
            }

            return (
              <div key={item.productType} className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-800 text-xs">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-white print:text-black">{label}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 italic">{desc}</span>
                </div>
                {detailsList.length > 0 && (
                  <div className="text-[11px] text-blue-400 print:text-black font-semibold mt-1">
                    {detailsList.join(' | ')}
                  </div>
                )}

                {Array.isArray(calc.groups) &&
                  calc.groups.length > 0 && (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                      {calc.groups.map(
                        (group: any, groupIndex: number) => {
                          const realWidth =
                            Number(
                              group.realWidthCm || 0
                            );

                          const realHeight =
                            Number(
                              group.realHeightCm || 0
                            );

                          const calculatedWidth =
                            Number(
                              group.calculatedWidthCm || 0
                            );

                          const calculatedHeight =
                            Number(
                              group.calculatedHeightCm || 0
                            );

                          const partM2 =
                            Number(
                              group.totalM2 || 0
                            );

                          const chainLabel =
                            group.chainDirection === 'LEFT'
                              ? 'Sol'
                              : 'Sağ';

                          return (
                            <div
                              key={
                                group.generatedItemId ||
                                `${item.productType}-${groupIndex}`
                              }
                              className="pdf-keep-together rounded-lg border border-slate-700 bg-slate-950/40 p-2.5 print:border-slate-300 print:bg-white"
                            >
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span className="font-black text-white print:text-black">
                                  Parça {groupIndex + 1}
                                </span>

                                {group.requiresJumbo && (
                                  <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[9px] font-black text-amber-400 print:border print:border-amber-500 print:bg-white print:text-black">
                                    JUMBO
                                  </span>
                                )}
                              </div>

                              <div className="mb-2 rounded border border-slate-700 bg-white p-1.5 print:border-slate-300">
                                <svg
                                  viewBox="0 0 260 130"
                                  className="h-auto w-full"
                                  role="img"
                                  aria-label={`Parça ${groupIndex + 1} teknik krokisi`}
                                >
                                  <rect
                                    x="45"
                                    y="18"
                                    width="165"
                                    height="82"
                                    fill="#ffffff"
                                    stroke="#0f172a"
                                    strokeWidth="2"
                                  />

                                  <line
                                    x1="45"
                                    y1="10"
                                    x2="210"
                                    y2="10"
                                    stroke="#0f172a"
                                    strokeWidth="1"
                                  />

                                  <line
                                    x1="45"
                                    y1="5"
                                    x2="45"
                                    y2="15"
                                    stroke="#0f172a"
                                  />

                                  <line
                                    x1="210"
                                    y1="5"
                                    x2="210"
                                    y2="15"
                                    stroke="#0f172a"
                                  />

                                  <text
                                    x="127.5"
                                    y="8"
                                    textAnchor="middle"
                                    fontSize="10"
                                    fontWeight="700"
                                    fill="#0f172a"
                                  >
                                    {realWidth} cm
                                  </text>

                                  <line
                                    x1="220"
                                    y1="18"
                                    x2="220"
                                    y2="100"
                                    stroke="#0f172a"
                                    strokeWidth="1"
                                  />

                                  <line
                                    x1="215"
                                    y1="18"
                                    x2="225"
                                    y2="18"
                                    stroke="#0f172a"
                                  />

                                  <line
                                    x1="215"
                                    y1="100"
                                    x2="225"
                                    y2="100"
                                    stroke="#0f172a"
                                  />

                                  <text
                                    x="232"
                                    y="62"
                                    fontSize="10"
                                    fontWeight="700"
                                    fill="#0f172a"
                                    transform="rotate(90 232 62)"
                                    textAnchor="middle"
                                  >
                                    {realHeight} cm
                                  </text>

                                  <line
                                    x1={
                                      group.chainDirection === 'LEFT'
                                        ? 115
                                        : 140
                                    }
                                    y1="59"
                                    x2={
                                      group.chainDirection === 'LEFT'
                                        ? 70
                                        : 185
                                    }
                                    y2="59"
                                    stroke="#2563eb"
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                  />

                                  <polyline
                                    points={
                                      group.chainDirection === 'LEFT'
                                        ? '78,51 70,59 78,67'
                                        : '177,51 185,59 177,67'
                                    }
                                    fill="none"
                                    stroke="#2563eb"
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />

                                  <text
                                    x="127.5"
                                    y="116"
                                    textAnchor="middle"
                                    fontSize="10"
                                    fontWeight="700"
                                    fill="#0f172a"
                                  >
                                    Hesap: {calculatedWidth} × {calculatedHeight} cm
                                  </text>

                                  {group.requiresJumbo && (
                                    <text
                                      x="127.5"
                                      y="34"
                                      textAnchor="middle"
                                      fontSize="11"
                                      fontWeight="900"
                                      fill="#b45309"
                                    >
                                      JUMBO
                                    </text>
                                  )}
                                </svg>
                              </div>

                              <div className="space-y-0.5 text-[10px] text-slate-300 print:text-black">
                                <div>
                                  <span className="font-bold">
                                    Gerçek:
                                  </span>{' '}
                                  {realWidth} × {realHeight} cm
                                </div>

                                <div>
                                  <span className="font-bold">
                                    Hesap:
                                  </span>{' '}
                                  {calculatedWidth} × {calculatedHeight} cm
                                </div>

                                <div>
                                  <span className="font-bold">
                                    Alan:
                                  </span>{' '}
                                  {partM2.toLocaleString(
                                    'tr-TR',
                                    {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2
                                    }
                                  )}{' '}
                                  m²
                                </div>

                                <div>
                                  <span className="font-bold">
                                    Zincir:
                                  </span>{' '}
                                  {chainLabel}
                                </div>

                                {group.warning && (
                                  <div className="mt-1 font-bold text-amber-400 print:text-black">
                                    {group.warning}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const generateVisualReportPdfFile = async (): Promise<File> => {
    const reportElement =
      document.getElementById('visual-report-print-area');

    if (!reportElement) {
      throw new Error('Görsel rapor alanı bulunamadı.');
    }

    /*
     * Ekrandaki SVG krokileri birebir kullanılır.
     * Klon üzerinde koyu ekran teması beyaz PDF temasına çevrilir.
     * Orijinal ekrana müdahale edilmez.
     */
    const canvas = await html2canvas(reportElement, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: reportElement.scrollWidth,
      windowHeight: reportElement.scrollHeight,
      onclone: clonedDocument => {
        const clonedReport =
          clonedDocument.getElementById(
            'visual-report-print-area'
          );

        if (!clonedReport) {
          return;
        }

        clonedReport.style.background = '#ffffff';
        clonedReport.style.color = '#0f172a';
        clonedReport.style.border = 'none';
        clonedReport.style.boxShadow = 'none';

        const pdfStyle =
          clonedDocument.createElement('style');

        pdfStyle.textContent = `
          #visual-report-print-area {
            width: 100% !important;
            max-width: none !important;
            background: #ffffff !important;
            color: #0f172a !important;
            border: none !important;
            box-shadow: none !important;
          }

          #visual-report-print-area .measurement-card {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            background: #ffffff !important;
            color: #0f172a !important;
            border: 1px solid #cbd5e1 !important;
            box-shadow: none !important;
          }

          #visual-report-print-area h1,
          #visual-report-print-area h2,
          #visual-report-print-area h3,
          #visual-report-print-area h4,
          #visual-report-print-area p,
          #visual-report-print-area span,
          #visual-report-print-area div {
            text-shadow: none !important;
          }

          #visual-report-print-area .text-white {
            color: #0f172a !important;
          }

          #visual-report-print-area .bg-slate-900,
          #visual-report-print-area .bg-slate-950,
          #visual-report-print-area .bg-slate-900\\/50,
          #visual-report-print-area .bg-slate-950\\/20,
          #visual-report-print-area .bg-slate-950\\/40 {
            background-color: #ffffff !important;
          }

          #visual-report-print-area svg {
            background: #ffffff !important;
          }

          #visual-report-print-area .no-print {
            display: none !important;
          }
        `;

        clonedDocument.head.appendChild(pdfStyle);
      }
    });

    const pdf =
      new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 8;
    const usableWidth = pageWidth - margin * 2;
    const usableHeight = pageHeight - margin * 2;

    /*
     * Tek uzun görseli her sayfada tekrar basmak yerine,
     * canvas gerçek A4 dilimlerine ayrılır.
     */
    const pagePixelHeight =
      Math.floor(
        canvas.width *
          (usableHeight / usableWidth)
      );

    /*
     * DOM kart sınırlarını canvas piksel koordinatlarına çevir.
     * Böylece bir kart A4 sınırına denk gelirse kesmek yerine
     * kartın başlangıcından yeni sayfa açılır.
     */
    const reportRect =
      reportElement.getBoundingClientRect();

    const canvasScaleY =
      canvas.height /
      Math.max(
        reportElement.scrollHeight,
        reportRect.height,
        1
      );

    const keepTogetherBlocks =
      Array.from(
        reportElement.querySelectorAll<HTMLElement>(
          '.measurement-card, .pdf-keep-together'
        )
      )
        .map(element => {
          const rect =
            element.getBoundingClientRect();

          const top =
            Math.max(
              0,
              Math.round(
                (
                  rect.top -
                  reportRect.top +
                  reportElement.scrollTop
                ) *
                  canvasScaleY
              )
            );

          const bottom =
            Math.min(
              canvas.height,
              Math.round(
                (
                  rect.bottom -
                  reportRect.top +
                  reportElement.scrollTop
                ) *
                  canvasScaleY
              )
            );

          return {
            top,
            bottom,
            height: bottom - top
          };
        })
        .filter(
          block =>
            block.height > 0
        )
        .sort(
          (a, b) =>
            a.top - b.top
        );
    /*
     * PDF sayfalarını canvas piksel verisinden doğrudan kes.
     * drawImage / data URL önbellek tekrarına girmez.
     */
    let sourceY = 0;
    let pageIndex = 0;

    while (
      sourceY <
      canvas.height
    ) {
      const remainingHeight =
        canvas.height -
        sourceY;

      let sliceHeight =
        Math.max(
          1,
          Math.min(
            pagePixelHeight,
            remainingHeight
          )
        );

      /*
       * Kart sayfa sınırında bölünüyorsa dilimi kartın
       * başlangıcında bitir. Böylece ölçü kartı iki sayfaya
       * parçalanmaz.
       */
      const proposedBottom =
        sourceY +
        sliceHeight;

      const crossingBlock =
        keepTogetherBlocks.find(
          block =>
            block.top >
              sourceY + 20 &&
            block.top <
              proposedBottom &&
            block.bottom >
              proposedBottom
        );

      if (crossingBlock) {
        sliceHeight =
          Math.max(
            1,
            crossingBlock.top -
              sourceY
          );
      }

      const safeSourceY =
        Math.floor(sourceY);

      const safeSliceHeight =
        Math.max(
          1,
          Math.floor(sliceHeight)
        );

      const pageCanvas =
        document.createElement(
          'canvas'
        );

      pageCanvas.width =
        canvas.width;

      pageCanvas.height =
        safeSliceHeight;

      const pageContext =
        pageCanvas.getContext('2d');

      if (!pageContext) {
        throw new Error(
          'PDF sayfa canvas alanı oluşturulamadı.'
        );
      }

      pageContext.fillStyle =
        '#ffffff';

      pageContext.fillRect(
        0,
        0,
        pageCanvas.width,
        pageCanvas.height
      );

      /*
       * Her sayfa için kaynak canvasın farklı dikey bölümünü
       * doğrudan çiz. getImageData/toDataURL önbellek tekrarını
       * kullanma; böylece ilk sayfanın bütün sayfalarda yeniden
       * görünmesi engellenir.
       */
      pageContext.drawImage(
        canvas,
        0,
        safeSourceY,
        canvas.width,
        safeSliceHeight,
        0,
        0,
        pageCanvas.width,
        pageCanvas.height
      );

      if (pageIndex > 0) {
        pdf.addPage();
      }

      const renderedHeight =
        (
          safeSliceHeight *
          usableWidth
        ) /
        canvas.width;

      pdf.addImage(
        pageCanvas,
        'PNG',
        margin,
        margin,
        usableWidth,
        renderedHeight,
        undefined,
        'FAST'
      );

      sourceY +=
        safeSliceHeight;

      pageIndex += 1;
    }


    const safeCustomerName =
      String(customer.name || 'musteri')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();

    const fileName =
      `ceylin-olcu-raporu-${safeCustomerName || 'musteri'}.pdf`;

    const pdfBlob =
      pdf.output('blob');

    return new File(
      [pdfBlob],
      fileName,
      { type: 'application/pdf' }
    );
  };

  const handlePrint = () => {
    const printArea =
      document.getElementById(
        'visual-report-print-area'
      );

    if (!printArea) {
      window.alert(
        'Yazdırılacak rapor alanı bulunamadı.'
      );
      return;
    }

    const existingFrame =
      document.getElementById(
        'ceylin-print-frame'
      );

    if (existingFrame) {
      existingFrame.remove();
    }

    const printFrame =
      document.createElement('iframe');

    printFrame.id = 'ceylin-print-frame';
    printFrame.setAttribute(
      'aria-hidden',
      'true'
    );

    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    printFrame.style.visibility = 'hidden';

    document.body.appendChild(printFrame);

    const frameWindow =
      printFrame.contentWindow;

    const frameDocument =
      printFrame.contentDocument ||
      frameWindow?.document;

    if (!frameWindow || !frameDocument) {
      printFrame.remove();

      window.alert(
        'Yazdırma alanı hazırlanamadı.'
      );
      return;
    }

    const documentTitle =
      'CEYLİN ERP - Saha Ölçü Raporu';

    frameDocument.open();
    frameDocument.write(
      '<!doctype html>' +
      '<html lang="tr">' +
      '<head>' +
      '<meta charset="utf-8" />' +
      '<meta name="viewport" content="width=device-width, initial-scale=1" />' +
      '<title>' +
      documentTitle +
      '</title>' +
      document.head.innerHTML +
      '<style>' +
      'html,body{' +
      'margin:0!important;' +
      'padding:0!important;' +
      'width:100%!important;' +
      'height:auto!important;' +
      'min-height:0!important;' +
      'overflow:visible!important;' +
      'background:#fff!important;' +
      '}' +
      'body{' +
      'position:static!important;' +
      '}' +
      '#visual-report-print-area{' +
      'position:static!important;' +
      'display:block!important;' +
      'margin:0!important;' +
      'padding:0!important;' +
      'width:100%!important;' +
      'max-width:none!important;' +
      'height:auto!important;' +
      'min-height:0!important;' +
      'max-height:none!important;' +
      'overflow:visible!important;' +
      'transform:none!important;' +
      '}' +
      '/* CEYLIN_PRINT_TABLE_PAGE_FLOW_V1 */' +
      '#visual-report-print-area table{' +
      'page-break-inside:auto!important;' +
      'break-inside:auto!important;' +
      '}' +
      '#visual-report-print-area thead{' +
      'display:table-header-group!important;' +
      '}' +
      '#visual-report-print-area tfoot{' +
      'display:table-footer-group!important;' +
      '}' +
      '#visual-report-print-area tr{' +
      'page-break-inside:avoid!important;' +
      'break-inside:avoid-page!important;' +
      'page-break-after:auto!important;' +
      '}' +
      '#visual-report-print-area th,' +
      '#visual-report-print-area td{' +
      'page-break-inside:avoid!important;' +
      'break-inside:avoid-page!important;' +
      '}' +
      '@page{' +
      'size:A4 portrait;' +
      'margin:10mm;' +
      '}' +
      '/* CEYLIN_PRINT_TABLE_COLUMN_WIDTH_V2 */' +
      '#visual-report-print-area table{' +
      'width:100%!important;' +
      'table-layout:fixed!important;' +
      'border-collapse:collapse!important;' +
      '}' +
      '#visual-report-print-area table th,' +
      '#visual-report-print-area table td{' +
      'padding:2px 2px!important;' +
      'font-size:7.2px!important;' +
      'line-height:1.15!important;' +
      'word-break:normal!important;' +
      'overflow-wrap:break-word!important;' +
      'white-space:normal!important;' +
      'hyphens:none!important;' +
      'vertical-align:middle!important;' +
      '}' +
      '#visual-report-print-area table th:nth-child(1),' +
      '#visual-report-print-area table td:nth-child(1){width:4%!important;}' +
      '#visual-report-print-area table th:nth-child(2),' +
      '#visual-report-print-area table td:nth-child(2){width:12%!important;}' +
      '#visual-report-print-area table th:nth-child(3),' +
      '#visual-report-print-area table td:nth-child(3){width:12%!important;}' +
      '#visual-report-print-area table th:nth-child(4),' +
      '#visual-report-print-area table td:nth-child(4){width:9%!important;}' +
      '#visual-report-print-area table th:nth-child(5),' +
      '#visual-report-print-area table td:nth-child(5){width:9%!important;}' +
      '#visual-report-print-area table th:nth-child(6),' +
      '#visual-report-print-area table td:nth-child(6){width:8%!important;}' +
      '#visual-report-print-area table th:nth-child(7),' +
      '#visual-report-print-area table td:nth-child(7){width:8%!important;}' +
      '#visual-report-print-area table th:nth-child(8),' +
      '#visual-report-print-area table td:nth-child(8){width:7%!important;}' +
      '#visual-report-print-area table th:nth-child(9),' +
      '#visual-report-print-area table td:nth-child(9){width:7%!important;}' +
      '#visual-report-print-area table th:nth-child(10),' +
      '#visual-report-print-area table td:nth-child(10){width:10%!important;}' +
      '#visual-report-print-area table th:nth-child(11),' +
      '#visual-report-print-area table td:nth-child(11){width:14%!important;}' +
      '/* CEYLIN_MEASUREMENT_CARD_PRINT_KEEP_V1 */' +
      '#visual-report-print-area .measurement-card{' +
      'page-break-inside:avoid!important;' +
      'break-inside:avoid-page!important;' +
      'display:block!important;' +
      '}' +
      '#visual-report-print-area .measurement-card h4{' +
      'page-break-after:avoid!important;' +
      'break-after:avoid-page!important;' +
      '}' +
      '#visual-report-print-area .measurement-card .print-svg{' +
      'page-break-before:avoid!important;' +
      'break-before:avoid-page!important;' +
      '}' +
      '</style>' +
      '</head>' +
      '<body>' +
      printArea.outerHTML +
      '</body>' +
      '</html>'
    );
    frameDocument.close();

    const cleanup = () => {
      window.setTimeout(
        () => {
          printFrame.remove();
        },
        1000
      );
    };

    const runPrint = () => {
      frameWindow.focus();
      frameWindow.print();
      cleanup();
    };

    if (
      frameDocument.readyState ===
      'complete'
    ) {
      window.setTimeout(runPrint, 300);
    } else {
      printFrame.addEventListener(
        'load',
        () => {
          window.setTimeout(runPrint, 300);
        },
        { once: true }
      );
    }
  };

  const handleWhatsAppShare = async () => {
    try {
      setIsGeneratingPdf(true);
      const pdfFile = await generateVisualReportPdfFile();

      // Web Share API with files support
      if (pdfFile && navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        try {
          await navigator.share({
            title: 'CEYLİN ERP',
            files: [pdfFile]
          });
        } catch (err) {
          console.error('Share error:', err);
          fallbackWhatsApp(pdfFile);
        }
      } else {
        fallbackWhatsApp(pdfFile);
      }
    } catch (error) {
      console.error('PDF generate/share error:', error);
      alert('PDF oluşturulamadı veya paylaşılamadı.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const fallbackWhatsApp = (file: File) => {
    if (typeof window === 'undefined') return;
    const wpUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(
      `CEYLİN ERP - ${customer.name} ölçü raporu hazır.`
    )}`;
    window.open(wpUrl, '_blank');

    // Also trigger local download as fallback
    if (file) {
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      alert("Bu cihaz PDF dosya paylaşımını doğrudan desteklemiyor. PDF indirildi, WhatsApp'tan dosya olarak gönderebilirsiniz.");
    } else {
      alert("PDF oluşturulamadı.");
    }
  };

  return (
    <div data-visual-report-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto print:bg-white print:p-0 print:block">
      {/* Injecting print-specific CSS directly via style tag to isolate print layout */}
      <style>{`
        @media print {
          /* CEYLIN_PRINT_TABLE_READABILITY_V1 */
          #visual-report-print-area table {
            width: 100% !important;
            table-layout: auto !important;
            border-collapse: collapse !important;
          }

          #visual-report-print-area table th,
          #visual-report-print-area table td {
            padding: 3px 4px !important;
            font-size: 8px !important;
            line-height: 1.2 !important;
            word-break: normal !important;
            overflow-wrap: normal !important;
            white-space: normal !important;
            hyphens: none !important;
            vertical-align: middle !important;
          }

          #visual-report-print-area table th {
            font-weight: 800 !important;
            text-align: center !important;
          }

          #visual-report-print-area table td {
            text-align: center !important;
          }

          #visual-report-print-area table th:first-child,
          #visual-report-print-area table td:first-child {
            width: 24px !important;
            min-width: 24px !important;
          }

          #visual-report-print-area table th:nth-child(2),
          #visual-report-print-area table td:nth-child(2) {
            min-width: 52px !important;
          }

          #visual-report-print-area table th:nth-child(3),
          #visual-report-print-area table td:nth-child(3) {
            min-width: 58px !important;
          }

          #visual-report-print-area table th:nth-child(n+4),
          #visual-report-print-area table td:nth-child(n+4) {
            min-width: 42px !important;
          }

          /* CEYLIN_VISUAL_REPORT_PRINT_FLOW_V1 */
          html,
          body {
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
          }

          [data-visual-report-modal="true"] {
            position: static !important;
            inset: auto !important;
            display: block !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            padding: 0 !important;
            background: #ffffff !important;
            backdrop-filter: none !important;
          }

          [data-visual-report-modal="true"] > div {
            position: static !important;
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }

          [data-visual-report-modal="true"] > div > div {
            position: static !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
          }

          #visual-report-print-area {
            position: static !important;
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            transform: none !important;
            contain: none !important;
          }

          #visual-report-print-area .measurement-card,
          #visual-report-print-area .pdf-keep-together {
            break-inside: avoid-page !important;
            page-break-inside: avoid !important;
          }

          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          /* Hide everything except the print container */
          body * {
            visibility: hidden !important;
          }
          .no-print {
            display: none !important;
          }
          #visual-report-print-area, #visual-report-print-area * {
            visibility: visible !important;
          }
          #visual-report-print-area {
            visibility: visible !important;
            position: relative !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 190mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
            background: white !important;
            color: black !important;
            box-sizing: border-box !important;
            overflow: visible !important;
            box-shadow: none !important;
            border: none !important;
          }
          .room-section {
            page-break-inside: auto !important;
            break-inside: auto !important;
            margin-bottom: 30px !important;
          }
          .measurement-card {
            border: 1px solid #cbd5e1 !important;
            padding: 16px !important;
            margin-bottom: 20px !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            border-radius: 8px !important;
            background: white !important;
            box-sizing: border-box !important;
          }
          h3.room-header, h4.opening-header {
            page-break-after: avoid !important;
            break-after: avoid !important;
            margin-top: 15px !important;
            margin-bottom: 10px !important;
          }
          .print-svg {
            max-width: 100% !important;
            height: auto !important;
          }
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .flex-wrap {
            display: block !important;
          }
          * {
            overflow-wrap: break-word !important;
            word-break: break-word !important;
          }
        }
      `}</style>

      <div className="bg-slate-900 border border-slate-800 w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-fade-in text-white print:shadow-none print:border-none print:max-h-none print:overflow-visible">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40 no-print">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <span>Görsel Ölçü Raporu</span>
            </h2>
            <p className="text-xs text-slate-400">Yazdırılabilir saha ve üretim teknik raporu.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleWhatsAppShare}
              disabled={isGeneratingPdf}
              className="px-4 py-2 rounded-xl bg-green-650 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />} Paylaş
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" /> Yazdır / PDF Al
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body / Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-950/20 print:p-0 print:overflow-visible print:bg-white">
          <div id="visual-report-print-area" className="bg-slate-900 text-white font-sans max-w-4xl mx-auto rounded-xl p-6 border border-slate-800 shadow-sm print:border-none print:shadow-none print:p-0 print:bg-white print:text-black">

            {/* Report Header Title */}
            <div className="text-center pb-6 border-b border-slate-800 print:border-slate-300">
              <h1 className="text-2xl font-black tracking-wider text-blue-500 print:text-blue-700">CEYLİN ERP</h1>
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 print:text-slate-600 mt-1">Saha Ölçü Raporu</h2>
            </div>

            {/* Customer Information Block */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-6 border-b border-slate-800 print:border-slate-300 text-sm print:text-xs">
              <div className="space-y-1.5">
                <p><span className="text-slate-400 print:text-slate-600 font-medium">Müşteri:</span> <span className="font-bold text-slate-100 print:text-black">{customer.name}</span></p>
                <p><span className="text-slate-400 print:text-slate-600 font-medium">Telefon:</span> <span className="font-semibold text-slate-200 print:text-black">{customer.phone || '-'}</span></p>
                <p><span className="text-slate-400 print:text-slate-600 font-medium">Adres:</span> <span className="text-slate-200 print:text-black">{customer.address || customer.mapLocation || '-'}</span></p>
              </div>
              <div className="space-y-1.5 md:text-right print:text-left">
                <p><span className="text-slate-400 print:text-slate-600 font-medium">Rapor Tarihi:</span> <span className="text-slate-200 print:text-black">{new Date().toLocaleString('tr-TR')}</span></p>
                {sameMeasuredBy && (
                  <p><span className="text-slate-400 print:text-slate-600 font-medium">Ölçüyü Alan:</span> <span className="font-semibold text-blue-400 print:text-blue-700">{sameMeasuredBy}</span></p>
                )}
              </div>
            </div>

            {/* Room Iteration */}
            <div className="py-6 space-y-8">
              {(!customer.rooms || customer.rooms.length === 0) ? (
                <p className="text-center text-slate-400 print:text-slate-600 py-8 italic text-sm">Oda ve ölçü kaydı bulunmuyor.</p>
              ) : (
                customer.rooms.map((room, roomIdx) => {
                  const windows = room.windows || [];

                  // Split products inside room into plicell, mechanical curtain, and standard using active selectedProducts
                  const plicellProducts: { p: MeasurementRecord; index: number; winName: string }[] = [];
                  const mechanicalCurtainProducts: { p: MeasurementRecord; index: number; winName: string }[] = [];
                  const standardOpenings: { winName: string; winItem: WindowItem; products: MeasurementRecord[] }[] = [];

                  let plicellCounter = 0;
                  let mechanicalCurtainCounter = 0;
                  windows.forEach(win => {
                    const winMeasurements = activeMeasurements.filter(m => m.windowId === win.id);
                    winMeasurements.forEach(m => {
                      const activeProducts = m.selectedProducts?.filter(sp => sp.isActive) || [];

                      if (activeProducts.length === 0) {
                        // Fallback
                        const fallbackGroup = resolveMeasurementProductGroup(m);
                        if (fallbackGroup === 'Plicell') {
                          plicellProducts.push({ p: m, index: ++plicellCounter, winName: win.name });
                        } else if (fallbackGroup === 'Mekanik Perde') {
                          mechanicalCurtainProducts.push({ p: m, index: ++mechanicalCurtainCounter, winName: win.name });
                        } else {
                          let entry = standardOpenings.find(so => so.winName === win.name);
                          if (!entry) {
                            entry = { winName: win.name, winItem: win, products: [] };
                            standardOpenings.push(entry);
                          }
                          entry.products.push(m);
                        }
                      } else {
                        activeProducts.forEach(ap => {
                          const pType = ap.productType;
                          const pGroup = resolveMeasurementProductGroup({ productType: pType });

                          const pObj: MeasurementRecord = {
                            ...m,
                            productType: pType,
                            productGroup: pGroup,
                            selectedProducts: [ap],
                            details: {
                              ...m.details,
                              ...ap.calculation
                            }
                          };

                          if (pType === 'PLICELL') {
                            plicellProducts.push({ p: pObj, index: ++plicellCounter, winName: win.name });
                          } else if (pGroup === 'Mekanik Perde') {
                            if (ap.calculation?.isSegmented && Array.isArray(ap.calculation.groups) && ap.calculation.groups.length > 0) {
                              ap.calculation.groups.forEach((g: any, gIdx: number) => {
                                const gObj: MeasurementRecord = {
                                  ...m,
                                  id: `${m.id}-group-${gIdx}`,
                                  productType: pType,
                                  productGroup: pGroup,
                                  selectedProducts: [
                                    {
                                      ...ap,
                                      calculation: {
                                        ...ap.calculation,
                                        realWidthCm: Number(g.realWidthCm || 0),
                                        realHeightCm: Number(g.realHeightCm || 0),
                                        actualWidthCm: Number(g.realWidthCm || 0),
                                        actualHeightCm: Number(g.realHeightCm || 0),
                                        billingWidthCm: Number(g.calculatedWidthCm || 0),
                                        billingHeightCm: Number(g.calculatedHeightCm || 0),
                                        calculatedWidthCm: Number(g.calculatedWidthCm || 0),
                                        calculatedHeightCm: Number(g.calculatedHeightCm || 0),
                                        quantity: Number(g.quantity || 1),
                                        unitM2: Number(g.unitM2 || 0),
                                        totalM2: Number(g.totalM2 || 0),
                                        totalSystemM2: Number(g.totalM2 || 0),
                                        chainDirection: g.chainDirection
                                      }
                                    }
                                  ],
                                  rawValues: {
                                    ...m.rawValues,
                                    width: g.realWidthCm,
                                    height: g.realHeightCm,
                                    quantity: g.quantity
                                  },
                                  details: {
                                    ...m.details,
                                    ...ap.calculation,
                                    billingWidth: g.calculatedWidthCm,
                                    billingHeight: g.calculatedHeightCm,
                                    totalM2: g.totalM2,
                                    chainDirection: g.chainDirection
                                  }
                                };
                                mechanicalCurtainProducts.push({ p: gObj, index: ++mechanicalCurtainCounter, winName: `${win.name} - Parça ${gIdx + 1}` });
                              });
                            } else {
                              mechanicalCurtainProducts.push({ p: pObj, index: ++mechanicalCurtainCounter, winName: win.name });
                            }
                          } else {
                            let entry = standardOpenings.find(so => so.winName === win.name);
                            if (!entry) {
                              entry = { winName: win.name, winItem: win, products: [] };
                              standardOpenings.push(entry);
                            }
                            entry.products.push(pObj);
                          }
                        });
                      }
                    });
                  });

                  const hasAnyProducts = plicellProducts.length > 0 || mechanicalCurtainProducts.length > 0 || standardOpenings.length > 0;

                  return (
                    <div key={room.id} className="space-y-4 room-section">
                      {/* Room Header */}
                      <h3 className="room-header text-md font-bold text-slate-100 print:text-black border-l-4 border-blue-500 print:border-blue-700 pl-3 flex items-center justify-between">
                        <span>{roomIdx + 1}. ODA: {room.name}</span>
                        {(room.photos?.length > 0 || room.videos?.length > 0) && (
                          <span className="text-[10px] font-normal text-slate-400 print:text-slate-500">
                            ({(room.photos||[]).length} Foto, {(room.videos||[]).length} Video eklenmiş)
                          </span>
                        )}
                      </h3>

                      {!hasAnyProducts ? (
                        <p className="text-xs text-slate-400 print:text-slate-600 pl-4 italic">Bu oda için ölçü detayı yok.</p>
                      ) : (
                        <div className="space-y-6 pl-2">

                          {/* A. Render Standard Openings */}
                          {standardOpenings.map(({ winName, winItem, products }) => {
                            const showWinHeader = windows.length > 1;

                            return (
                              <div key={winItem.id} className="space-y-4">
                                {showWinHeader && (
                                  <h4 className="opening-header text-xs font-bold text-slate-400 print:text-slate-600 border-b border-slate-800 print:border-slate-200 pb-1 flex items-center justify-between">
                                    <span>[Açıklık: {winName}]</span>
                                    {(winItem.photos?.length > 0 || winItem.videos?.length > 0) && (
                                      <span className="text-[9px] font-normal">
                                        ({(winItem.photos||[]).length} Foto, {(winItem.videos||[]).length} Video)
                                      </span>
                                    )}
                                  </h4>
                                )}

                                {(() => {
                                  const firstMeasurement = products[0];

                                  if (!firstMeasurement) {
                                    return null;
                                  }

                                  const isGeneralSimple =
                                    firstMeasurement.templateType ===
                                    'SIMPLE_WIDTH_HEIGHT';

                                  const isGeneralCurtain =
                                    firstMeasurement.templateType ===
                                      'CURTAIN_DETAIL' ||
                                    firstMeasurement.templateType ===
                                      'CURTAIN';

                                  if (
                                    !isGeneralSimple &&
                                    !isGeneralCurtain
                                  ) {
                                    return null;
                                  }

                                  const generalSegments =
                                    Array.isArray(
                                      firstMeasurement.rawValues
                                        ?.facadeSegments
                                    )
                                      ? firstMeasurement.rawValues
                                          .facadeSegments
                                      : [];

                                  const generalWidth =
                                    isGeneralSimple
                                      ? Number(
                                          firstMeasurement.rawValues
                                            ?.width || 0
                                        )
                                      : Number(
                                          firstMeasurement.rawValues
                                            ?.windowWidth || 0
                                        );

                                  const generalHeight =
                                    isGeneralSimple
                                      ? Number(
                                          firstMeasurement.rawValues
                                            ?.height || 0
                                        )
                                      : Number(
                                          firstMeasurement.rawValues
                                            ?.windowHeight || 0
                                        );

                                  const generalTotalWidth =
                                    generalSegments.length > 0
                                      ? generalSegments.reduce(
                                          (
                                            total: number,
                                            segment: any
                                          ) =>
                                            total +
                                            Math.max(
                                              0,
                                              Number(
                                                segment.widthCm ||
                                                  0
                                              )
                                            ),
                                          0
                                        )
                                      : generalWidth;

                                  const generalProductTypes =
                                    Array.from(
                                      new Set(
                                        products.flatMap(
                                          measurement =>
                                            (
                                              measurement.selectedProducts ||
                                              []
                                            )
                                              .filter(
                                                product =>
                                                  product.isActive
                                              )
                                              .map(product =>
                                                String(
                                                  product.productType ||
                                                    ''
                                                )
                                              )
                                        )
                                      )
                                    ).filter(Boolean);

                                  if (
                                    generalProductTypes.length === 0
                                  ) {
                                    return null;
                                  }

                                  return (
                                    <div className="pdf-keep-together mb-6 rounded-xl border-2 border-blue-200 bg-blue-50/40 p-5 print:border-slate-400 print:bg-white">
                                      <div className="mb-3">
                                        <h4 className="text-sm font-black text-blue-900 print:text-black">
                                          {winName} — Genel Ürün Görseli
                                        </h4>
                                        <p className="text-[10px] text-blue-700 print:text-slate-600">
                                          Açıklıktaki tüm aktif ürünler tek
                                          cephe üzerinde gösterilir.
                                        </p>
                                      </div>

                                      <TechnicalMeasurementSketch
                                        facadeSegments={
                                          generalSegments
                                        }
                                        width={generalWidth}
                                        height={generalHeight}
                                        totalFacadeWidthCm={
                                          generalTotalWidth
                                        }
                                        kartonpiyerBoslukCm={Number(
                                          firstMeasurement.rawValues
                                            ?.kartonpiyerBoslukCm ||
                                            firstMeasurement.rawValues
                                              ?.ceilingGap ||
                                            0
                                        )}
                                        camUstuCm={Number(
                                          firstMeasurement.rawValues
                                            ?.camUstuCm || 0
                                        )}
                                        camIciCm={Number(
                                          firstMeasurement.rawValues
                                            ?.camIciCm ||
                                            firstMeasurement.rawValues
                                              ?.windowHeight ||
                                            0
                                        )}
                                        kaloriferMermerBoyuCm={Number(
                                          firstMeasurement.rawValues
                                            ?.kaloriferMermerBoyuCm ||
                                            0
                                        )}
                                        camAltiCm={Number(
                                          firstMeasurement.rawValues
                                            ?.camAltiCm ||
                                            firstMeasurement.rawValues
                                              ?.floorGap ||
                                            0
                                        )}
                                        solYukseklikCm={Number(
                                          firstMeasurement.rawValues
                                            ?.solYukseklikCm || 0
                                        )}
                                        ortaYukseklikCm={Number(
                                          firstMeasurement.rawValues
                                            ?.ortaYukseklikCm || 0
                                        )}
                                        sagYukseklikCm={Number(
                                          firstMeasurement.rawValues
                                            ?.sagYukseklikCm || 0
                                        )}
                                        productTypes={
                                          generalProductTypes
                                        }
                                        fonPlacement={                                           getSketchFonPlacement(                                             products                                           )                                         }
                                        productHeights={getGeneralSketchProductHeights(                                           products,                                           firstMeasurement                                         )}
                                        mechanicalPanels={buildMechanicalVisualPanels(getSameOpeningMeasurements(activeMeasurements, firstMeasurement))}
                                      />
                                    </div>
                                  );
                                })()}

                                <div className="flex flex-wrap gap-6 print:block">
                                  {products.map((p, pIdx) => {
                                    const isSimple = p.templateType === 'SIMPLE_WIDTH_HEIGHT';
                                    const isCurtain = p.templateType === 'CURTAIN_DETAIL' || p.templateType === 'CURTAIN';

                                    let segmentsToDraw = [];
                                    let widthToDraw = 0;
                                    let heightToDraw = 0;
                                    let totalWidth = 0;

                                    /*
                                     * Aynı açıklıktaki tüm aktif ürünler
                                     * tek görsel üzerinde renk katmanı olarak gösterilir.
                                     */
                                    const selectedProductTypes =
                                      Array.from(
                                        new Set(
                                          activeMeasurements
                                            .filter(
                                              measurement =>
                                                measurement.windowId ===
                                                p.windowId
                                            )
                                            .flatMap(
                                              measurement =>
                                                (
                                                  measurement.selectedProducts ||
                                                  []
                                                )
                                                  .filter(
                                                    product =>
                                                      product.isActive
                                                  )
                                                  .map(
                                                    product =>
                                                      String(
                                                        product.productType ||
                                                        ''
                                                      )
                                                  )
                                            )
                                            .filter(Boolean)
                                        )
                                      );

                                    if (isSimple) {
                                      widthToDraw = Number(p.rawValues?.width || 0);
                                      heightToDraw = Number(p.rawValues?.height || 0);
                                      totalWidth = widthToDraw;
                                    } else if (isCurtain) {
                                      const facadeSegments = p.rawValues?.facadeSegments;
                                      if (facadeSegments && Array.isArray(facadeSegments) && facadeSegments.length > 0) {
                                        segmentsToDraw = facadeSegments;
                                        totalWidth = facadeSegments.reduce((sum: number, s: any) => sum + (Number(s.widthCm) > 0 ? Number(s.widthCm) : 0), 0);
                                      } else {
                                        widthToDraw = Number(p.rawValues?.windowWidth || 0);
                                        heightToDraw = Number(p.rawValues?.windowHeight || 0);
                                        totalWidth = widthToDraw;
                                      }

                                      if (segmentsToDraw.length > 0 && totalWidth === 0) {
                                        totalWidth = segmentsToDraw.reduce((sum: number, s: any) => sum + (Number(s.widthCm) > 0 ? Number(s.widthCm) : 0), 0);
                                      }
                                    }

                                    return (
                                      <div key={`${p.id}-${p.productType || p.productGroup || pIdx}`} className="measurement-card pdf-keep-together w-full xl:w-[calc(50%-12px)] print:w-full mb-6 print:mb-8 bg-white print:bg-white rounded-lg p-5 shadow-sm border border-slate-200 print:border-none">
                                        <div className="flex justify-between items-start mb-3">
                                          <div>
                                            <h4 className="text-sm font-bold text-slate-800 print:text-black">
                                              {winName} - Ölçü {pIdx + 1}: {resolveMeasurementProductLabel(p)} ({getTemplateLabel(p.templateType)})
                                            </h4>
                                            <div className="text-[10px] text-slate-500 mt-1 flex flex-wrap gap-x-3">
                                              {!sameMeasuredBy && p.measuredBy && <span>Ölçen: {p.measuredBy}</span>}
                                              {showDateOnMeasurements && p.measuredDate && <span>Tarih: {new Date(p.measuredDate).toLocaleDateString('tr-TR')}</span>}
                                              {(p.photos?.length > 0 || p.videos?.length > 0) && (
                                                <span className="text-blue-600">📷 {(p.photos||[]).length} Foto, {(p.videos||[]).length} Video</span>
                                              )}
                                            </div>
                                          </div>
                                        </div>

                                        {(() => {
                                          const validNote = getValidNote(p.notes);
                                          if (!validNote) return null;
                                          return (
                                            <div className="mb-4 p-2.5 rounded bg-amber-50 border border-amber-200 text-xs text-amber-900 print:bg-white print:border-slate-300 print:text-black">
                                              <span className="font-bold text-[9.5px] uppercase block mb-0.5">Saha Notu:</span>
                                              {validNote}
                                            </div>
                                          );
                                        })()}

                                        <div className="w-full flex justify-center mt-2 print:mt-4">
                                          {isSimple || isCurtain ? (
                                            <div
                                              className="cursor-pointer hover:opacity-90 transition-opacity w-full print-svg"
                                              onClick={() => setPreviewNode(
                                                <div className="w-full h-full min-h-[50vh] flex items-center justify-center p-4 bg-white rounded-lg">
                                                  <TechnicalMeasurementSketch
                                                    facadeSegments={segmentsToDraw}
                                                    width={widthToDraw}
                                                    height={heightToDraw}
                                                    totalFacadeWidthCm={totalWidth}
                                                    kartonpiyerBoslukCm={Number(p.rawValues?.kartonpiyerBoslukCm || p.rawValues?.ceilingGap || 0)}
                                                    camUstuCm={Number(p.rawValues?.camUstuCm || 0)}
                                                    camIciCm={Number(p.rawValues?.camIciCm || p.rawValues?.windowHeight || 0)}
                                                    kaloriferMermerBoyuCm={Number(p.rawValues?.kaloriferMermerBoyuCm || 0)}
                                                    camAltiCm={Number(p.rawValues?.camAltiCm || p.rawValues?.floorGap || 0)}
                                                    solYukseklikCm={Number(p.rawValues?.solYukseklikCm || 0)}
                                                    ortaYukseklikCm={Number(p.rawValues?.ortaYukseklikCm || 0)}
                                                    sagYukseklikCm={Number(p.rawValues?.sagYukseklikCm || 0)}
                                                    productTypes={getSketchProductTypes([p], p)}
                                                    fonPlacement={getSketchFonPlacement([p])}
                                                    productHeights={getSketchProductHeights([p], p)}
                                                    suppressFacadeHeight={shouldSuppressSunshadeFacadeHeight(p)}
                                        mechanicalPanels={buildMechanicalVisualPanels([p])}
                                      />
                                                </div>
                                              )}
                                            >
                                              <TechnicalMeasurementSketch
                                                facadeSegments={segmentsToDraw}
                                                width={widthToDraw}
                                                height={heightToDraw}
                                                totalFacadeWidthCm={totalWidth}
                                                kartonpiyerBoslukCm={Number(p.rawValues?.kartonpiyerBoslukCm || p.rawValues?.ceilingGap || 0)}
                                                camUstuCm={Number(p.rawValues?.camUstuCm || 0)}
                                                camIciCm={Number(p.rawValues?.camIciCm || p.rawValues?.windowHeight || 0)}
                                                kaloriferMermerBoyuCm={Number(p.rawValues?.kaloriferMermerBoyuCm || 0)}
                                                camAltiCm={Number(p.rawValues?.camAltiCm || p.rawValues?.floorGap || 0)}
                                                solYukseklikCm={Number(p.rawValues?.solYukseklikCm || 0)}
                                                ortaYukseklikCm={Number(p.rawValues?.ortaYukseklikCm || 0)}
                                                sagYukseklikCm={Number(p.rawValues?.sagYukseklikCm || 0)}
                                                productTypes={getSketchProductTypes([p], p)}
                                                fonPlacement={getSketchFonPlacement([p])}
                                                productHeights={getSketchProductHeights([p], p)}
                                                suppressFacadeHeight={shouldSuppressSunshadeFacadeHeight(p)}
                                        mechanicalPanels={buildMechanicalVisualPanels([p])}
                                      />
                                            </div>
                                          ) : (
                                            <div className="w-full grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                                              {Object.entries(p.rawValues || {}).map(([k, v]) => {
                                                const template = MEASUREMENT_TEMPLATES[p.templateType];
                                                const label = template?.fields.find((f: any) => f.key === k)?.label || k;
                                                return (
                                                  <div key={k} className="bg-slate-50 print:bg-white p-2 rounded border border-slate-200 print:border-slate-300">
                                                    <span className="text-[9px] text-slate-500 block uppercase font-medium">{label}</span>
                                                    <span className="font-bold text-slate-800 print:text-black">{String(v)}</span>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}

                          {/* B. Render Plicell Group */}
                          {plicellProducts.length > 0 && (
                            <div className="space-y-4">
                              {plicellProducts.map(({ p, index, winName }) => {
                                const camListesi = p.rawValues?.plicellCamListesi;

                                if (camListesi && Array.isArray(camListesi) && camListesi.length > 0) {
                                  const validCamListesi = camListesi.filter((cam: any) => Number(cam.widthCm) > 0 && Number(cam.heightCm) > 0);

                                  if (validCamListesi.length === 0) {
                                    return (
                                      <div key={`${p.id}-plicell-empty-${index}`} className="measurement-card bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6 print:mb-8 print:border-slate-200 print:bg-white">
                                        <h4 className="text-sm font-bold text-slate-800 print:text-black mb-2">
                                          {winName} - Ölçü {index}: {resolveMeasurementProductLabel(p)} (Plicell Cam İçi)
                                        </h4>
                                        <div className="p-4 bg-slate-50 border border-slate-200 text-slate-500 italic text-sm rounded">
                                          Geçerli Plicell cam ölçüsü girilmemiş.
                                        </div>
                                      </div>
                                    );
                                  }

                                  const ortakBoy = Number(p.rawValues?.ortakCamBoyuCm || 0);
                                  const profilRengi = p.rawValues?.profilRengi || '';
                                  const camAdedi = validCamListesi.length;
                                  const storedPlicellCalculation =
                                    getStoredProductCalculation(
                                      p,
                                      'PLICELL'
                                    );

                                  const storedPlicellCams = Array.isArray(
                                    storedPlicellCalculation.cams
                                  )
                                    ? storedPlicellCalculation.cams
                                    : Array.isArray(
                                        storedPlicellCalculation.groups
                                      )
                                      ? storedPlicellCalculation.groups
                                      : [];

                                  const storedPlicellQuantity = Math.max(
                                    1,
                                    Number(
                                      storedPlicellCalculation.quantity ??
                                      p.rawValues?.quantity ??
                                      1
                                    )
                                  );

                                  const storedPlicellTotalM2 = Number(
                                    storedPlicellCalculation.totalSystemM2 ??
                                    storedPlicellCalculation.totalM2 ??
                                    0
                                  );

                                  globalPlicellCount +=
                                    storedPlicellCams.length *
                                    storedPlicellQuantity;

                                  globalPlicellM2 +=
                                    storedPlicellTotalM2;

                                  return (
                                    <div key={`${p.id}-plicell-${index}`} className="measurement-card bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 mb-6 print:mb-8 shadow-sm">
                                      <h4 className="text-sm font-bold text-slate-800 print:text-black mb-2">
                                        {winName} - Ölçü {index}: {resolveMeasurementProductLabel(p)} (Plicell Cam İçi)
                                      </h4>
                                      <div
                                        className="cursor-pointer hover:opacity-90 transition-opacity print-svg"
                                        onClick={() => setPreviewNode(
                                          <div className="w-full max-w-3xl mx-auto p-4 bg-white rounded-lg overflow-y-auto max-h-[80vh]">
                                            <PlicellMeasurementSketch
                                              camAdedi={camAdedi}
                                              ortakCamBoyuCm={ortakBoy}
                                              profilRengi={profilRengi}
                                              plicellCamListesi={validCamListesi}
                                              calculation={storedPlicellCalculation}
                                            />
                                          </div>
                                        )}
                                      >
                                        <PlicellMeasurementSketch
                                          camAdedi={camAdedi}
                                          ortakCamBoyuCm={ortakBoy}
                                          profilRengi={profilRengi}
                                          plicellCamListesi={validCamListesi}
                                          calculation={storedPlicellCalculation}
                                        />
                                      </div>
                                    </div>
                                  );
                                } else {
                                  // Eski format: Tek cam
                                  const w = Number(p.rawValues?.glassWidth || 0);
                                  const h = Number(p.rawValues?.glassHeight || 0);
                                  const storedPlicellCalculation =
                                    getStoredProductCalculation(
                                      p,
                                      'PLICELL'
                                    );

                                  const storedPlicellCams = Array.isArray(
                                    storedPlicellCalculation.cams
                                  )
                                    ? storedPlicellCalculation.cams
                                    : Array.isArray(
                                        storedPlicellCalculation.groups
                                      )
                                      ? storedPlicellCalculation.groups
                                      : [];

                                  const storedPlicellQuantity = Math.max(
                                    1,
                                    Number(
                                      storedPlicellCalculation.quantity ??
                                      p.rawValues?.quantity ??
                                      1
                                    )
                                  );

                                  const storedPlicellTotalM2 = Number(
                                    storedPlicellCalculation.totalSystemM2 ??
                                    storedPlicellCalculation.totalM2 ??
                                    0
                                  );

                                  globalPlicellCount +=
                                    storedPlicellCams.length *
                                    storedPlicellQuantity;

                                  globalPlicellM2 +=
                                    storedPlicellTotalM2;

                                  const singleCamItem = {
                                    widthCm: w,
                                    heightCm: h,
                                    note: p.notes
                                  };

                                  return (
                                    <div key={`${p.id}-plicell-${index}`} className="measurement-card bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 mb-6 print:mb-8 shadow-sm">
                                      <h4 className="text-sm font-bold text-slate-800 print:text-black mb-2">
                                        {winName} - Ölçü {index}: {resolveMeasurementProductLabel(p)} (Plicell Cam İçi)
                                      </h4>
                                      <div
                                        className="cursor-pointer hover:opacity-90 transition-opacity print-svg"
                                        onClick={() => setPreviewNode(
                                          <div className="w-full max-w-3xl mx-auto p-4 bg-white rounded-lg overflow-y-auto max-h-[80vh]">
                                            <PlicellMeasurementSketch
                                              camAdedi={1}
                                              ortakCamBoyuCm={h}
                                              plicellCamListesi={[singleCamItem]}
                                              calculation={storedPlicellCalculation}
                                            />
                                          </div>
                                        )}
                                      >
                                        <PlicellMeasurementSketch
                                          camAdedi={1}
                                          ortakCamBoyuCm={h}
                                          plicellCamListesi={[singleCamItem]}
                                          calculation={storedPlicellCalculation}
                                        />
                                      </div>
                                    </div>
                                  );
                                }
                              })}
                            </div>
                          )}

                          {/* C. Render Mechanical Curtain Group (Tablo) */}
                          {mechanicalCurtainProducts.length > 0 && (
                            <div className="space-y-3 mt-4 measurement-card bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6 print:mb-8 print:border-slate-200 print:bg-white">
                              <h4 className="opening-header text-xs font-bold text-slate-400 print:text-slate-600 border-b border-slate-800 print:border-slate-200 pb-1">
                                [Ölçü Grubu: Mekanik Perde Ölçüsü]
                              </h4>

                              <div className="overflow-x-auto rounded-lg border border-slate-850 print:border-slate-200">
                                <table className="w-full text-xs text-left border-collapse">
                                  <thead>
                                    <tr className="bg-slate-950/60 print:bg-slate-100 text-slate-400 print:text-slate-700 font-bold border-b border-slate-850 print:border-slate-200">
                                      <th className="p-2.5 text-center w-12">No</th>
                                      <th className="p-2.5">Açıklık Adı</th>
                                      <th className="p-2.5">Ürün Tipi</th>
                                      <th className="p-2.5 text-right">Gerçek En</th>
                                      <th className="p-2.5 text-right">Gerçek Boy</th>
                                      <th className="p-2.5 text-right">Hesap En</th>
                                      <th className="p-2.5 text-right">Hesap Boy</th>
                                      <th className="p-2.5 text-center w-16">Adet</th>
                                      <th className="p-2.5 text-center w-20">Zincir</th>
                                      <th className="p-2.5 text-right w-20">Birim m²</th>
                                      <th className="p-2.5 text-right w-24">Toplam m²</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(() => {
                                      let roomMechanicalM2 = 0;
                                      const notesList: { idx: number; note: string }[] = [];

                                      const rows = mechanicalCurtainProducts.map(({ p, index, winName }) => {
                                        const storedCalculation =
                                          getStoredProductCalculation(
                                            p,
                                            p.productType
                                          );

                                        const w =
                                          Number(
                                            storedCalculation.realWidthCm ??
                                            storedCalculation.actualWidthCm ??
                                            p.rawValues?.width ??
                                            0
                                          );

                                        const h =
                                          Number(
                                            storedCalculation.realHeightCm ??
                                            storedCalculation.actualHeightCm ??
                                            p.rawValues?.height ??
                                            0
                                          );

                                        const q =
                                          Math.max(
                                            1,
                                            Number(
                                              storedCalculation.quantity ??
                                              p.rawValues?.quantity ??
                                              1
                                            )
                                          );

                                        const productType =
                                          resolveMeasurementProductLabel(p);

                                        const calcWidth =
                                          Number(
                                            storedCalculation.billingWidthCm ??
                                            storedCalculation.billingWidth ??
                                            0
                                          );

                                        const calcHeight =
                                          Number(
                                            storedCalculation.billingHeightCm ??
                                            storedCalculation.billingHeight ??
                                            0
                                          );

                                        const totalM2 =
                                          Number(
                                            storedCalculation.totalM2 ??
                                            storedCalculation.totalSystemM2 ??
                                            0
                                          );

                                        const unitM2 = Number(                                           storedCalculation.unitM2 ??                                           0                                         );

                                        const chainDirection =
                                          p.details?.chainDirection ||
                                          p.selectedProducts?.[0]
                                            ?.calculation
                                            ?.chainDirection ||
                                          'RIGHT';

                                        roomMechanicalM2 += totalM2;
                                        globalMechanicalCount += q;
                                        globalMechanicalM2 += totalM2;

                                        const validMechNote = getValidNote(p.notes);
                                        if (validMechNote) {
                                          notesList.push({ idx: index, note: validMechNote });
                                        }

                                        return (
                                          <tr key={`${p.id}-${p.productType || "mechanical"}-${index}`} className="border-b border-slate-900 last:border-0 print:border-slate-200 hover:bg-slate-900/30 print:hover:bg-transparent">
                                            <td className="p-2.5 text-center font-semibold text-slate-400 print:text-slate-500">{index}</td>
                                            <td className="p-2.5 font-medium text-slate-200 print:text-black">{winName}</td>
                                            <td className="p-2.5 font-medium text-blue-400 print:text-blue-700">{productType}</td>
                                            <td className="p-2.5 text-right font-semibold">{w.toFixed(1)} cm</td>
                                            <td className="p-2.5 text-right font-semibold">{h.toFixed(1)} cm</td>
                                            <td className="p-2.5 text-right font-bold text-blue-400 print:text-blue-700">{calcWidth} cm</td>
                                            <td className="p-2.5 text-right font-bold text-blue-400 print:text-blue-700">{calcHeight} cm</td>
                                            <td className="p-2.5 text-center font-semibold">{q} Adet</td>
                                            <td className="p-2.5 text-center font-bold text-amber-400 print:text-black">
                                              {chainDirection === 'LEFT' ? 'Sol' : 'Sağ'}
                                            </td>
                                            <td className="p-2.5 text-right font-bold text-blue-400 print:text-blue-750">{unitM2.toFixed(2)} m²</td>
                                            <td className="p-2.5 text-right font-bold text-green-400 print:text-green-700">{totalM2.toFixed(2)} m²</td>
                                          </tr>
                                        );
                                      });

                                      return (
                                        <>
                                          {rows}
                                          <tr className="bg-slate-950/40 print:bg-slate-50 font-bold border-t-2 border-slate-850 print:border-slate-300">
                                            <td colSpan={3} className="p-3 text-slate-300 print:text-slate-700">Toplam Mekanik Adedi: {mechanicalCurtainProducts.reduce((acc, curr) => acc + Number(curr.p.rawValues?.quantity || 1), 0)}</td>
                                            <td colSpan={7} className="p-3 text-right text-slate-400 print:text-slate-600">Toplam Oda m²:</td>
                                            <td className="p-3 text-right text-green-400 print:text-green-700 text-sm">{roomMechanicalM2.toFixed(2)} m²</td>
                                          </tr>
                                          {notesList.length > 0 && (
                                            <tr>
                                              <td colSpan={11} className="p-3 bg-slate-950/20 border-t border-slate-900 print:border-slate-200">
                                                <div className="space-y-1 text-slate-300 print:text-slate-700">
                                                  <span className="font-bold uppercase text-[9.5px] text-amber-500 print:text-amber-700 block">Notlar:</span>
                                                  {notesList.map(n => (
                                                    <div key={n.idx} className="text-[11px]">- {n.idx}. Mekanik: <span className="font-medium text-slate-200 print:text-black">{n.note}</span></div>
                                                  ))}
                                                </div>
                                              </td>
                                            </tr>
                                          )}
                                        </>
                                      );
                                    })()}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Grand Totals Section */}
            {globalPlicellCount > 0 && (
              <div className="my-6 p-4 rounded-xl bg-slate-950/60 print:bg-slate-50 border border-slate-850 print:border-slate-300 flex justify-between items-center text-sm font-bold print:text-xs">
                <span className="text-slate-300 print:text-slate-700">Genel Plicell Rapor Toplamı:</span>
                <span className="text-green-400 print:text-green-700 text-lg print:text-sm">{globalPlicellCount} Adet Cam / {globalPlicellM2.toFixed(2)} m²</span>
              </div>
            )}

            {globalMechanicalCount > 0 && (
              <div className="my-4 p-4 rounded-xl bg-slate-950/60 print:bg-slate-50 border border-slate-850 print:border-slate-300 flex justify-between items-center text-sm font-bold print:text-xs">
                <span className="text-slate-300 print:text-slate-700">Genel Mekanik Perde Rapor Toplamı:</span>
                <span className="text-green-400 print:text-green-700 text-lg print:text-sm">{globalMechanicalCount} Adet Mekanik Perde / {globalMechanicalM2.toFixed(2)} m²</span>
              </div>
            )}

            {/* Google Maps Location */}
            {(customer.mapLocation || customer.address) && (
              <div className="py-4 border-t border-slate-800 print:border-slate-300 text-xs text-slate-400 print:text-slate-500 mt-6 flex justify-between items-center flex-wrap gap-2">
                <span>Konum: {customer.address || customer.mapLocation}</span>
                {customer.mapLocation && (
                  <span className="text-blue-400 print:text-blue-700">
                    https://maps.google.com/?q={customer.mapLocation}
                  </span>
                )}
              </div>
            )}

            {/* Document footer signature */}
            <div className="text-center text-[10px] text-slate-500 print:text-slate-600 mt-6 pt-4 border-t border-slate-850/50 print:border-slate-200">
              <p>CEYLİN ERP - Saha Pilot Uygulaması</p>
            </div>

          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 flex justify-end bg-slate-950/40">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Kapat
          </button>
        </div>
      </div>

      {/* Zoom/Preview Modal */}
      {previewNode && (
        <div
          className="fixed inset-0 z-[60] flex flex-col bg-black/95 no-print animate-fade-in"
          onClick={closePreview}
        >
          <div
            className="relative z-[70] flex items-center justify-between gap-3 border-b border-white/10 bg-black/70 px-3 py-2 sm:px-5"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-white/80">
              <Move className="h-4 w-4" />
              <span className="hidden sm:inline">
                Yakınlaştırınca sürükleyerek gezinin
              </span>
              <span className="rounded-md bg-white/10 px-2 py-1 tabular-nums text-white">
                %{Math.round(previewZoom * 100)}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  changePreviewZoom(
                    previewZoom - 0.25
                  )
                }
                disabled={previewZoom <= 1}
                className="rounded-lg bg-white/10 p-2 text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-35"
                title="Uzaklaştır"
              >
                <ZoomOut className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={resetPreviewTransform}
                className="rounded-lg bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
                title="Yakınlaştırmayı sıfırla"
              >
                <RotateCcw className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={() =>
                  changePreviewZoom(
                    previewZoom + 0.25
                  )
                }
                disabled={previewZoom >= 4}
                className="rounded-lg bg-white/10 p-2 text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-35"
                title="Yakınlaştır"
              >
                <ZoomIn className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={closePreview}
                className="ml-1 rounded-lg bg-red-500/80 p-2 text-white transition-colors hover:bg-red-500"
                title="Kapat"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div
            className="relative flex-1 overflow-hidden p-2 sm:p-5"
            onClick={(event) =>
              event.stopPropagation()
            }
            onWheel={handlePreviewWheel}
            onDoubleClick={() =>
              changePreviewZoom(
                previewZoom >= 2
                  ? 1
                  : previewZoom + 0.5
              )
            }
            onPointerDown={
              handlePreviewPointerDown
            }
            onPointerMove={
              handlePreviewPointerMove
            }
            onPointerUp={finishPreviewDrag}
            onPointerCancel={
              finishPreviewDrag
            }
            style={{
              touchAction: 'none',
              cursor:
                previewZoom > 1
                  ? isPreviewDragging
                    ? 'grabbing'
                    : 'grab'
                  : 'zoom-in'
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="w-full max-w-5xl rounded-xl bg-white shadow-2xl will-change-transform"
                style={{
                  transform:
                    `translate3d(${previewOffset.x}px, ${previewOffset.y}px, 0) scale(${previewZoom})`,
                  transformOrigin: 'center center',
                  transition:
                    isPreviewDragging
                      ? 'none'
                      : 'transform 160ms ease-out'
                }}
              >
                {previewNode}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
