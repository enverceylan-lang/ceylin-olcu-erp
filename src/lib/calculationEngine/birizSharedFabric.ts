/** ENVERP BIRIZ V5-A: pure optimizer. No persistence, pricing, sale mutation or I/O. */
export type BirizKind = 'SABIT' | 'SALIK';
export interface BirizScope {
  tenantId: string;
  companyId: string;
  branchId: string;
  accountingPeriodId: string;
  customerId: string;
  customerAddressId: string;
  roomId: string;
  fabricAuthorityId: string;
}
export interface BirizCutPiece {
  measurementId: string;
  kind: BirizKind;
  widthCm: number;
  heightCm: number;
  /** Must come from a verified product rule; not inferred from kind. */
  foldingAllowanceCm: number;
  /** Explicitly resolved fabric orientation/pattern compatibility partition. */
  compatibilityKey: string;
}
export interface BirizSharedFabricRequest {
  scope: BirizScope;
  /** Verified usable width after selvedge and production allowances. */
  usableFabricWidthCm: number;
  /** Explicit confirmation that orientation/pattern rules were resolved upstream. */
  cuttingConstraintsVerified: true;
  pieces: readonly BirizCutPiece[];
}
export interface BirizCutGroup {
  measurementIds: string[];
  occupiedFabricWidthCm: number;
  maxBirizWidthCm: number;
  fabricMeters: number;
}
export interface BirizSharedFabricResult {
  calculationVersion: 'BIRIZ_SHARED_FABRIC_V5A_1';
  scope: BirizScope;
  sourceMeasurementIds: string[];
  fabricGroupBreakdown: BirizCutGroup[];
  fabricMeters: number;
  rodMeters: number;
  capsCount: number;
  assumptions: { usableFabricWidthCm: number; multiplier: 3.2; roundingStepMeters: 0.1; constraintsVerified: true };
}
const SCOPE_KEYS: (keyof BirizScope)[] = ['tenantId','companyId','branchId','accountingPeriodId','customerId','customerAddressId','roomId','fabricAuthorityId'];
const MAX_PIECES = 14;
function requireFiniteNonnegative(value: number, name: string, positive: boolean): void {
  if (!Number.isFinite(value) || !Number.isSafeInteger(Math.round(value * 1000)) || (positive ? value <= 0 : value < 0)) {
    throw new Error(`BIRIZ_V5A_INVALID_${name}`);
  }
}
function tenthsOfMeters(widthCm: number): number {
  // width(cm) * 3.2 /100 (metres), rounded up in 0.1m increments.
  // Use a small floating tolerance to avoid binary artifacts at exact thresholds.
  return Math.ceil(widthCm * 3.2 / 10 - 1e-9);
}
/**
 * Exact subset-DP partitioning (<=14 pieces). Distinct compatibilityKeys never share a cut.
 * Do not pass vague or unverified compatibility: caller must prove direction/pattern constraints.
 */
