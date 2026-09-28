export interface SyncFallbackNameDecisionInput {
  localName?: unknown;
  remoteName?: unknown;
  localUpdatedAt?: unknown;
  remoteUpdatedAt?: unknown;
  fallbackName: string;
}

function cleanName(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function timestamp(value: unknown): number {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : 0;
  }

  if (typeof value === "string" || typeof value === "number") {
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
  }

  return 0;
}

export function shouldPreferRemoteSyncName({
  localName,
  remoteName,
  localUpdatedAt,
  remoteUpdatedAt,
  fallbackName,
}: SyncFallbackNameDecisionInput): boolean {
  const local = cleanName(localName);
  const remote = cleanName(remoteName);
  const fallback = cleanName(fallbackName);

  const repairsFallback =
    local === fallback &&
    remote.length > 0 &&
    remote !== fallback;

  const remoteIsNewer =
    timestamp(remoteUpdatedAt) > timestamp(localUpdatedAt);

  return repairsFallback || remoteIsNewer;
}
