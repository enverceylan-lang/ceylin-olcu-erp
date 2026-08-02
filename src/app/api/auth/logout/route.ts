import {
  NextResponse,
} from "next/server";

import {
  ERP_ACTIVE_SCOPE_COOKIE,
} from "@/lib/erpActiveScopeCookie";

export async function POST() {
  const response =
    NextResponse.json(
      {
        success: true,
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      },
    );

  for (const name of [
    ERP_ACTIVE_SCOPE_COOKIE,
    "enverp_company_slug",
  ]) {
    response.cookies.set(
      name,
      "",
      {
        httpOnly: true,
        sameSite: "lax",
        secure:
          process.env.NODE_ENV ===
          "production",
        path: "/",
        maxAge: 0,
        expires: new Date(0),
      },
    );
  }

  return response;
}