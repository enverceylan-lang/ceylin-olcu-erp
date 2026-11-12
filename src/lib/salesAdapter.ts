import { Customer, ProductMeasurement } from '@/store/useStore';
import { useMeasurementStore, MeasurementRecord } from '@/store/measurementStore';
import { Sale, SaleItem } from '@/store/salesStore';
import { erpScopeMatches, type ErpScope } from '@/lib/erpScope';
import { getMeasurementDimensions, resolveMeasurementProductGroup, resolveMeasurementProductLabel } from '@/lib/measurementAdapter';
import { resolveSaleStockItemId } from '@/lib/saleStockIdentity';
import { prepareBirizSaleItemsV5 } from '@/lib/calculationEngine/birizSaleIntegration';

import {
  CALCULATION_ENGINE_VERSION,
  buildSaleCalculationLines,
  validateCalculationForSale,
  type SaleCalculationLine
} from '@/lib/calculationEngine';

type CalculationRecord = NonNullable<ProductMeasurement['details']>;

interface DraftSalesStore {
  sales: Sale[];
  addSale: (sale: Sale) => Promise<void>;
  updateSale: (sale: Sale) => Promise<void>;
}
/**
 * Ölçüden tek bir satış satırı oluşturur.
 */
function createSaleItemFromMeasurement(
  p: ProductMeasurement & { roomId?: string },
  roomName: string,
  windowName: string,
  selectedType?: string,
  salesItemOverride?: {
    productType?: string;
    label?: string;
    totalM2?: number;
    metricSize?: number;
    metricUnit?: 'm2' | 'mt' | 'adet';
    productionWidthCm?: number;
    productionHeightCm?: number;
    fabricMeters?: number;
    calculationVersion?: string;
  }
): SaleItem {
  const dims = getMeasurementDimensions(p);

  const calculation = {
    ...(p.details || {}),
    ...(p.selectedProducts?.[0]?.calculation || {})
  };

  const w = Number(
    calculation.actualWidthCm ||
    calculation.realWidthCm ||
    dims.structuralWidth ||
    0
  );

  const h = Number(
    calculation.actualHeightCm ||
    calculation.realHeightCm ||
    dims.structuralHeight ||
    0
  );

  const selectedProductType =
    salesItemOverride?.productType ||
    selectedType ||
    p.productType ||
    '';

  const stockItemId =
    resolveSaleStockItemId(
      p.selectedProducts,
      selectedProductType
    );

  const group = resolveMeasurementProductGroup({
    ...p,
    productType: selectedProductType
  });

  const label =
    salesItemOverride?.label ||
    resolveMeasurementProductLabel({
      ...p,
      productType: selectedProductType
    });

  let size = 0;
  let unit: 'm2' | 'mt' | 'adet' = 'adet';

  const typeUpper =
    String(selectedProductType).toUpperCase();

  if (salesItemOverride?.metricSize !== undefined) {
    size = Number(salesItemOverride.metricSize);
    unit = salesItemOverride.metricUnit || 'adet';
  } else if (salesItemOverride?.totalM2 !== undefined) {
    size = Number(salesItemOverride.totalM2);
    unit = 'm2';
  } else if (
    group === 'Plicell' ||
    group === 'Mekanik Perde'
  ) {
    size = Number(
      calculation.totalM2 ??
      calculation.totalSystemM2 ??
      0
    );

    unit = 'm2';
  } else if (typeUpper === 'TUL') {
    size = Number(
      calculation.fabricUsageMeters ??
      calculation.roundedMeters ??
      0
    );

    unit = 'mt';
  } else if (typeUpper === 'GUNESLIK') {
    size = Number(
      calculation.fabricUsageMeters ??
      calculation.meters ??
      0
    );

    unit = 'mt';
  } else if (typeUpper === 'FON') {
    size = Number(
      calculation.fabricUsageMeters ??
      0
    );

    unit = 'mt';
  } else if (typeUpper === 'RUSTIK') {
    size = Number(
      calculation.billingWidth !== undefined
        ? Number(calculation.billingWidth) / 100
        : 0
    );

    unit = 'mt';
  } else if (typeUpper === 'TAVAN_RUSTIK') {
    size = Number(calculation.quantity || 1);
    unit = 'adet';
  } else if (typeUpper === 'BIRIZ') {
    size = Number(
      calculation.birizTulMeters || 0
    );

    unit = 'mt';
  } else {
    const calculationLines =
      buildSaleCalculationLines(
        calculation,
        selectedProductType,
        label
      );

    const calculationLine =
      calculationLines[0];

    size = Number(
      calculationLine?.quantity || 0
    );

    unit =
      calculationLine?.unit || 'adet';
  }

  const quantity =
    unit === 'adet'
      ? Number(p.rawValues?.quantity || 1)
      : 1;

  const pleatLabel =
    calculation.pleatType ||
    calculation.pleatLabel ||
    p.rawValues?.pleat ||
    undefined;

  const systemNotes: string[] = [];

  if (calculation.systemType === 'DOUBLE') {
    systemNotes.push('Çiftli Sistem');
  }

  if (calculation.chainDirection === 'LEFT') {
    systemNotes.push('Zincir: Sol');
  } else if (calculation.chainDirection === 'RIGHT') {
    systemNotes.push('Zincir: Sağ');
  }

  if (calculation.openingType === 'DOUBLE') {
    systemNotes.push('Çift Açılır');
  } else if (calculation.openingType === 'SINGLE') {
    systemNotes.push('Tek Açılır');
  }

  const notes = [
    p.notes,
    ...systemNotes
  ].filter(Boolean);

  return {
    id: crypto.randomUUID(),
    measurementId: p.id,
    roomId: p.roomId || undefined,
    roomName,
    windowName,
    productType: label,
    productGroup: group,
    stockItemId,

    width: w,
    height: h,

    calcWidth: Number(
      calculation.billingWidth ??
      calculation.billingWidthCm ??
      w
    ),

    calcHeight: Number(
      calculation.billingHeight ??
      calculation.billingHeightCm ??
      h
    ),

    quantity,

    metricSize: Number(
      Number(size || 0).toFixed(2)
    ),

    metricUnit: unit,

    productionWidthCm: Number(
      salesItemOverride?.productionWidthCm ??
      calculation.productionWidthCm ??
      calculation.productionWidth ??
      w
    ),

    productionHeightCm: Number(
      salesItemOverride?.productionHeightCm ??
      calculation.productionHeightCm ??
      calculation.productionHeight ??
      h
    ),

    fabricMeters: Number(
      salesItemOverride?.fabricMeters ??
      calculation.fabricMeters ??
      calculation.fabricUsageMeters ??
      (unit === 'mt' ? size : 0)
    ),

    calculationVersion:
      salesItemOverride?.calculationVersion ||
      calculation.calculationVersion ||
      CALCULATION_ENGINE_VERSION,

    pleatDetails: pleatLabel,

    wingQuantity:
      calculation.wings !== undefined
        ? Number(calculation.wings)
        : undefined,

    fonPlacement:
      calculation.fonPlacement === 'LEFT' ||
      calculation.fonPlacement === 'BOTH'
        ? calculation.fonPlacement
        : undefined,

    unitPrice: 0,
    discount: 0,
    rowTotal: 0,

    note:
      notes.length > 0
        ? notes.join(' | ')
        : undefined
  };
}
export function createJumboSaleItem(
  p: MeasurementRecord,
  g: CalculationRecord,
  gIdx: number,
  parentItemId: string,
  roomName: string,
  windowName: string,
  parentProductType: string
): SaleItem {
  const norm = parentProductType.toUpperCase();

  const parentLabel =
    norm === 'STOR'
      ? 'Stor'
      : norm === 'ZEBRA'
        ? 'Zebra'
        : norm === 'AHSAP_JALUZI'
          ? 'Ahşap Jaluzi'
          : norm === 'JALUZI' ||
              norm === 'METAL_JALUZI'
            ? 'Jaluzi'
            : parentProductType;

  const compName =
    norm === 'AHSAP_JALUZI'
      ? 'Ahşap Jaluzi Güçlendirilmiş Üst Kasa Farkı'
      : norm === 'JALUZI' ||
          norm === 'METAL_JALUZI'
        ? 'Jaluzi Ağır Hizmet Mekanizma Farkı'
        : `Jumbo ${parentLabel} Mekanizma Farkı`;

  let unit: 'm2' | 'mt' | 'adet' = 'mt';
  if (g.jumboUnit === 'PIECE' || g.jumboUnit === 'SET') unit = 'adet';

  return {
    id: `${parentItemId}-jumbo`,
    measurementId: p.id,
    roomId: p.roomId || undefined,
    roomName,
    windowName: `${windowName}${g.sourceSegments?.length > 0 ? ` - Parça ${gIdx + 1}` : ''}`,
    productType: compName,
    productGroup: 'Jumbo Mekanizma Farkı',
    width: g.realWidthCm,
    height: g.realHeightCm,
    calcWidth: g.calculatedWidthCm,
    calcHeight: g.calculatedHeightCm,
    quantity: g.quantity,
    metricSize: g.jumboQuantity,
    metricUnit: unit,
    unitPrice:
      g.appliedSaleUnitPrice ??
      g.originalSaleUnitPrice ??
      0,
    discount: 0,
    rowTotal: Number(
      (
        Number(g.jumboQuantity || 0) *
        Number(
          g.appliedSaleUnitPrice ??
          g.originalSaleUnitPrice ??
          0
        ) *
        Number(g.quantity || 1)
      ).toFixed(2)
    ),
    note: `${parentLabel} için ek jumbo mekanizma farkı`,
    parentProductRelation: parentItemId,
    isJumboComponent: true
  };
}

