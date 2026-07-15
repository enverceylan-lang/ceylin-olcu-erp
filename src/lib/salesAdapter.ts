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
function createSaleItemFromMeasurement(p: ProductMeasurement, roomName: string, windowName: string, selectedType?: string): SaleItem {
  const dims = getMeasurementDimensions(p);
  const w = dims.structuralWidth || 0;
  const h = dims.structuralHeight || 0;

  const group = resolveMeasurementProductGroup(p);
  const label = resolveMeasurementProductLabel(p);

  let size = w / 100;
  let unit: 'm2' | 'mt' | 'adet' = 'mt';

  const typeUpper = (selectedType || p.productType || '').toUpperCase();

  if (group === 'Plicell' || group === 'Mekanik Perde') {
    size = p.details?.totalM2 !== undefined ? Number(p.details.totalM2) : (w * h) / 10000;
    unit = 'm2';
  } else if (typeUpper === 'TUL') {
    size = p.details?.fabricUsageMeters !== undefined ? Number(p.details.fabricUsageMeters) : (w * 3.15) / 100;
    unit = 'mt';
  } else if (typeUpper === 'GUNESLIK') {
    size = p.details?.fabricUsageMeters !== undefined ? Number(p.details.fabricUsageMeters) : (w + 30) / 100;
    unit = 'mt';
  } else if (typeUpper === 'FON') {
    size = p.details?.fabricUsageMeters !== undefined ? Number(p.details.fabricUsageMeters) : (w * 2.5) / 100;
    unit = 'mt';
  } else if (typeUpper === 'RUSTIK') {
    size = p.details?.billingWidth !== undefined ? Number(p.details.billingWidth) / 100 : (w + 40) / 100;
    unit = 'mt';
  } else if (typeUpper === 'TAVAN_RUSTIK') {
    size = 1.0;
    unit = 'mt';
  } else if (typeUpper === 'BIRIZ') {
    size = p.details?.birizTulMeters !== undefined ? Number(p.details.birizTulMeters) : (w * 3.20) / 100;
    unit = 'mt';
  } else {
    const metric = calculateMetricSize(p, group, w, h);
    size = metric.size;
    unit = metric.unit;
  }

  return {
    id: crypto.randomUUID(),
    measurementId: p.id,
    roomName,
    windowName,
    productType: label,
    productGroup: group,
    width: w,
    height: h,
    calcWidth: p.details?.billingWidth || w,
    calcHeight: p.details?.billingHeight || h,
    quantity: Number(p.rawValues?.quantity || 1),
    metricSize: Number(size.toFixed(2)),
    metricUnit: unit,
    pleatDetails: p.rawValues?.pleat || undefined,
    unitPrice: 0,
    discount: 0,
    rowTotal: 0,
    note: p.notes || undefined
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
  const compName = g.jumboPurchaseUnitPrice === 250 ? 'Ağır hizmet mekanizması' : (g.jumboPurchaseUnitPrice === 400 ? 'Güçlendirilmiş üst kasa / ağır sistem' : `Jumbo ${parentProductType} Mekanizması`);

  let unit: 'm2' | 'mt' | 'adet' = 'mt';
  if (g.jumboUnit === 'PIECE' || g.jumboUnit === 'SET') unit = 'adet';

  return {
    id: `${parentItemId}-jumbo`,
    measurementId: p.id,
    roomName,
    windowName: `${windowName}${g.sourceSegments?.length > 0 ? ` - Parça ${gIdx + 1}` : ''}`,
    productType: compName,
    productGroup: 'Mekanik Perde',
    width: g.realWidthCm,
    height: g.realHeightCm,
    calcWidth: g.calculatedWidthCm,
    calcHeight: g.calculatedHeightCm,
    quantity: g.quantity,
    metricSize: g.jumboQuantity,
    metricUnit: unit,
    unitPrice: g.originalSaleUnitPrice || 0, // default sale price
    discount: 0,
    rowTotal: Number((g.jumboQuantity * (g.originalSaleUnitPrice || 0) * g.quantity).toFixed(2)),
    note: 'Jumbo Mekanizma Farkı',
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
        if (calc.isSegmented && Array.isArray(calc.groups) && calc.groups.length > 0) {
          calc.groups.forEach((g: any, gIdx: number) => {
            const pObj: ProductMeasurement = {
              ...m,
              productType: ap.productType,
              productGroup: resolveMeasurementProductGroup({ productType: ap.productType }),
              selectedProducts: [ap],
              rawValues: {
                ...m.rawValues,
                width: g.realWidthCm,
                height: g.realHeightCm,
                quantity: g.quantity
              },
              details: {
                ...m.details,
                ...calc,
                billingWidth: g.calculatedWidthCm,
                billingHeight: g.calculatedHeightCm,
                totalM2: g.totalM2
              }
            };
            const mainItem = createSaleItemFromMeasurement(pObj, room?.name || 'Oda', `${win?.name || 'Pencere'} - Parça ${gIdx + 1}`, ap.productType);
            mainItem.id = `${m.id}-${ap.productType}-g${gIdx}`;
            items.push(mainItem);

            if (g.requiresJumbo) {
              const jumboItem = createJumboSaleItem(m, g, gIdx, mainItem.id, room?.name || 'Oda', win?.name || 'Pencere', ap.productType);
              items.push(jumboItem);
            }
          });
        } else {
          const pObj: ProductMeasurement = {
            ...m,
            productType: ap.productType,
            productGroup: resolveMeasurementProductGroup({ productType: ap.productType }),
            selectedProducts: [ap],
            details: {
              ...m.details,
              ...calc
            }
          };
          const mainItem = createSaleItemFromMeasurement(pObj, room?.name || 'Oda', win?.name || 'Pencere', ap.productType);
          mainItem.id = `${m.id}-${ap.productType}-g0`;
          items.push(mainItem);

          const singleGroup = calc.groups?.[0];
          if (singleGroup?.requiresJumbo) {
            const jumboItem = createJumboSaleItem(m, singleGroup, 0, mainItem.id, room?.name || 'Oda', win?.name || 'Pencere', ap.productType);
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

export async function syncOrCreateDraftSale(customer: Customer, salesStore: any): Promise<string> {
  const existingDraft = salesStore.sales.find((s: any) => s.customerId === customer.id && s.status === 'TASLAK' && !s.isDeleted);
  const newSaleObj = createDraftSaleFromCustomer(customer);
  const newItems = newSaleObj.items;

  if (!existingDraft) {
    await salesStore.addSale(newSaleObj);
    return newSaleObj.id;
  }

  const mergedItems: SaleItem[] = [];

  existingDraft.items.forEach((existing: any) => {
    if (!existing.measurementId) {
      mergedItems.push(existing);
      return;
    }

    const match = newItems.find(n => n.id === existing.id || (n.measurementId === existing.measurementId && n.productType === existing.productType && n.windowName === existing.windowName));
    if (match) {
      mergedItems.push({
        ...existing,
        id: match.id,
        roomName: match.roomName,
        windowName: match.windowName,
        width: match.width,
        height: match.height,
        calcWidth: match.calcWidth,
        calcHeight: match.calcHeight,
        metricSize: match.metricSize,
        metricUnit: match.metricUnit,
        quantity: match.quantity
      });
    }
  });

  newItems.forEach(n => {
    if (!n.measurementId) return;
    const exists = existingDraft.items.some((e: any) => e.id === n.id || (e.measurementId === n.measurementId && e.productType === n.productType && e.windowName === n.windowName));
    if (!exists) {
      mergedItems.push(n);
    }
  });

  const updatedSale = {
    ...existingDraft,
    items: mergedItems,
    updatedAt: new Date().toISOString()
  };

  await salesStore.updateSale(updatedSale);
  return existingDraft.id;
}
