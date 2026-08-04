export const PILOT_FIELD_V1_OVERRIDE_KEY =
  "pilotFieldV1";

let pilotFieldV1RuntimeEnabled = false;

export function isPilotFieldV1Override(
  featureOverrides:
    Record<string, unknown> | null | undefined,
): boolean {
  return (
    featureOverrides?.[
      PILOT_FIELD_V1_OVERRIDE_KEY
    ] === true
  );
}

export function setPilotFieldV1RuntimeEnabled(
  enabled: boolean,
): void {
  pilotFieldV1RuntimeEnabled =
    enabled === true;
}

export function isPilotFieldV1RuntimeEnabled():
  boolean {
  return pilotFieldV1RuntimeEnabled;
}

export function isPilotFieldV1PlaceholderPath(
  appPathname: string,
): boolean {
  const clean =
    String(appPathname || "/")
      .trim()
      .toLowerCase() || "/";

  if (
    clean === "/" ||
    clean === "/ana-sayfa" ||
    clean === "/cariler" ||
    clean.startsWith("/cariler/") ||
    clean === "/olculer" ||
    clean.startsWith("/olculer/") ||
    clean === "/satis" ||
    clean.startsWith("/satis/")
  ) {
    return false;
  }

  return true;
}