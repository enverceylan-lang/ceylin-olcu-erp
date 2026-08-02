export type EnverpLocalSurface =
  | "COMPANY"
  | "PLATFORM"
  | "SHARED";

export type LocalSurfaceDecision =
  | {
      action: "NEXT";
    }
  | {
      action: "REDIRECT";
      pathname: string;
    }
  | {
      action: "FORBID";
      code:
        | "COMPANY_SURFACE_REQUIRED"
        | "PLATFORM_SURFACE_REQUIRED";
    };

const COMPANY_LEGACY_ROOTS =
  new Set([
    "",
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

const PLATFORM_PAGE_ROOTS =
  new Set([
    "platform",
    "super-admin",
  ]);

export function normalizeLocalSurface(
  value: unknown,
): EnverpLocalSurface {
  const normalized =
    String(value || "")
      .trim()
      .toUpperCase();

  if (normalized === "COMPANY") {
    return "COMPANY";
  }

  if (normalized === "PLATFORM") {
    return "PLATFORM";
  }

  return "SHARED";
}

export function normalizeLocalCompanySlug(
  value: unknown,
): string {
  const normalized =
    String(value || "")
      .trim()
      .toLowerCase();

  return /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/
    .test(normalized)
      ? normalized
      : "ceylinperde";
}

function rootSegment(
  pathname: string,
): string {
  return (
    String(pathname || "/")
      .split("?")[0]
      .split("#")[0]
      .split("/")
      .filter(Boolean)[0]
      ?.trim()
      .toLowerCase() ||
    ""
  );
}

function isCompanyApi(
  pathname: string,
): boolean {
  return (
    pathname ===
      "/api/auth/company-login" ||
    pathname ===
      "/api/auth/company-scope-activate"
  );
}

function isPlatformApi(
  pathname: string,
): boolean {
  return (
    pathname === "/api/auth/login" ||
    pathname.startsWith(
      "/api/platform/",
    ) ||
    pathname === "/api/platform"
  );
}

function isSharedAuthApi(
  pathname: string,
): boolean {
  return (
    pathname === "/api/auth/logout"
  );
}

export function decideLocalSurfaceRequest(
  input: {
    surface: EnverpLocalSurface;
    pathname: string;
    localCompanySlug: string;
    hasActiveCompanySlug: boolean;
    hasCompanySlugInPath: boolean;
  },
): LocalSurfaceDecision {
  const pathname =
    String(input.pathname || "/")
      .split("?")[0]
      .split("#")[0] ||
    "/";

  if (input.surface === "SHARED") {
    return {
      action: "NEXT",
    };
  }

  const root =
    rootSegment(pathname);

  if (pathname.startsWith("/api/")) {
    if (isSharedAuthApi(pathname)) {
      return {
        action: "NEXT",
      };
    }

    if (input.surface === "COMPANY") {
      if (isPlatformApi(pathname)) {
        return {
          action: "FORBID",
          code:
            "COMPANY_SURFACE_REQUIRED",
        };
      }

      return {
        action: "NEXT",
      };
    }

    if (
      isPlatformApi(pathname)
    ) {
      return {
        action: "NEXT",
      };
    }

    return {
      action: "FORBID",
      code:
        "PLATFORM_SURFACE_REQUIRED",
    };
  }

  if (input.surface === "COMPANY") {
    if (PLATFORM_PAGE_ROOTS.has(root)) {
      return {
        action: "FORBID",
        code:
          "COMPANY_SURFACE_REQUIRED",
      };
    }

    if (
      pathname === "/" &&
      !input.hasActiveCompanySlug
    ) {
      return {
        action: "REDIRECT",
        pathname:
          `/${input.localCompanySlug}`,
      };
    }

    if (
      COMPANY_LEGACY_ROOTS.has(root) &&
      !input.hasActiveCompanySlug
    ) {
      return {
        action: "REDIRECT",
        pathname:
          `/${input.localCompanySlug}`,
      };
    }

    return {
      action: "NEXT",
    };
  }

  if (pathname === "/") {
    return {
      action: "REDIRECT",
      pathname: "/platform",
    };
  }

  if (PLATFORM_PAGE_ROOTS.has(root)) {
    return {
      action: "NEXT",
    };
  }

  if (
    input.hasCompanySlugInPath ||
    COMPANY_LEGACY_ROOTS.has(root)
  ) {
    return {
      action: "FORBID",
      code:
        "PLATFORM_SURFACE_REQUIRED",
    };
  }

  return {
    action: "FORBID",
    code:
      "PLATFORM_SURFACE_REQUIRED",
  };
}