export function optimizeBirizSharedFabric(request: BirizSharedFabricRequest): BirizSharedFabricResult {
  if (!request || !request.scope) throw new Error('BIRIZ_V5A_SCOPE_REQUIRED');
  const scope: BirizScope = { ...request.scope };
  for (const key of SCOPE_KEYS) {
    if (typeof scope[key] !== 'string' || (key !== 'customerAddressId' && !scope[key].trim())) throw new Error(`BIRIZ_V5A_SCOPE_${key}_REQUIRED`);
    scope[key] = scope[key].trim();
  }
  if (request.cuttingConstraintsVerified !== true) throw new Error('BIRIZ_V5A_CUTTING_CONSTRAINTS_UNVERIFIED');
  requireFiniteNonnegative(request.usableFabricWidthCm, 'FABRIC_WIDTH', true);
  const source = request.pieces;
  if (!Array.isArray(source) || source.length === 0) throw new Error('BIRIZ_V5A_PIECES_REQUIRED');
  if (source.length > MAX_PIECES) throw new Error('BIRIZ_V5A_EXACT_CAPACITY_EXCEEDED');
  const seen = new Set<string>();
  const pieces = source.map(p => {
    if (!p || typeof p.measurementId !== 'string' || !p.measurementId.trim()) throw new Error('BIRIZ_V5A_MEASUREMENT_ID_REQUIRED');
    const measurementId = p.measurementId.trim();
    if (seen.has(measurementId)) throw new Error('BIRIZ_V5A_DUPLICATE_MEASUREMENT');
    seen.add(measurementId);
    if (p.kind !== 'SABIT' && p.kind !== 'SALIK') throw new Error('BIRIZ_V5A_KIND_INVALID');
    if (typeof p.compatibilityKey !== 'string' || !p.compatibilityKey.trim()) throw new Error('BIRIZ_V5A_COMPATIBILITY_UNVERIFIED');
    requireFiniteNonnegative(p.widthCm,'PIECE_WIDTH',true);
    requireFiniteNonnegative(p.heightCm,'PIECE_HEIGHT',true);
    requireFiniteNonnegative(p.foldingAllowanceCm,'FOLDING_ALLOWANCE',false);
    const occupied = p.heightCm + p.foldingAllowanceCm;
    return { ...p, measurementId, compatibilityKey:p.compatibilityKey.trim(), occupied };
  }).sort((a,b)=> a.measurementId.localeCompare(b.measurementId,'en'));
  const n = pieces.length;
  const totalMasks = 1 << n;
  const widths = new Array<number>(totalMasks).fill(0);
  const maxCutWidth = new Array<number>(totalMasks).fill(0);
  const allowed = new Array<boolean>(totalMasks).fill(false);
  const costs = new Array<number>(totalMasks).fill(0);
  for (let mask=1; mask<totalMasks; mask++) {
    const bit=mask & -mask;
    const i=31-Math.clz32(bit);
    const prev=mask^bit;
    widths[mask]=widths[prev]+pieces[i].occupied;
    maxCutWidth[mask]=Math.max(maxCutWidth[prev],pieces[i].widthCm);
    const prevFirstIndex=prev ? 31-Math.clz32(prev & -prev) : i;
    // Oversize pieces are billed individually with the existing width-based rounding.
    allowed[mask] = prev === 0 || (
      widths[mask] <= request.usableFabricWidthCm + 1e-9 &&
      allowed[prev] && pieces[i].compatibilityKey === pieces[prevFirstIndex].compatibilityKey
    );
    if (allowed[mask]) costs[mask]=tenthsOfMeters(maxCutWidth[mask]);
  }
  const best = new Array<number>(totalMasks).fill(Infinity);
  const selected = new Array<number>(totalMasks).fill(0);
  best[0]=0;
  // Anchor the lowest set bit in each group to avoid equivalent permutations.
  for(let mask=1;mask<totalMasks;mask++) {
    const anchor=mask & -mask;
    for(let sub=mask; sub;sub=(sub-1)&mask) {
      if (!(sub&anchor) || !allowed[sub]) continue;
      const cost=costs[sub]+best[mask^sub];
      if(cost<best[mask]) { best[mask]=cost; selected[mask]=sub; }
      else if(cost===best[mask]) {
        const candidate = pieces.filter((_,i)=> Boolean(sub&(1<<i))).map(p=>p.measurementId).join(',');
        const old = pieces.filter((_,i)=> Boolean(selected[mask]&(1<<i))).map(p=>p.measurementId).join(',');
        if(candidate.localeCompare(old,'en')<0) selected[mask]=sub;
      }
    }
  }
  if(!Number.isFinite(best[totalMasks-1])) throw new Error('BIRIZ_V5A_NO_VALID_PARTITION');
  const groups: BirizCutGroup[]=[];
  let remaining=totalMasks-1;
  while(remaining) {
    const sub=selected[remaining];
    if(!sub) throw new Error('BIRIZ_V5A_INTERNAL_PARTITION');
    groups.push({
      measurementIds:pieces.filter((_,i)=>Boolean(sub&(1<<i))).map(p=>p.measurementId),
      occupiedFabricWidthCm:Number(widths[sub].toFixed(3)),
      maxBirizWidthCm:maxCutWidth[sub],
      fabricMeters:Number((costs[sub]/10).toFixed(2))
    });
    remaining^=sub;
  }
  groups.sort((a,b)=>a.measurementIds.join(',').localeCompare(b.measurementIds.join(','),'en'));
  const rodCentimeters = pieces.reduce((total,p)=>total+p.widthCm*(p.kind==='SABIT'?2:1),0);
  return {
    calculationVersion:'BIRIZ_SHARED_FABRIC_V5A_1', scope,
    sourceMeasurementIds:pieces.map(p=>p.measurementId),fabricGroupBreakdown:groups,
    fabricMeters:Number((best[totalMasks-1]/10).toFixed(2)),
    rodMeters:Number((rodCentimeters/100).toFixed(2)),
    capsCount:pieces.reduce((n,p)=>n+(p.kind==='SABIT'?4:2),0),
    assumptions:{usableFabricWidthCm:request.usableFabricWidthCm,multiplier:3.2,roundingStepMeters:0.1,constraintsVerified:true}
  };
}
