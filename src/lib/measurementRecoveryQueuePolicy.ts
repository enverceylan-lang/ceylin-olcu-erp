/** Fail-closed, pure queue lineage check. Does not access IndexedDB/server. */
export type QueueLineageEvent = {
  changeId: string;
  entityId: string;
  entityType: string;
  operation: string;
  expectedVersion?: number;
  syncStatus: string;
  createdAt: string;
};
export function hasExclusiveBlockedInsertLineage(
  target: QueueLineageEvent,
  related: readonly QueueLineageEvent[],
): boolean {
  if (!target.changeId || !target.entityId ||
      target.entityType !== 'MEASUREMENT' ||
      target.operation !== 'INSERT' || target.syncStatus !== 'BLOCKED' ||
      target.expectedVersion !== 0 ||
      !Number.isFinite(Date.parse(target.createdAt))) return false;
  // No device timestamps can prove event ordering across devices.
  // Any other event on this measurement makes auto-reactivation unsafe.
  return related.filter(e => e.entityType === 'MEASUREMENT' &&
    e.entityId === target.entityId).length === 1 &&
    related.some(e => e.changeId === target.changeId &&
      e.entityType === target.entityType && e.entityId === target.entityId &&
      e.operation === target.operation && e.syncStatus === target.syncStatus &&
      e.expectedVersion === target.expectedVersion);
}
