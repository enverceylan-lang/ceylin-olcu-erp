import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getCompanySlugFromPath,
  isValidCompanySlug,
} from "@/lib/companyRouting";

const COMPANY_SLUG_COOKIE =
  "enverp_company_slug";

function resolveCompanySlug(
  request: NextRequest,
): string | null {
  const cookieSlug =
    String(
      request.cookies.get(
        COMPANY_SLUG_COOKIE,
      )?.value || "",
    )
      .trim()
      .toLowerCase();

  if (isValidCompanySlug(cookieSlug)) {
    return cookieSlug;
  }

  const referer =
    request.headers.get("referer");

  if (!referer) {
    return null;
  }

  try {
    return getCompanySlugFromPath(
      new URL(referer).pathname,
    );
  } catch {
    return null;
  }
}

export function GET(
  request: NextRequest,
) {
  const companySlug =
    resolveCompanySlug(request);

  const startUrl =
    companySlug
      ? `/${companySlug}`
      : "/";

  return NextResponse.json(
    {
      name:
        "ENVerp — Enable Network Veritable",
      short_name:
        "ENVerp",
      description:
        "ENVerp iş, saha ve operasyon yönetim platformu",
      start_url:
        startUrl,
      scope:
        "/",
      display:
        "standalone",
      orientation:
        "portrait",
      background_color:
        "#071327",
      theme_color:
        "#071327",
      lang:
        "tr-TR",
      dir:
        "ltr",
      icons: [
        {
          src:
            "/icons/icon-192x192.png",
          sizes:
            "192x192",
          type:
            "image/png",
          purpose:
            "any",
        },
        {
          src:
            "/icons/icon-512x512.png",
          sizes:
            "512x512",
          type:
            "image/png",
          purpose:
            "any",
        },
        {
          src:
            "/icons/icon-maskable-512x512.png",
          sizes:
            "512x512",
          type:
            "image/png",
          purpose:
            "maskable",
        },
      ],
    },
    {
      headers: {
        "Cache-Control":
          "no-store, max-age=0",
        "Content-Type":
          "application/manifest+json; charset=utf-8",
      },
    },
  );
}