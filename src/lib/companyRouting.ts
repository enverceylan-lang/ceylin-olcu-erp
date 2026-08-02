export const COMPANY_HOME_SEGMENT =
  "ana-sayfa";

export const COMPANY_INTERNAL_ROOTS =
  new Set([
    "ajanda",
    "ayarlar",
    "bekleyen-hakedisler",
    "cariler",
    "finans",
    "gorevler",
    "hakedislerim",
    "montaj",
    "olculer",
    "operasyonlar",
    "raporlar",
    "satis",
    "stok",
    "uretim",
  ]);

export const RESERVED_ROOT_SEGMENTS =
  new Set([
    "",
    "api",
    "_next",
    "super-admin",
    ...COMPANY_INTERNAL_ROOTS,
  ]);

export function isValidCompanySlug(
  value: string,
): boolean {
  return (
    /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/
      .test(
        String(value || "")
          .trim()
          .toLowerCase(),
      )
  );
}

export function getCompanySlugFromPath(
  pathname: string,
): string | null {
  const segments =
    String(pathname || "")
      .split("/")
      .filter(Boolean);

  if (segments.length < 1) {
    return null;
  }

  const first =
    segments[0]
      .trim()
      .toLowerCase();

  if (
    RESERVED_ROOT_SEGMENTS.has(first) ||
    !isValidCompanySlug(first)
  ) {
    return null;
  }

  return first;
}

export function normalizeCompanyAppPath(
  pathname: string,
): string {
  const cleanPath =
    String(pathname || "/")
      .split("?")[0]
      .split("#")[0];

  const companySlug =
    getCompanySlugFromPath(
      cleanPath,
    );

  if (!companySlug) {
    return cleanPath || "/";
  }

  const segments =
    cleanPath
      .split("/")
      .filter(Boolean);

  if (segments.length === 1) {
    return "/";
  }

  const second =
    segments[1]
      .trim()
      .toLowerCase();

  if (
    second ===
      COMPANY_HOME_SEGMENT
  ) {
    return "/";
  }

  if (
    !COMPANY_INTERNAL_ROOTS.has(
      second,
    )
  ) {
    return cleanPath;
  }

  return (
    "/" +
    segments
      .slice(1)
      .join("/")
  );
}

export function withCompanyPrefix(
  currentPathname: string,
  targetPath: string,
): string {
  const cleanTarget =
    String(targetPath || "/")
      .trim();

  if (
    !cleanTarget.startsWith("/")
  ) {
    return cleanTarget;
  }

  const companySlug =
    getCompanySlugFromPath(
      currentPathname,
    );

  if (!companySlug) {
    return cleanTarget;
  }

  if (cleanTarget === "/") {
    return (
      `/${companySlug}/` +
      COMPANY_HOME_SEGMENT
    );
  }

  return (
    `/${companySlug}` +
    cleanTarget
  );
}

export function isCompanyInternalPath(
  pathname: string,
): boolean {
  const companySlug =
    getCompanySlugFromPath(
      pathname,
    );

  if (!companySlug) {
    return false;
  }

  const segments =
    String(pathname || "")
      .split("/")
      .filter(Boolean);

  if (segments.length < 2) {
    return false;
  }

  const second =
    segments[1]
      .trim()
      .toLowerCase();

  return (
    second ===
      COMPANY_HOME_SEGMENT ||
    COMPANY_INTERNAL_ROOTS.has(
      second,
    )
  );
}