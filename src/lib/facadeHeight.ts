const FACADE_HEIGHT_KEYS = [
  'solYukseklikCm',
  'ortaYukseklikCm',
  'sagYukseklikCm'
] as const;

export function getEnteredFacadeHeights(
  rawValues: Record<string, unknown>
): number[] {
  return FACADE_HEIGHT_KEYS
    .map(key => Number(rawValues[key] || 0))
    .filter(
      value =>
        Number.isFinite(value) &&
        value > 0
    );
}

export function resolveFacadeHeight(
  rawValues: Record<string, unknown>,
  fallback = 0
): number {
  const enteredHeights =
    getEnteredFacadeHeights(rawValues);

  if (enteredHeights.length > 0) {
    return Math.min(...enteredHeights);
  }

  const fallbackCandidates = [
    rawValues.windowHeight,
    rawValues.height,
    fallback
  ]
    .map(value => Number(value || 0))
    .filter(
      value =>
        Number.isFinite(value) &&
        value > 0
    );

  return fallbackCandidates[0] || 0;
}

export function hasSlopedFacadeHeight(
  rawValues: Record<string, unknown>
): boolean {
  const distinctHeights =
    new Set(
      getEnteredFacadeHeights(
        rawValues
      ).map(value => value.toFixed(3))
    );

  return distinctHeights.size > 1;
}