interface SalesActor {
  id: string;
  username: string;
  name: string;
}

export interface SaleTransferBundleRefV1 {
  measurementId: string;
  productType: string;
}

export function saleTransferBundleKeyV1(
  ref: SaleTransferBundleRefV1
): string {
  return [
    String(ref.measurementId || '').trim(),
    String(ref.productType || '').trim().toLocaleUpperCase('tr-TR')
  ].join('::');
}

export function normalizeSaleTransferBundleRefsV1(
  refs: SaleTransferBundleRefV1[] | undefined
): SaleTransferBundleRefV1[] {
  if (!Array.isArray(refs)) {
    return [];
  }

  const unique = new Map<string, SaleTransferBundleRefV1>();

  refs.forEach(ref => {
    const measurementId = String(ref?.measurementId || '').trim();
    const productType = String(ref?.productType || '').trim();

    if (!measurementId || !productType) {
      return;
    }

    const normalized = { measurementId, productType };
    unique.set(
      saleTransferBundleKeyV1(normalized),
      normalized
    );
  });

  return Array.from(unique.values());
}

export function saleItemContainsTransferBundleV1(
  item: SaleItem,
  ref: SaleTransferBundleRefV1
): boolean {
  const measurementId = String(ref.measurementId || '').trim();
  const productType = String(ref.productType || '').trim();

  if (!measurementId || !productType) {
    return false;
  }

  if (item.birizRuleVersion && productType.toUpperCase() === 'BIRIZ') {
    return Boolean(item.birizSourceMeasurementIds?.includes(measurementId));
  }

  const measurementIds =
    String(item.measurementId || '')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean);

  if (!measurementIds.includes(measurementId)) {
    return false;
  }

  const prefix = `${measurementId}-${productType}-`;

  if (String(item.id || '').startsWith(prefix)) {
    return true;
  }

  const breakdown =
    Array.isArray(item.productionBreakdown)
      ? item.productionBreakdown
      : [];

  return breakdown.some(part =>
    String(part?.id || '').startsWith(prefix)
  );
}

function isInheritedTul(
  measurement: MeasurementRecord,
  product: NonNullable<MeasurementRecord['selectedProducts']>[number]
): boolean {
  return product.productType.trim().toUpperCase() === 'TUL' &&
    Boolean(measurement.createdAt) && product.addedAt === measurement.createdAt &&
    !product.userOverrides && !product.stockId;
}

