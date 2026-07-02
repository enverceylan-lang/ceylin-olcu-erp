import { Customer, ProductMeasurement } from '@/store/useStore';
import { Sale, SaleItem } from '@/store/salesStore';
import { getMeasurementDimensions } from '@/lib/measurementAdapter';

/**
 * Ürün grubunu tahmin eder.
 */
function guessProductGroup(templateType: string): string {
  const t = templateType.toUpperCase();
  if (t === 'PLICELL') return 'Plicell';
  if (t === 'MECHANICAL_CURTAIN') return 'Mekanik Perde';
  if (t === 'CURTAIN' || t === 'CURTAIN_DETAIL') return 'Kumaş/Tül/Fon';
  if (t === 'SIMPLE_WIDTH_HEIGHT') return 'Standart Ölçü';
  return 'Diğer';
}

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
function createSaleItemFromMeasurement(p: ProductMeasurement, roomName: string, windowName: string): SaleItem {
  const dims = getMeasurementDimensions(p);
  const w = dims.structuralWidth || 0;
  const h = dims.structuralHeight || 0;
  
  const group = guessProductGroup(p.templateType);
  const metric = calculateMetricSize(p, group, w, h);
  
  return {
    id: crypto.randomUUID(),
    measurementId: p.id,
    roomName,
    windowName,
    productType: p.templateType,
    productGroup: group,
    width: w,
    height: h,
    calcWidth: w,
    calcHeight: h,
    quantity: 1,
    metricSize: Number(metric.size.toFixed(2)),
    metricUnit: metric.unit,
    pleatDetails: p.rawValues?.pleat || undefined,
    unitPrice: 0,
    discount: 0,
    rowTotal: 0,
    note: p.notes || undefined
  };
}

/**
 * Cari'ye ait tüm ölçüleri bir Sale objesine dönüştürür (Snapshot)
 */
export function createDraftSaleFromCustomer(customer: Customer): Sale {
  const items: SaleItem[] = [];
  
  customer.rooms?.forEach(room => {
    room.windows?.forEach(win => {
      win.products?.forEach(p => {
        items.push(createSaleItemFromMeasurement(p, room.name, win.name));
      });
    });
  });
  
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
