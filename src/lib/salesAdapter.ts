import { Customer, ProductMeasurement } from '@/store/useStore';
import { useMeasurementStore, MeasurementRecord } from '@/store/measurementStore';
import { Sale, SaleItem } from '@/store/salesStore';
import { getMeasurementDimensions, resolveMeasurementProductGroup, resolveMeasurementProductLabel } from '@/lib/measurementAdapter';

/**
 * Metrik birimi ve boyutu hesaplar.
 */
function calculateMetricSize(p: ProductMeasurement, group: string, width: number, height: number): { size: number, unit: 'm2' | 'mt' | 'adet' } {
  // Plicell, Mekanik, Jaluzi, vb = M2
  if (group === 'Plicell' || group === 'Mekanik Perde') {
    const calcW = Math.max(width, 100);
    const calcH = Math.max(height, 200);
    return { size: (calcW * calcH) / 10000, unit: 'm2' };
  }

  // Tül, Güneşlik = MT (genelde pile katsayısı gerekir ama varsayılan olarak pile x2.5 dersek,
  // ya da basitçe genişlik üzerinden MT hesaplarız. İlk sürümde sadece genişlik MT baz alınır).
  if (group === 'Kumaş/Tül/Fon') {
    return { size: width / 100, unit: 'mt' };
  }

  // Standart
  return { size: (width * height) / 10000, unit: 'm2' };
}

/**
 * Ölçüden tek bir satış satırı oluşturur.
 */
function createSaleItemFromMeasurement(
  p: ProductMeasurement,
  roomName: string,
  windowName: string,
  selectedType?: string,
  salesItemOverride?: {
    productType?: string;
    label?: string;
    totalM2?: number;
    metricSize?: number;
    metricUnit?: 'm2' | 'mt' | 'adet';
  }
): SaleItem {
  const dims = getMeasurementDimensions(p);

  const calculation = {
    ...(p.details || {}),
    ...(p.selectedProducts?.[0]?.calculation || {})
  } as any;

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
    const metric = calculateMetricSize(
      p,
      group,
      w,
      h
    );

    size = metric.size;
    unit = metric.unit;
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
    roomName,
    windowName,
    productType: label,
    productGroup: group,

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

    pleatDetails: pleatLabel,

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
  g: any,
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
  } as any;
}

export function createDraftSaleFromCustomer(customer: Customer): Sale {
  const items: any[] = [];

  const measurements = useMeasurementStore.getState().measurements.filter(m => m.customerId === customer.id && !m.isDeleted && !m.isArchived);
  measurements.forEach(m => {
    const room = customer.rooms?.find(r => r.id === m.roomId);
    const win = room?.windows?.find(w => w.id === m.windowId);
    const activeProducts = m.selectedProducts?.filter(sp => sp.isActive) || [];

    if (activeProducts.length === 0) {
      const item = createSaleItemFromMeasurement(m, room?.name || 'Oda', win?.name || 'Pencere');
      item.id = `${m.id}-fallback`;
      items.push(item);
    } else {
      activeProducts.forEach(ap => {
        const calc = ap.calculation || {};
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
                      (total: number, group: any) =>
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
              (total: number, group: any) =>
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
                    (total: number, group: any) =>
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

          const mainItem =
            createSaleItemFromMeasurement(
              pObj,
              room?.name || 'Oda',
              win?.name || 'Pencere',
              ap.productType,
              {
                productType:
                  ap.productType,

                totalM2:
                  totalSegmentM2,

                metricSize:
                  totalSegmentM2,

                metricUnit:
                  'm2'
              }
            );

          /*
           * Kimlik oda/pencere içindeki ürün için sabit kalır.
           * Parça sayısı değişse bile satış satırı çoğalmaz.
           */
          mainItem.id =
            `${m.id}-${ap.productType}-g0`;

          mainItem.quantity = 1;
          mainItem.metricSize = totalSegmentM2;
          mainItem.metricUnit = 'm2';

          items.push(mainItem);

          /*
           * Jumbo gereken birden fazla parça varsa,
           * satışta tek bir toplam jumbo farkı satırı oluştur.
           */
          const jumboGroups =
            calc.groups.filter(
              (group: any) =>
                Boolean(group.requiresJumbo)
            );

          if (jumboGroups.length > 0) {
            const totalJumboM2 =
              Number(
                jumboGroups
                  .reduce(
                    (total: number, group: any) =>
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
                mainItem.id,
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
            Array.isArray(calc.salesItems) &&
            calc.salesItems.length > 0
              ? calc.salesItems
              : null;

          if (salesItems) {
            salesItems.forEach(
              (saleCalc: any, saleIndex: number) => {
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
                        saleCalc.metricSize,
                      metricUnit:
                        saleCalc.metricUnit
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
          let unit = 'ADET';
          const t = pIntent.productType;
          if (['TUL', 'FON', 'GUNESLIK', 'RUSTIK', 'TAVAN_RUSTIK'].includes(t)) {
            unit = 'METRE';
          } else if (['STOR', 'ZEBRA', 'PLICELL', 'JALUZI', 'AHSAP_JALUZI', 'PICASSO', 'DIKEY_PERDE'].includes(t)) {
            unit = 'M2';
          }

          items.push({
            id: crypto.randomUUID(),
            measurementId: undefined,
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

  const saleNo = `TEK-${new Date().getFullYear()}${(new Date().getMonth()+1).toString().padStart(2,'0')}-${Math.floor(Math.random()*10000).toString().padStart(4,'0')}`;

  return {
    id: crypto.randomUUID(),
    saleNo,
    customerId: customer.id,
    status: 'TASLAK',
    items,
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
  salesStore: any
): Promise<string> {
  const existingDraft = salesStore.sales.find(
    (sale: any) =>
      sale.customerId === customer.id &&
      sale.status === 'TASLAK' &&
      !sale.isDeleted
  );

  const newSaleObj =
    createDraftSaleFromCustomer(customer);

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
      item.metricUnit
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