function reconcileBirizDraftItems(
  existing: SaleItem[],
  calculated: SaleItem[],
  measurements: MeasurementRecord[]
): SaleItem[] {
  const freshBiriz = calculated.filter(item => item.birizRuleVersion);
  const sourcesByRoom = new Map<string | undefined, Set<string>>();
  const replacements = new Map<string, SaleItem>();
  const fail = () => { throw new Error('BIRIZ_V5_DRAFT_RECONCILIATION_REQUIRED'); };
  const ids = (item: SaleItem) => (item.measurementId || '').split(',').filter(Boolean);
  const sameIds = (left: string[], right: string[]) =>
    left.length === right.length && new Set(left).size === left.length &&
    new Set(right).size === right.length && left.every(id => right.includes(id));
  const isBiriz = (item: SaleItem) =>
    item.birizRuleVersion || /B[İI]R[İI]Z/i.test(item.productType);

  for (const fresh of freshBiriz) {
    const sourceIds = fresh.birizSourceMeasurementIds || [];
    const old = existing.filter(item => item.id === fresh.id);
    const historicalRoom = existing.some(item =>
      isBiriz(item) && (item.birizRuleVersion || item.measurementId) &&
      (item.roomId === fresh.roomId || ids(item).some(id => sourceIds.includes(id)))
    );
    if (!historicalRoom) continue;
    if (old.length !== 1 || old[0].roomId !== fresh.roomId ||
        old[0].birizRuleVersion !== fresh.birizRuleVersion ||
        !sameIds(ids(old[0]), sourceIds) ||
        !sameIds(old[0].birizSourceMeasurementIds || [], sourceIds)) fail();

    const previous = old[0];
    const rowTotal = Number((fresh.metricSize * fresh.quantity * previous.unitPrice *
      (1 - Math.min(100, Math.max(0, previous.discount)) / 100)).toFixed(2));
    replacements.set(previous.id, {
      ...previous,
      metricSize: fresh.metricSize,
      metricUnit: fresh.metricUnit,
      quantity: fresh.quantity,
      fabricMeters: fresh.fabricMeters,
      productionBreakdown: fresh.productionBreakdown,
      birizCuttingGroups: fresh.birizCuttingGroups,
      rowTotal,
    });
    sourcesByRoom.set(fresh.roomId, new Set(sourceIds));
  }

  const selectedSources = new Set([...sourcesByRoom.values()].flatMap(source => [...source]));
  return existing.flatMap(item => {
    const replacement = replacements.get(item.id);
    if (replacement) return [replacement];

    const sourceIds = ids(item);
    const roomSources = sourcesByRoom.get(item.roomId);
    const linkedToRepair = sourceIds.some(id => selectedSources.has(id)) ||
      item.productionBreakdown?.some(part => ids(part).some(id => selectedSources.has(id))) ||
      [...selectedSources].some(id => item.id.startsWith(`${id}-TUL-`));
    if (isBiriz(item) && (item.birizRuleVersion || item.measurementId) &&
        (roomSources || linkedToRepair)) fail();

    if (item.productType.trim().toUpperCase() !== 'TUL' || !linkedToRepair) return [item];
    const parts = item.productionBreakdown || [];
    if (!roomSources || !sourceIds.length || !sameIds(sourceIds, parts.map(part => part.measurementId || '')) ||
        item.id !== parts[0]?.id || parts.some(part =>
          part.roomId !== item.roomId || part.productType !== item.productType ||
          part.metricUnit !== item.metricUnit || !Number.isFinite(part.metricSize) || part.metricSize <= 0 ||
          !part.id.startsWith(`${part.measurementId}-TUL-`) ||
          !/^(g0|sale-\d+)$/.test(part.id.slice(`${part.measurementId}-TUL-`.length))
        )) fail();

    const inherited = parts.map(part => {
      const measurement = measurements.find(m => m.id === part.measurementId && m.roomId === item.roomId);
      const products = measurement?.selectedProducts?.filter(product =>
        product.isActive && product.productType.trim().toUpperCase() === 'TUL'
      );
      if (!measurement || products?.length !== 1) return fail();
      return isInheritedTul(measurement, products[0]);
    });
    const retained = parts.filter((part, index) =>
      !inherited[index] || !roomSources?.has(part.measurementId || '')
    );
    if (retained.length === parts.length) return [item];
    if (item.stockItemId || parts.some(part => part.stockItemId)) fail();
    if (!retained.length) return [];

    const metricSize = Number(retained.reduce((sum, part) => sum + part.metricSize, 0).toFixed(2));
    const rowTotal = Number((metricSize * item.quantity * item.unitPrice *
      (1 - Math.min(100, Math.max(0, item.discount)) / 100)).toFixed(2));
    return [{
      ...item,
      id: retained[0].id,
      measurementId: retained.map(part => part.measurementId).join(','),
      productionBreakdown: retained,
      metricSize,
      rowTotal,
    }];
  });
}

