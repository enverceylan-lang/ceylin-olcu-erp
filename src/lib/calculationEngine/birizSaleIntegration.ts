/**
 * MEDYA V5 integration with V4 sale creation. This is not a second price authority.
 * No stock selection is needed: room-standard fabric is the business policy.
 * Existing non-Biriz sale items are returned unchanged.
 */
import type { ErpScope } from '@/lib/erpScope';
import type { Room } from '@/store/useStore';
import type { MeasurementRecord } from '@/store/measurementStore';
import type { SaleItem } from '@/store/salesStore';
import { getMeasurementDimensions } from '@/lib/measurementAdapter';
import { prepareBirizMediaRoom, type BirizMediaMeasurement, type BirizMediaScope } from './birizMediaProjection';

const RULE = 'BIRIZ_MEDIA_V5_STANDARD_280_30_320';

export interface BirizSalePreparationV5Input {
  items: SaleItem[];
  measurements: MeasurementRecord[];
  scope: ErpScope;
  customerId: string;
  customerAddressId: string;
  rooms: Room[];
  selectedTransferBundles?: Array<{measurementId: string; productType: string}>;
}

function requireText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`BIRIZ_V5_${field}_REQUIRED`);
  return value.trim();
}

function getV5Dimensions(m: MeasurementRecord): {widthCm: number; heightCm: number} {
  const product = m.selectedProducts?.find(p => p.isActive !== false && p.productType.toUpperCase() === 'BIRIZ');
  const calculation = product?.calculation || {};
  const dims = getMeasurementDimensions(m);
  // Match existing sale item dimension precedence; do not infer from arbitrary user text.
  const widthCm = Number(calculation.actualWidthCm || calculation.realWidthCm || dims.structuralWidth || 0);
  const heightCm = Number(calculation.actualHeightCm || calculation.realHeightCm || dims.structuralHeight || 0);
  if (![widthCm, heightCm].every(v => Number.isFinite(v) && v > 0)) throw new Error('BIRIZ_V5_DIMENSIONS_REQUIRED');
  return {widthCm, heightCm};
}

export function prepareBirizSaleItemsV5(input: BirizSalePreparationV5Input): SaleItem[] {
  const {items, measurements, scope, customerId, customerAddressId, rooms, selectedTransferBundles} = input;
  const requested = selectedTransferBundles === undefined ? null : new Set(
    selectedTransferBundles.filter(x => x.productType.toUpperCase() === 'BIRIZ').map(x => x.measurementId)
  );
  const birizMeasurements = measurements.filter(m =>
    (requested === null || requested.has(m.id)) &&
    m.selectedProducts?.some(p => p.isActive && p.productType.toUpperCase() === 'BIRIZ')
  );
  if (!birizMeasurements.length) return items;
  const common = {
    tenantId: requireText(scope.tenantId, 'TENANT'),
    companyId: requireText(scope.companyId, 'COMPANY'),
    branchId: requireText(scope.branchId, 'BRANCH'),
    accountingPeriodId: requireText(scope.accountingPeriodId, 'PERIOD'),
    customerId: requireText(customerId, 'CUSTOMER'),
    customerAddressId: requireText(customerAddressId, 'ADDRESS')
  };
  const selectedIds = new Set(birizMeasurements.map(m => m.id));
  if (selectedIds.size !== birizMeasurements.length) throw new Error('BIRIZ_V5_DUPLICATE_MEASUREMENT');
  const originals = new Map<string, SaleItem>();
  for (const m of birizMeasurements) {
    const original = items.filter(item => item.measurementId === m.id && item.id.startsWith(`${m.id}-BIRIZ-`));
    if (original.length !== 1) throw new Error('BIRIZ_V5_EXPECTED_ONE_CALCULATED_SALE_LINE');
    originals.set(m.id, original[0]);
    if (!m.roomId || !rooms.some(room => room.id === m.roomId && !room.isDeleted)) {
      throw new Error('BIRIZ_V5_ROOM_ID_INVALID');
    }
    if (String(m.customerAddressId || '').trim() !== common.customerAddressId) {
      throw new Error('BIRIZ_V5_ADDRESS_MISMATCH');
    }
  }
  const grouped = new Map<string, MeasurementRecord[]>();
  for (const m of birizMeasurements) {
    const existing = grouped.get(m.roomId) || [];
    existing.push(m);
    grouped.set(m.roomId, existing);
  }
  const result: SaleItem[] = items.filter(item => !(item.measurementId && selectedIds.has(item.measurementId) && item.id.startsWith(`${item.measurementId}-BIRIZ-`)));
  for (const [roomId, roomMeasurements] of grouped) {
    const roomScope: BirizMediaScope = {...common, roomId};
    const inputMeasurements: BirizMediaMeasurement[] = roomMeasurements.map(m => {
      const product = m.selectedProducts?.find(p => p.isActive && p.productType.toUpperCase() === 'BIRIZ');
      if (!product) throw new Error('BIRIZ_V5_ACTIVE_PRODUCT_REQUIRED');
      const kind = product.userOverrides?.birizType ?? m.rawValues?.birizType ?? 'SABIT';
      if (kind !== 'SABIT' && kind !== 'SALIK') throw new Error('BIRIZ_V5_KIND_INVALID');
      const {widthCm, heightCm} = getV5Dimensions(m);
      return { measurementId: m.id, scope: roomScope, productType: 'BIRIZ', kind, widthCm, heightCm,
        isDeleted: m.isDeleted, isArchived: m.isArchived};
    });
    const projection = prepareBirizMediaRoom(roomScope, inputMeasurements);
    const first = originals.get(roomMeasurements[0].id);
    if (!first) throw new Error('BIRIZ_V5_SOURCE_ITEM_MISSING');
    const sourceIds = [...projection.result.sourceMeasurementIds];
    const breakdown = roomMeasurements.map(m => ({...originals.get(m.id)!, productionBreakdown: undefined}));
    for (const line of projection.saleLines) {
      const item: SaleItem = {
        ...first,
        id: line.id,
        roomId,
        measurementId: sourceIds.join(','),
        windowName: 'Oda Toplamı',
        productType: line.label,
        productGroup: 'Biriz',
        stockItemId: undefined,
        width: 0, height: 0, calcWidth: 0, calcHeight: 0,
        quantity: 1,
        metricSize: line.metricSize,
        metricUnit: line.metricUnit,
        fabricMeters: line.kind === 'TUL' ? line.metricSize : 0,
        unitPrice: 0, discount: 0, rowTotal: 0,
        birizRuleVersion: RULE,
        birizSourceMeasurementIds: [...sourceIds],
        birizCuttingGroups: line.kind === 'TUL' ? projection.cuttingGroups : undefined,
        productionBreakdown: line.kind === 'TUL' ? breakdown : undefined,
        note: `${RULE} / ${line.kind}`
      };
      result.push(item);
    }
  }
  return result;
}
