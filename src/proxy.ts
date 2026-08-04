import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  COMPANY_HOME_SEGMENT,
  COMPANY_INTERNAL_ROOTS,
  getCompanySlugFromPath,
  isCompanyInternalPath,
  isValidCompanySlug,
} from "./lib/companyRouting";
import {
  decideLocalSurfaceRequest,
  normalizeLocalCompanySlug,
  normalizeLocalSurface,
} from "./lib/localSurface";

const COMPANY_SLUG_COOKIE =
  "enverp_company_slug";

function getActiveCompanySlug(
  request: NextRequest,
): string | null {
  const value =
    String(
      request.cookies.get(
        COMPANY_SLUG_COOKIE,
      )?.value || "",
    )
      .trim()
      .toLowerCase();

  return isValidCompanySlug(
    value,
  )
    ? value
    : null;
}

function getRootSegment(
  pathname: string,
): string {
  return (
    pathname
      .split("/")
      .filter(Boolean)[0]
      ?.trim()
      .toLowerCase() ||
    ""
  );
}

function isLegacyInternalPath(
  pathname: string,
): boolean {
  if (pathname === "/") {
    return true;
  }

  return COMPANY_INTERNAL_ROOTS.has(
    getRootSegment(pathname),
  );
}

export function proxy(
  request: NextRequest,
) {
  const {
    pathname,
  } =
    request.nextUrl;

  const activeCompanySlug =
    getActiveCompanySlug(
      request,
    );

  const localSurface =
    normalizeLocalSurface(
      process.env.ENVERP_LOCAL_SURFACE,
    );

  const localCompanySlug =
    normalizeLocalCompanySlug(
      process.env
        .ENVERP_LOCAL_COMPANY_SLUG,
    );

  const pathCompanySlug =
    getCompanySlugFromPath(
      pathname,
    );

  const localDecision =
    decideLocalSurfaceRequest({
      surface: localSurface,
      pathname,
      localCompanySlug,
      hasActiveCompanySlug:
        Boolean(activeCompanySlug),
      hasCompanySlugInPath:
        Boolean(pathCompanySlug),
    });

  if (
    localDecision.action ===
      "FORBID"
  ) {
    return NextResponse.json(
      {
        success: false,
        code: localDecision.code,
      },
      {
        status: 403,
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      },
    );
  }

  if (
    localDecision.action ===
      "REDIRECT"
  ) {
    const redirectUrl =
      request.nextUrl.clone();

    redirectUrl.pathname =
      localDecision.pathname;
    redirectUrl.search = "";

    return NextResponse.redirect(
      redirectUrl,
    );
  }

  if (
    localSurface === "SHARED" &&
    pathname === "/"
  ) {
    if (activeCompanySlug) {
      const companyHomeUrl =
        request.nextUrl.clone();

      companyHomeUrl.pathname =
        `/${activeCompanySlug}/${COMPANY_HOME_SEGMENT}`;
      companyHomeUrl.search = "";

      return NextResponse.redirect(
        companyHomeUrl,
      );
    }

    return new NextResponse(
      "Not Found",
      {
        status: 404,
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      },
    );
  }

  if (
    localSurface === "SHARED" &&
    (
      pathname === "/platform" ||
      pathname.startsWith("/platform/") ||
      pathname === "/super-admin" ||
      pathname.startsWith("/super-admin/") ||
      pathname === "/api/auth/login" ||
      pathname.startsWith("/api/platform/")
    )
  ) {
    return new NextResponse(
      "Not Found",
      {
        status: 404,
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      },
    );
  }

  if (
    localSurface === "SHARED" &&
    !activeCompanySlug &&
    isLegacyInternalPath(pathname)
  ) {
    return new NextResponse(
      "Not Found",
      {
        status: 404,
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      },
    );
  }

  if (
    isCompanyInternalPath(
      pathname,
    )
  ) {
    if (
      !pathCompanySlug ||
      activeCompanySlug !==
        pathCompanySlug
    ) {
      const loginUrl =
        request.nextUrl.clone();

      loginUrl.pathname =
        pathCompanySlug
          ? `/${pathCompanySlug}`
          : "/";

      loginUrl.search = "";

      return NextResponse.redirect(
        loginUrl,
      );
    }

    const segments =
      pathname
        .split("/")
        .filter(Boolean);

    const internalSegments =
      segments.slice(1);

    const rewriteUrl =
      request.nextUrl.clone();

    if (
      internalSegments[0] ===
        COMPANY_HOME_SEGMENT
    ) {
      rewriteUrl.pathname =
        "/";
    }
    else {
      rewriteUrl.pathname =
        "/" +
        internalSegments.join("/");
    }

    return NextResponse.rewrite(
      rewriteUrl,
    );
  }

  if (
    activeCompanySlug &&
    isLegacyInternalPath(
      pathname,
    )
  ) {
    const redirectUrl =
      request.nextUrl.clone();

    if (pathname === "/") {
      redirectUrl.pathname =
        `/${activeCompanySlug}/${COMPANY_HOME_SEGMENT}`;
    }
    else {
      redirectUrl.pathname =
        `/${activeCompanySlug}${pathname}`;
    }

    return NextResponse.redirect(
      redirectUrl,
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/:path*",
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons|apple-touch-icon.png).*)",
  ],
};