export function createDraftSaleFromCustomer(
  customer: Customer,
  actor: SalesActor,
  scope: ErpScope,
  selectedMeasurementIds?: string[],
  customerAddressId?: string,
  selectedTransferBundles?: SaleTransferBundleRefV1[]
): Sale {
  const items: SaleItem[] = [];

  const selectedTransferBundleKeys =
    selectedTransferBundles !== undefined
      ? new Set(
          normalizeSaleTransferBundleRefsV1(
            selectedTransferBundles
          ).map(saleTransferBundleKeyV1)
        )
      : null;

  const selectedMeasurementIdSet =
    selectedMeasurementIds
      ? new Set(
          selectedMeasurementIds
            .map(id => id.trim())
            .filter(id => id.length > 0)
        )
      : null;

  const candidateMeasurements =     useMeasurementStore       .getState()       .measurements       .filter(         measurement =>           measurement.customerId === customer.id &&           !measurement.isDeleted &&           !measurement.isArchived &&           (             !selectedMeasurementIdSet ||             selectedMeasurementIdSet.has(measurement.id)           )       );    const requestedCustomerAddressId = String(customerAddressId || '').trim();   const measurements = requestedCustomerAddressId     ? candidateMeasurements.filter(         measurement => measurement.customerAddressId === requestedCustomerAddressId       )     : candidateMeasurements;    const measurementAddressIds = Array.from(     new Set(       measurements         .map(measurement => String(measurement.customerAddressId || '').trim())         .filter(Boolean)     )   );       if (!requestedCustomerAddressId && measurementAddressIds.length > 1) {     throw new Error('SALE_MIXED_CUSTOMER_ADDRESSES_UNSUPPORTED');   }    const resolvedCustomerAddressId =     requestedCustomerAddressId || measurementAddressIds[0] || '';   const resolvedCustomerAddress = resolvedCustomerAddressId     ? (customer.addresses || []).find(         address =>           address.id === resolvedCustomerAddressId &&           !address.isDeleted       )     : undefined;   if (resolvedCustomerAddressId && !resolvedCustomerAddress) {     throw new Error('SALE_CUSTOMER_ADDRESS_NOT_FOUND');   }   const addressCapturedAt = new Date().toISOString();
  measurements.forEach(m => {
    const room = customer.rooms?.find(r => r.id === m.roomId);
    const win = room?.windows?.find(w => w.id === (m.openingId || m.windowId));
    const selectedProducts = m.selectedProducts?.filter(product => product.isActive) || [];
    const hasBiriz = selectedProducts.some(product =>
      product.productType.trim().toUpperCase() === 'BIRIZ' &&
      (!selectedTransferBundleKeys || selectedTransferBundleKeys.has(
        saleTransferBundleKeyV1({ measurementId: m.id, productType: product.productType })
      ))
    );
    const activeProducts = selectedProducts
        .filter(product => {
          // The legacy measurement default has the measurement creation timestamp.
          // Explicit room preparation stores product overrides.
          return !(hasBiriz && isInheritedTul(m, product));
        })
        .filter(product =>
          !selectedTransferBundleKeys ||
          selectedTransferBundleKeys.has(
            saleTransferBundleKeyV1({
              measurementId: m.id,
              productType: product.productType
            })
          )
        );

    if (
      selectedTransferBundleKeys &&
      activeProducts.length === 0
    ) {
      return;
    }

    if (activeProducts.length === 0) {
      const item = createSaleItemFromMeasurement(m, room?.name || 'Oda', win?.name || 'Pencere');
      item.id = `${m.id}-fallback`;
      items.push(item);
    } else {
      activeProducts.forEach(ap => {
        const calc = ap.calculation || {};

        // BIRIZ V5 has its own dimensions, kind, room and scope validations.
        // The generic calculation validator may reject a valid simple width/height
        // measurement before the V5 converter can create the real sale lines.
        // This temporary source item is replaced by prepareBirizSaleItemsV5;
        // it is never persisted as a sale line if V5 validation fails.
        if (String(ap.productType || '').trim().toUpperCase() === 'BIRIZ') {
          const birizSource = createSaleItemFromMeasurement(
            {
              ...m,
              productType: ap.productType,
              selectedProducts: [ap],
              details: { ...m.details, ...calc }
            },
            room?.name || 'Oda',
            win?.name || 'Pencere',
            'BIRIZ'
          );
          birizSource.id = `${m.id}-BIRIZ-v5-seed`;
          items.push(birizSource);
          return;
        }

        const calculationValidation =
          validateCalculationForSale(calc);

        if (!calculationValidation.valid) {
          console.error(
            '[KASA AŞ.] Satış satırı engellendi.',
            {
              measurementId: m.id,
              productType: ap.productType,
              errors:
                calculationValidation.errors
            }
          );

          return;
        }

        const bridgeLines =
          buildSaleCalculationLines(
            calc,
            ap.productType,
            resolveMeasurementProductLabel({
              productType: ap.productType
            })
          );
        if (
          calc.isSegmented &&
          Array.isArray(calc.groups) &&
          calc.groups.length > 0
        ) {
          /*
           * Segmentli mekanik ürünler satış ekranında
           * parça parça gösterilmez.
           *
           * Ölçü, montaj ve tedarikçi işlemleri için
           * calc.groups teknik detayları korunur.
           */
          const totalSegmentM2 =
            Number(calc.totalM2) > 0
              ? Number(calc.totalM2)
              : Number(
                  calc.groups
                    .reduce(
                      (total: number, group) =>
                        total +
                        Number(
                          group.totalM2 ||
                          (
                            Number(group.unitM2 || 0) *
                            Number(group.quantity || 1)
                          )
                        ),
                      0
                    )
                    .toFixed(2)
                );

          const totalQuantity =
            calc.groups.reduce(
              (total: number, group) =>
                total + Number(group.quantity || 1),
              0
            );

          const firstGroup = calc.groups[0];

          const pObj: ProductMeasurement = {
            ...m,

            productType:
              ap.productType,

            productGroup:
              resolveMeasurementProductGroup({
                productType: ap.productType
              }),

            selectedProducts: [
              {
                ...ap,

                calculation: {
                  ...calc,

                  totalM2:
                    totalSegmentM2,

                  quantity:
                    totalQuantity,

                  /*
                   * Teknik gruplar özellikle korunuyor.
                   * Satış satırı tek olsa da ölçü parçaları
                   * montaj ve tedarikçi tarafında kaybolmaz.
                   */
                  groups:
                    calc.groups
                }
              }
            ],

            rawValues: {
              ...m.rawValues,

              width:
                Number(calc.actualWidthCm) ||
                Number(calc.realWidthCm) ||
                Number(
                  calc.groups.reduce(
                    (total: number, group) =>
                      total +
                      Number(group.realWidthCm || 0),
                    0
                  )
                ),

              height:
                Number(calc.actualHeightCm) ||
                Number(calc.realHeightCm) ||
                Number(firstGroup?.realHeightCm || 0),

              quantity:
                totalQuantity
            },

            details: {
              ...m.details,
              ...calc,

              totalM2:
                totalSegmentM2,

              quantity:
                totalQuantity,

              groups:
                calc.groups
            }
          };

          let firstMainItemId = '';

          bridgeLines.forEach(
            (bridgeLine, bridgeIndex) => {
              const mainItem =
                createSaleItemFromMeasurement(
                  pObj,
                  room?.name || 'Oda',
                  win?.name || 'Pencere',
                  bridgeLine.productType,
                  {
                    productType:
                      bridgeLine.productType,

                    label:
                      bridgeLine.label,

                    totalM2:
                      bridgeLine.totalM2,

                    metricSize:
                      bridgeLine.quantity,

                    metricUnit:
                      bridgeLine.unit
                  }
                );

              mainItem.id =
                `${m.id}-${ap.productType}-sale-${bridgeIndex}`;

              mainItem.quantity = 1;
              mainItem.metricSize =
                bridgeLine.quantity;
              mainItem.metricUnit =
                bridgeLine.unit;

              if (!firstMainItemId) {
                firstMainItemId =
                  mainItem.id;
              }

              items.push(mainItem);
            }
          );

          /*
           * Jumbo gereken birden fazla parça varsa,
           * satışta tek bir toplam jumbo farkı satırı oluştur.
           */
          const jumboGroups =
            calc.groups.filter(
              (group) =>
                Boolean(group.requiresJumbo)
            );

          if (jumboGroups.length > 0) {
            const totalJumboM2 =
              Number(
                jumboGroups
                  .reduce(
                    (total: number, group) =>
                      total +
                      Number(
                        group.totalM2 ||
                        (
                          Number(group.unitM2 || 0) *
                          Number(group.quantity || 1)
                        )
                      ),
                    0
                  )
                  .toFixed(2)
              );

            const aggregateJumboGroup = {
              ...jumboGroups[0],

              quantity:
                1,

              unitM2:
                totalJumboM2,

              totalM2:
                totalJumboM2
            };

            const jumboItem =
              createJumboSaleItem(
                m,
                aggregateJumboGroup,
                0,
                firstMainItemId,
                room?.name || 'Oda',
                win?.name || 'Pencere',
                ap.productType
              );

            jumboItem.id =
              `${m.id}-${ap.productType}-jumbo-total`;

            items.push(jumboItem);
          }
        } else {
          const pObj: ProductMeasurement = {
            ...m,
            productType: ap.productType,
            productGroup:
              resolveMeasurementProductGroup({
                productType: ap.productType
              }),
            selectedProducts: [ap],
            details: {
              ...m.details,
              ...calc
            }
          };

          const salesItems =
            bridgeLines.length > 0
              ? bridgeLines
              : null;

          if (salesItems) {
            salesItems.forEach(
              (saleCalc: SaleCalculationLine, saleIndex: number) => {
                const saleItem =
                  createSaleItemFromMeasurement(
                    pObj,
                    room?.name || 'Oda',
                    win?.name || 'Pencere',
                    saleCalc.productType ||
                      ap.productType,
                    {
                      productType:
                        saleCalc.productType,
                      label:
                        saleCalc.label,
                      totalM2:
                        saleCalc.totalM2,
                      metricSize:
                        saleCalc.quantity,
                      metricUnit:
                        saleCalc.unit
                    }
                  );

                saleItem.id =
                  `${m.id}-${ap.productType}-sale-${saleIndex}`;

                items.push(saleItem);
              }
            );
          } else {
            const mainItem =
              createSaleItemFromMeasurement(
                pObj,
                room?.name || 'Oda',
                win?.name || 'Pencere',
                ap.productType
              );

            mainItem.id =
              `${m.id}-${ap.productType}-g0`;

            items.push(mainItem);
          }

          const singleGroup = calc.groups?.[0];

          if (singleGroup?.requiresJumbo) {
            const parentItemId =
              salesItems
                ? `${m.id}-${ap.productType}-sale-0`
                : `${m.id}-${ap.productType}-g0`;

            const jumboItem = createJumboSaleItem(
              m,
              singleGroup,
              0,
              parentItemId,
              room?.name || 'Oda',
              win?.name || 'Pencere',
              ap.productType
            );

            items.push(jumboItem);
          }
        }
      });
    }
  });

  if (customer.roomProductIntents) {
    customer.roomProductIntents.forEach(intent => {
      intent.products?.forEach(pIntent => {
        if (pIntent.selected) {
          let unit: SaleItem['metricUnit'] = 'adet';
          const t = pIntent.productType;
          if (['TUL', 'FON', 'GUNESLIK', 'RUSTIK', 'TAVAN_RUSTIK'].includes(t)) {
            unit = 'mt';
          } else if (['STOR', 'ZEBRA', 'PLICELL', 'JALUZI', 'AHSAP_JALUZI', 'PICASSO', 'DIKEY_PERDE'].includes(t)) {
            unit = 'm2';
          }

          items.push({
            id: crypto.randomUUID(),
            measurementId: undefined,
            roomId: intent.roomId || undefined,
            roomName: intent.roomName || customer.rooms?.find(r => r.id === intent.roomId)?.name || 'Bilinmeyen Oda',
            windowName: 'Ürün İsteği (Genel)',
            productType: pIntent.productType,
            productGroup: pIntent.label,
            width: 0,
            height: 0,
            calcWidth: 0,
            calcHeight: 0,
            quantity: 1,
            metricSize: 1,
            metricUnit: unit,
            pleatDetails: undefined,
            unitPrice: 0,
            discount: 0,
            rowTotal: 0,
            note: pIntent.note || undefined
          });
        }
      });
    });
  }

  // BİRİZ V5: ortak tüketim yalnız oda kapsamındaki hazırlanmış ölçülerle hesaplanır.
  // Diğer perde türlerinin satış miktarları aynen korunur.
  const birizPreparedItems = prepareBirizSaleItemsV5({
    items,
    measurements,
    scope,
    customerId: customer.id,
    customerAddressId: resolvedCustomerAddressId,
    rooms: customer.rooms || [],
    selectedTransferBundles: selectedTransferBundles
  });

  /*
   * SATIŞ SUNUM GRUPLAMASI
   *
   * KASA A.Ş. tarafından üretilmiş metricSize değerleri değiştirilmez.
   * Aynı oda + aynı ürün + aynı birim kalemleri yalnız satış sunumu için
   * bir araya getirilir. Açıklık ayrımı ölçü/üretim/terzi raporlarında korunur.
   */
  const normalizeSaleGroupKeyPart = (
    value: unknown
  ): string =>
    String(value || '')
      .trim()
      .toLocaleUpperCase('tr-TR');

  const groupedSaleItemMap =
    new Map<string, SaleItem>();

  birizPreparedItems.forEach((item: SaleItem) => {
    // V5 satırları oda başına zaten optimize edilmiştir: klasik gruplama
    // bunları tekrar sarmalayıp ölçü kökenini kaybetmemelidir.
    if (item.birizRuleVersion) {
      const v5Key = `V5:${item.id}`;
      if (groupedSaleItemMap.has(v5Key)) {
        throw new Error('BIRIZ_V5_DUPLICATE_GROUP_LINE');
      }
      groupedSaleItemMap.set(v5Key, item);
      return;
    }
    const groupKey = [
      // Room ID is authoritative. Missing legacy IDs must never merge
      // unrelated rooms merely because their display names coincide.
      item.roomId
        ? `ROOM:${item.roomId}`
        : `UNBOUND:${item.measurementId || item.id}`,
      normalizeSaleGroupKeyPart(item.productType),
      normalizeSaleGroupKeyPart(item.metricUnit),
      item.birizRuleVersion || 'LEGACY',
      normalizeSaleGroupKeyPart(item.stockItemId || ''),
      item.isJumboComponent ? 'JUMBO' : 'NORMAL',
      normalizeSaleGroupKeyPart(
        item.parentProductRelation || ''
      )
    ].join('|');

    const existing =
      groupedSaleItemMap.get(groupKey);

    if (!existing) {
      groupedSaleItemMap.set(
        groupKey,
        {
          ...item,
          windowName: 'Oda Toplamı',
          quantity: 1,

          productionBreakdown: [
            {
              ...item,
              productionBreakdown: undefined
            }
          ],
          metricSize: Number(
            Number(item.metricSize || 0).toFixed(2)
          )
        }
      );

      return;
    }

    /*
     * Burada formül veya yeniden hesap yoktur.
     * Yalnız KASA A.Ş.'den gelen hazır satış miktarları toplanır.
     */
    existing.metricSize = Number(
      (
        Number(existing.metricSize || 0) +
        Number(item.metricSize || 0)
      ).toFixed(2)
    );

    existing.width = 0;
    existing.height = 0;
    existing.calcWidth = 0;
    existing.calcHeight = 0;
    existing.windowName = 'Oda Toplamı';

    const productionBreakdown =
      Array.isArray(existing.productionBreakdown)
        ? existing.productionBreakdown
        : [];

    productionBreakdown.push({
      ...item,
      productionBreakdown: undefined
    });

    existing.productionBreakdown =
      productionBreakdown;

    const measurementIds = new Set(
      [
        existing.measurementId,
        item.measurementId
      ].filter(Boolean)
    );

    existing.measurementId =
      Array.from(measurementIds).join(',');

    const notes = new Set(
      [
        existing.note,
        item.note
      ]
        .filter(Boolean)
        .map(note => String(note))
    );

    existing.note =
      notes.size > 0
        ? Array.from(notes).join(' | ')
        : undefined;
  });

  const groupedItems =
    Array.from(groupedSaleItemMap.values())
      .sort((left, right) => {
        const roomCompare =
          String(left.roomName || '').localeCompare(
            String(right.roomName || ''),
            'tr'
          );

        if (roomCompare !== 0) {
          return roomCompare;
        }

        const productCompare =
          String(left.productType || '').localeCompare(
            String(right.productType || ''),
            'tr'
          );

        if (productCompare !== 0) {
          return productCompare;
        }

        return String(left.metricUnit || '').localeCompare(
          String(right.metricUnit || ''),
          'tr'
        );
      });
  const saleNo = `TEK-${new Date().getFullYear()}${(new Date().getMonth()+1).toString().padStart(2,'0')}-${Math.floor(Math.random()*10000).toString().padStart(4,'0')}`;

  return {
    ...scope,
    id: crypto.randomUUID(),
    saleNo,
    customerId: customer.id,
    ...(resolvedCustomerAddressId ? { customerAddressId: resolvedCustomerAddressId } : {}),
    ...(resolvedCustomerAddress
      ? {
          customerAddressSnapshot: {
            customerAddressId: resolvedCustomerAddress.id,
            title: resolvedCustomerAddress.title,
            phone: resolvedCustomerAddress.phone,
            province: resolvedCustomerAddress.province,
            district: resolvedCustomerAddress.district,
            address: resolvedCustomerAddress.address || '',
            mapLocation: resolvedCustomerAddress.mapLocation,
            latitude: resolvedCustomerAddress.latitude,
            longitude: resolvedCustomerAddress.longitude,
            capturedAt: addressCapturedAt,
          },
        }
      : {}),
    createdByUserId: actor.id,
    createdByUsername: actor.username,
    createdByName: actor.name,
    status: 'TASLAK',
    items: groupedItems,
    priceSource: 'MANUAL',
    totalAmount: 0,
    cashPrice: 0,
    installmentPrice: 0,
    discount: 0,
    downPayment: 0,
    remainingBalance: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export async function syncOrCreateDraftSale(
  customer: Customer,
  salesStore: DraftSalesStore,
  actor: SalesActor | null,
  scope: ErpScope | null,
  targetSaleId?: string,
  customerAddressId?: string,
  selectedTransferBundles?: SaleTransferBundleRefV1[]
): Promise<string> {
  if (
    !actor?.id ||
    !actor.username ||
    !actor.name
  ) {
    throw new Error(
      'Satışı yapan kullanıcı bilgisi bulunamadı.'
    );
  }

  if (!scope) {
    throw new Error('SALE_SCOPE_REQUIRED');
  }
  const explicitTransferSelection =
    selectedTransferBundles !== undefined;

  const normalizedTransferSelection =
    explicitTransferSelection
      ? normalizeSaleTransferBundleRefsV1(
          selectedTransferBundles
        )
      : null;

  if (
    explicitTransferSelection &&
    normalizedTransferSelection?.length === 0
  ) {
    throw new Error('SALE_TRANSFER_SELECTION_REQUIRED');
  }

  const selectedTransferMeasurementIds =
    normalizedTransferSelection
      ? Array.from(
          new Set(
            normalizedTransferSelection.map(
              ref => ref.measurementId
            )
          )
        )
      : undefined;

  const cleanTargetSaleId =
    String(targetSaleId || '').trim();

  /*
   * Canonical adres kimliği mevcut draft seçilmeden önce çözülür.
   * customerAddressId açıkça gelmese bile seçilen ölçüler tek bir
   * adrese bağlıysa yanlış/adres-bağımsız draft reuse edilmez.
   */
  const newSaleObj =
    createDraftSaleFromCustomer(
      customer,
      actor,
      scope,
      selectedTransferMeasurementIds,
      customerAddressId,
      normalizedTransferSelection || undefined
    );

  const resolvedCustomerAddressId =
    String(newSaleObj.customerAddressId || '').trim();

  let existingDraft =
    cleanTargetSaleId
      ? salesStore.sales.find(
          sale =>
            sale.id === cleanTargetSaleId &&
            sale.customerId === customer.id &&
            erpScopeMatches(sale, scope) &&
            (
              sale.status === 'TASLAK' ||
              sale.status === 'TEKLİF'
            ) &&
            !sale.isDeleted
        )
      : salesStore.sales.find(
          sale =>
            sale.customerId === customer.id &&
            erpScopeMatches(sale, scope) &&
            (
              resolvedCustomerAddressId
                ? String(
                    sale.customerAddressId || ''
                  ).trim() ===
                  resolvedCustomerAddressId
                : !sale.customerAddressId &&
                  !sale.customerAddressSnapshot
            ) &&
            (
              sale.status === 'TASLAK' ||
              sale.status === 'TEKLİF'
            ) &&
            !sale.isDeleted
        );

  if (cleanTargetSaleId && !existingDraft) {
    throw new Error(
      'TARGET_SALE_NOT_FOUND_OR_NOT_EDITABLE'
    );
  }

  let addressRepaired = false;
  if (existingDraft) {
    const existingAddressId =
      String(
        existingDraft.customerAddressId || ''
      ).trim();

    const existingAddressSnapshot =
      existingDraft.customerAddressSnapshot;

    if (
      existingAddressSnapshot &&
      !existingAddressId
    ) {
      throw new Error(
        'SALE_DRAFT_ADDRESS_SNAPSHOT_WITHOUT_ID'
      );
    }

    if (
      existingAddressSnapshot &&
      String(
        existingAddressSnapshot.customerAddressId ||
        ''
      ).trim() !== existingAddressId
    ) {
      throw new Error(
        'SALE_DRAFT_ADDRESS_SNAPSHOT_INVALID'
      );
    }

    if (
      resolvedCustomerAddressId &&
      existingAddressId &&
      resolvedCustomerAddressId !==
        existingAddressId
    ) {
      throw new Error(
        'TARGET_SALE_ADDRESS_MISMATCH'
      );
    }

    if (
      cleanTargetSaleId &&
      resolvedCustomerAddressId &&
      !existingAddressId
    ) {
      throw new Error(
        'TARGET_SALE_ADDRESS_REBIND_REQUIRED'
      );
    }

    /*
     * Legacy / yarım bağlı TASLAK-TEKLİF:
     * addressId var fakat snapshot yoksa yalnız exact aynı
     * customer address kaynağından pair tamamlanır.
     */
    if (
      existingAddressId &&
      !existingAddressSnapshot
    ) {
      const repairCandidate =
        createDraftSaleFromCustomer(
          customer,
          actor,
          scope,
          selectedTransferMeasurementIds,
          existingAddressId,
          normalizedTransferSelection || undefined
        );

      if (
        String(
          repairCandidate.customerAddressId || ''
        ).trim() !== existingAddressId ||
        !repairCandidate.customerAddressSnapshot ||
        String(
          repairCandidate.customerAddressSnapshot
            .customerAddressId || ''
        ).trim() !== existingAddressId
      ) {
        throw new Error(
          'SALE_DRAFT_ADDRESS_REPAIR_FAILED'
        );
      }

      existingDraft = {
        ...existingDraft,
        customerAddressId:
          existingAddressId,
        customerAddressSnapshot:
          repairCandidate.customerAddressSnapshot,
        updatedAt:
          new Date().toISOString()
      };

      addressRepaired = true;
    }
  }

  /*
   * Ölçüden üretilen otomatik satış satırlarında
   * boş veya geçersiz metraj kabul edilmez.
   */
  const calculatedItems =
    newSaleObj.items.filter((item: SaleItem) => {
      if (!item.measurementId) {
        return true;
      }

      return (
        Number.isFinite(Number(item.metricSize)) &&
        Number(item.metricSize) > 0 &&
        Number.isFinite(Number(item.quantity)) &&
        Number(item.quantity) > 0
      );
    });

  if (!existingDraft) {
    if (
      explicitTransferSelection &&
      calculatedItems.length === 0
    ) {
      throw new Error('SALE_TRANSFER_SELECTION_NO_ITEMS');
    }

    await salesStore.addSale({
      ...newSaleObj,
      items: calculatedItems
    });

    return newSaleObj.id;
  }

  const existingItems =
    Array.isArray(existingDraft.items)
      ? existingDraft.items
      : [];

  // Eski otomatik grup metrajlarını sessizce değiştiren normal refresh engellenir.
  if (!normalizedTransferSelection) {
    const newV5Rooms = new Set(newSaleObj.items.filter(item => item.birizRuleVersion).map(item => item.roomId));
    if (newV5Rooms.size && existingItems.some(item =>
      (!item.roomId || newV5Rooms.has(item.roomId)) &&
      (item.birizRuleVersion || /B[İI]R[İI]Z/i.test(String(item.productType || ''))))) {
      throw new Error('BIRIZ_V5_DRAFT_RECONCILIATION_REQUIRED');
    }
  }


  // Explicit transfer appends new bundles and repairs only exact BİRİZ source sets.
  if (normalizedTransferSelection) {
    // Eski taslak + yeni BİRİZ ölçüsü, oda toplamını yeniden uzlaştırma gerektirir.
    // V5-C sunucu transaction/CAS doğrulanmadan eski satır sessizce değiştirilemez.
    const requestedBirizIds = new Set(
      normalizedTransferSelection
        .filter(ref => ref.productType.trim().toUpperCase() === 'BIRIZ')
        .map(ref => ref.measurementId)
    );
    if (requestedBirizIds.size > 0) {
      const requestedRooms = new Set(
        useMeasurementStore.getState().measurements
          .filter(m => requestedBirizIds.has(m.id))
          .map(m => m.roomId)
      );
      const newBirizRequested = normalizedTransferSelection.some(ref =>
        ref.productType.trim().toUpperCase() === 'BIRIZ' &&
        !existingItems.some(item => saleItemContainsTransferBundleV1(item, ref))
      );
      if (newBirizRequested && existingItems.some(item =>
          (!item.roomId || requestedRooms.has(item.roomId)) &&
          (item.birizRuleVersion || String(item.productType || '').toLocaleUpperCase('tr-TR').includes('BİRİZ') ||
           String(item.productType || '').toLocaleUpperCase('tr-TR').includes('BIRIZ')))) {
        throw new Error('BIRIZ_V5_DRAFT_RECONCILIATION_REQUIRED');
      }
    }
    const measurements = useMeasurementStore.getState().measurements.filter(m =>
      m.customerId === customer.id &&
      String(m.customerAddressId || '').trim() === resolvedCustomerAddressId &&
      !m.isDeleted && !m.isArchived
    );
    const reconciledItems = reconcileBirizDraftItems(existingItems, calculatedItems, measurements);
    const reconciled = JSON.stringify(reconciledItems) !== JSON.stringify(existingItems);
    const additions: SaleItem[] = [];

    // V5: A selection containing multiple new Biriz measurements must
    // be optimized as ONE room-aware input set, not one measurement at a time.
    // Existing Biriz in affected rooms remains guarded above until atomic
    // draft reconciliation is available in the persistence layer.
    const pendingRefs = normalizedTransferSelection.filter(ref =>
      !existingItems.some(item => saleItemContainsTransferBundleV1(item, ref))
    );
    const newBirizRefs = pendingRefs.filter(ref =>
      ref.productType.trim().toUpperCase() === 'BIRIZ'
    );
    const otherRefs = pendingRefs.filter(ref => {
      const type = ref.productType.trim().toUpperCase();
      if (type === 'BIRIZ') return false;
      if (type !== 'TUL' || !requestedBirizIds.has(ref.measurementId)) return true;
      const measurement = measurements.find(m => m.id === ref.measurementId);
      return !measurement?.selectedProducts?.some(product => product.isActive && isInheritedTul(measurement, product));
    });

    if (newBirizRefs.length) {
      const sharedDraft = createDraftSaleFromCustomer(
        customer,
        actor,
        scope,
        [...new Set(newBirizRefs.map(ref => ref.measurementId))],
        customerAddressId,
        newBirizRefs
      );
      if (!sharedDraft.items.length) {
        throw new Error('SALE_TRANSFER_BIRIZ_BATCH_NO_ITEMS');
      }
      additions.push(...sharedDraft.items);
    }

    for (const ref of otherRefs) {
      const bundleDraft = createDraftSaleFromCustomer(
        customer,
        actor,
        scope,
        [ref.measurementId],
        customerAddressId,
        [ref]
      );
      const bundleItems = bundleDraft.items.filter((item: SaleItem) => {
        if (!item.measurementId) return true;
        return Number.isFinite(Number(item.metricSize)) &&
          Number(item.metricSize) > 0 &&
          Number.isFinite(Number(item.quantity)) &&
          Number(item.quantity) > 0;
      });
      if (!bundleItems.length) throw new Error('SALE_TRANSFER_BUNDLE_NO_ITEMS');
      additions.push(...bundleItems);
    }

    const existingIds = new Set(reconciledItems.map(item => item.id));

    const uniqueAdditions =
      additions.filter(item => {
        if (existingIds.has(item.id)) {
          return false;
        }

        existingIds.add(item.id);
        return true;
      });

    if (!reconciled && !addressRepaired && !uniqueAdditions.length) return existingDraft.id;

    const items = [...reconciledItems, ...uniqueAdditions];
    await salesStore.updateSale({
      ...existingDraft,
      items,
      ...(reconciled ? { totalAmount: Number(items.reduce((sum, item) => sum + item.rowTotal, 0).toFixed(2)) } : {}),
      updatedAt: new Date().toISOString()
    });

    return existingDraft.id;
  }

  /*
   * Kullanıcının elle eklediği, herhangi bir ölçüye
   * bağlı olmayan satış satırları korunur.
   */
  const manualItems: SaleItem[] =
    existingItems.filter(
      (item: SaleItem) => !item.measurementId
    );

  const normalizeKeyPart = (
    value: unknown
  ): string =>
    String(value || '')
      .trim()
      .toLocaleUpperCase('tr-TR');

  const createItemKey = (
    item: SaleItem
  ): string =>
    [
      item.measurementId,
      normalizeKeyPart(item.productType),
      normalizeKeyPart(item.roomName),
      normalizeKeyPart(item.windowName),
      item.metricUnit,
      normalizeKeyPart(item.stockItemId || '')
    ].join('|');

  /*
   * Eski otomatik satırlardan fiyat ve iskonto
   * bilgilerini indeksle. Tekrarlı eski satırlardan
   * yalnız ilk geçerli kayıt dikkate alınır.
   */
  const oldAutomaticItemsByKey =
    new Map<string, SaleItem>();

  existingItems.forEach((item: SaleItem) => {
    if (!item.measurementId) return;

    const key = createItemKey(item);

    if (!oldAutomaticItemsByKey.has(key)) {
      oldAutomaticItemsByKey.set(key, item);
    }
  });

  /*
   * Yeni hesap listesi ana kaynaktır.
   * Eski otomatik satırlar doğrudan taşınmaz.
   * Yalnız kullanıcının girdiği fiyat ve iskonto korunur.
   */
  const refreshedAutomaticItems: SaleItem[] =
    calculatedItems
      .filter(
        (item: SaleItem) =>
          Boolean(item.measurementId)
      )
      .map((newItem: SaleItem) => {
        const exactOldItem =
          existingItems.find(
            (oldItem: SaleItem) =>
              oldItem.measurementId &&
              oldItem.id === newItem.id
          );

        const matchingOldItem =
          exactOldItem ||
          oldAutomaticItemsByKey.get(
            createItemKey(newItem)
          );

        if (!matchingOldItem) {
          return newItem;
        }

        const preservedUnitPrice =
          Number(matchingOldItem.unitPrice || 0);

        const preservedDiscount =
          Number(matchingOldItem.discount || 0);

        const grossTotal =
          Number(newItem.metricSize || 0) *
          Number(newItem.quantity || 1) *
          preservedUnitPrice;

        const rowTotal =
          grossTotal *
          (
            1 -
            Math.min(
              100,
              Math.max(0, preservedDiscount)
            ) / 100
          );

        return {
          ...newItem,

          unitPrice:
            preservedUnitPrice,

          discount:
            preservedDiscount,

          rowTotal:
            Number(rowTotal.toFixed(2))
        };
      });

  /*
   * Aynı otomatik satırın birden fazla kez eklenmesini
   * son savunma olarak engelle.
   */
  const uniqueAutomaticItems =
    Array.from(
      new Map(
        refreshedAutomaticItems.map(
          (item: SaleItem) => [
            createItemKey(item),
            item
          ]
        )
      ).values()
    );

  const updatedSale = {
    ...existingDraft,

    createdByUserId:
      existingDraft.createdByUserId ||
      actor.id,

    createdByUsername:
      existingDraft.createdByUsername ||
      actor.username,

    createdByName:
      existingDraft.createdByName ||
      actor.name,

    items: [
      ...manualItems,
      ...uniqueAutomaticItems
    ],

    updatedAt:
      new Date().toISOString()
  };

  await salesStore.updateSale(updatedSale);

  return existingDraft.id;
}
