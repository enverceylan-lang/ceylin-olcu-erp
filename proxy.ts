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
} from "./src/lib/companyRouting";

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

  if (
    isCompanyInternalPath(
      pathname,
    )
  ) {
    const pathCompanySlug =
      getCompanySlugFromPath(
        pathname,
      );

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
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons|apple-touch-icon.png).*)",
  ],
};