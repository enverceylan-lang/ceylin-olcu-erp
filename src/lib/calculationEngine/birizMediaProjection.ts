import { optimizeBirizSharedFabric, type BirizKind, type BirizSharedFabricResult } from './birizSharedFabric';

/** MEDYA V5 scope. No stock selection at measurement / preparation time. */
export interface BirizMediaScope {
  tenantId: string;
  companyId: string;
  branchId: string;
  accountingPeriodId: string;
  customerId: string;
  customerAddressId: string;
  roomId: string;
}
export interface BirizMediaMeasurement {
  measurementId: string;
  scope: BirizMediaScope;
  productType: 'BIRIZ';
  kind: BirizKind;
  widthCm: number;
  heightCm: number;
  isDeleted?: boolean;
  isArchived?: boolean;
}
export type BirizMediaSaleLineKind = 'TUL' | 'ROD' | 'CAP';
export interface BirizMediaSaleLine {
  id: string;
  kind: BirizMediaSaleLineKind;
  label: string;
  metricSize: number;
  metricUnit: 'mt' | 'adet';
  sourceMeasurementIds: string[];
}
export interface BirizMediaProjection {
  ruleVersion: 'BIRIZ_MEDIA_V5_STANDARD_280_30_320';
  scope: BirizMediaScope;
  result: BirizSharedFabricResult;
  saleLines: BirizMediaSaleLine[];
  /** This is cutting provenance, not a tailor work order. */
  cuttingGroups: BirizSharedFabricResult['fabricGroupBreakdown'];
}
const KEYS: (keyof BirizMediaScope)[] = ['tenantId','companyId','branchId','accountingPeriodId','customerId','customerAddressId','roomId'];
const RULE_VERSION = 'BIRIZ_MEDIA_V5_STANDARD_280_30_320' as const;
/** Pure projection, no mutation, pricing, storage or network. SAME ROOM => SAME STANDARD TUL is a business rule. */
export function prepareBirizMediaRoom(
  scope: BirizMediaScope,
  measurements: readonly BirizMediaMeasurement[]
): BirizMediaProjection {
  if (!scope || !Array.isArray(measurements) || !measurements.length) throw new Error('BIRIZ_MEDIA_INPUT_REQUIRED');
  for (const key of KEYS) {
    if (typeof scope[key] !== 'string' || !scope[key].trim()) throw new Error(`BIRIZ_MEDIA_SCOPE_${key}_REQUIRED`);
  }
  const ids = new Set<string>();
  const pieces = measurements.map((m) => {
    if (!m || m.productType !== 'BIRIZ' || m.isDeleted || m.isArchived) throw new Error('BIRIZ_MEDIA_INELIGIBLE_MEASUREMENT');
    if (typeof m.measurementId !== 'string' || !m.measurementId.trim() || ids.has(m.measurementId)) throw new Error('BIRIZ_MEDIA_DUPLICATE_OR_MISSING_ID');
    ids.add(m.measurementId);
    if (!m.scope || KEYS.some(k => m.scope[k] !== scope[k])) throw new Error('BIRIZ_MEDIA_SCOPE_MISMATCH');
    return {
      measurementId: m.measurementId, kind: m.kind, widthCm: m.widthCm, heightCm: m.heightCm,
      foldingAllowanceCm: 30,
      // No stock required in MEDYA: the business rule is same standard tul per room.
      compatibilityKey: 'ROOM_STANDARD_TUL_V5'
    };
  });
  const result = optimizeBirizSharedFabric({
    scope: {...scope, fabricAuthorityId: 'ROOM_STANDARD_TUL_V5'},
    usableFabricWidthCm: 280,
    cuttingConstraintsVerified: true, // business-rule declaration, NOT physical material verification
    pieces
  });
  const sourceMeasurementIds = [...result.sourceMeasurementIds];
  const line = (kind: BirizMediaSaleLineKind, metricSize: number, metricUnit: 'mt'|'adet', label: string): BirizMediaSaleLine => ({
    id: `${RULE_VERSION}:${scope.roomId}:${kind}`,
    kind,label,metricSize,metricUnit,sourceMeasurementIds: [...sourceMeasurementIds]
  });
  return {
    ruleVersion: RULE_VERSION, scope: {...scope},result,
    saleLines: [line('TUL',result.fabricMeters,'mt','Biriz ortak tül'),line('ROD',result.rodMeters,'mt','Biriz çubuk'),line('CAP',result.capsCount,'adet','Biriz başlık')],
    cuttingGroups: result.fabricGroupBreakdown
  };
}
