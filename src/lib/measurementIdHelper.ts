/**
 * Shared helper for producing deterministic, stable IDs for legacy measurement
 * payloads that do not carry an explicit ID field.
 *
 * Rules:
 *  - If a measurement already has an id, return it unchanged.
 *  - Otherwise, build a fingerprint from structural fields that do NOT change
 *    (customerId/sourceKey, roomId/name, windowId/name, type, source index)
 *    and produce a deterministic hex string prefixed with "legacy-".
 *  - Never use Math.random(), Date.now(), or crypto.randomUUID() here.
 *
 * The fingerprint uses SubtleCrypto SHA-256 when available (browser / Node 19+)
 * and a tiny pure-JS fallback hash for environments that lack it (e.g. old Jest).
 */

function simpleHash(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

async function sha256hex(input: string): Promise<string> {
  try {
    const subtle =
      typeof globalThis !== 'undefined' && (globalThis as any).crypto?.subtle;
    if (!subtle) throw new Error('no subtle');
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const buf = await subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    // Fallback for environments without SubtleCrypto
    return simpleHash(input).padEnd(16, '0');
  }
}

export interface LegacyMeasurementContext {
  /** customerId of the owning customer, or a stable source key */
  customerId: string;
  /** roomId or room.name as fallback */
  roomKey: string;
  /** windowId or window.name as fallback */
  windowKey: string;
  /** type / templateType of the measurement */
  type: string;
  /** 0-based index within the window's product list (stable ordering assumed) */
  sourceIndex: number;
}

/**
 * Returns a deterministic legacy ID for a measurement that has no id field.
 * The same context always produces the same output.
 */
export async function buildLegacyMeasurementId(
  ctx: LegacyMeasurementContext
): Promise<string> {
  const fingerprint = [
    ctx.customerId,
    ctx.roomKey,
    ctx.windowKey,
    ctx.type || 'UNKNOWN',
    String(ctx.sourceIndex),
  ].join('|');
  const hash = await sha256hex(fingerprint);
  return `legacy-${hash.substring(0, 24)}`;
}

/**
 * Convenience wrapper: if `existingId` is truthy, return it;
 * otherwise compute and return a legacy ID.
 */
export async function ensureMeasurementId(
  existingId: string | undefined | null,
  ctx: LegacyMeasurementContext
): Promise<string> {
  if (existingId) return existingId;
  return buildLegacyMeasurementId(ctx);
}

/** Shared localStorage key for measurement migration marker */
export const MEASUREMENT_MIGRATION_STATUS_KEY = 'measurement_migration_status';
