/* SECURITY NOTE: ConfirmedParent.serverVerified is a caller assertion, NOT
 * cryptographic/server-origin proof. DO NOT expose automatic invocation until
 * an authenticated server read is implemented and verified in production. */
/**
 * ENVERP b596: fail-closed eligibility for a previously blocked measurement.
 * Pure function; does NOT mutate queue, customer data, or server.
 * Authoritative parent confirmation MUST be obtained externally from the
 * server for the same ERP scope and exact parent IDs; local presence is not proof.
 */
export type RecoveryScope = Readonly<{
  tenantId: string;
  companyId: string;
  branchId: string;
  accountingPeriodId: string;
}>;

export type RecoveryEvent = Readonly<{
  changeId: string;
  entityId: string;
  entityType: string;
  operation: string;
  syncStatus: string;
  blockedReason?: string;
  scope?: Partial<RecoveryScope>;
  patch?: {
    customerId?: string;
    roomId?: string;
    openingId?: string;
    windowId?: string;
    data?: { customerId?: string; roomId?: string; openingId?: string; windowId?: string };
  };
}>;

export type ConfirmedParent = Readonly<{
  /** Result of a successful server-side authoritative read, not local DB. */
  serverVerified: true;
  scope: RecoveryScope;
  customerId: string;
  roomId: string;
  openingId?: string;
  customerDeleted: boolean;
  roomDeleted: boolean;
  openingDeleted?: boolean;
}>;

const scopeFields = ['tenantId', 'companyId', 'branchId', 'accountingPeriodId'] as const;
const validId = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const sameScope = (a: Partial<RecoveryScope> | undefined, b: RecoveryScope) =>
  !!a && scopeFields.every(k => validId(a[k]) && a[k] === b[k]);

export function canRecoverBlockedMeasurement(args: {
  event: RecoveryEvent;
  activeScope: RecoveryScope;
  parent: ConfirmedParent | null;
  /** Conservative: any later write/delete/conflict or unknown chronology rejects. */
  noLaterMutationOrConflict: boolean;
  /** Explicit server/tenant authorization for the current authenticated actor. */
  authorizedForScope: boolean;
}): boolean {
  const { event, activeScope, parent, noLaterMutationOrConflict, authorizedForScope } = args;
  if (!authorizedForScope || !noLaterMutationOrConflict || !parent || parent.serverVerified !== true) return false;
  if (event.entityType !== 'MEASUREMENT' || event.operation !== 'INSERT' || event.syncStatus !== 'BLOCKED') return false;
  if (!['PARENT_ROOM_MISSING', 'PARENT_OPENING_MISSING'].includes(event.blockedReason || '')) return false;
  if (!validId(event.changeId) || !validId(event.entityId)) return false;
  if (!sameScope(event.scope, activeScope) || !sameScope(parent.scope, activeScope)) return false;
  if (parent.customerDeleted || parent.roomDeleted || !validId(parent.customerId) || !validId(parent.roomId)) return false;
  const patch = event.patch;
  const data = patch?.data || patch;
  if (!data) return false;
  const customerId = data.customerId || patch?.customerId;
  const roomId = data.roomId || patch?.roomId;
  const openingId = data.openingId || data.windowId || patch?.openingId || patch?.windowId || '';
  if (!validId(customerId) || !validId(roomId)) return false;
  if (customerId !== parent.customerId || roomId !== parent.roomId) return false;
  if (data.openingId && data.windowId && data.openingId !== data.windowId) return false;
  if (patch?.openingId && patch?.windowId && patch.openingId !== patch.windowId) return false;
  // Reject disagreement between root and nested identities instead of silently selecting one.
  for (const key of ["customerId", "roomId", "openingId", "windowId"] as const) {
    if (validId(patch?.[key]) && validId(patch?.data?.[key]) && patch[key] !== patch.data[key]) return false;
  }
  if (event.blockedReason === 'PARENT_OPENING_MISSING' && !openingId) return false;
  if (openingId && (parent.openingDeleted !== false || parent.openingId !== openingId)) return false;
  // Optional opening is not permission to recover an event whose parent proof refers to another opening.
  if (!openingId && validId(parent.openingId)) return false;
  return true;
}
