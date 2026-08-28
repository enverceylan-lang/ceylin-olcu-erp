import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  createClient,
} from "@supabase/supabase-js";

import {
  verifyAuth,
} from "@/lib/authHelper";
import {
  readRequestedErpScopeId,
} from "@/lib/erpActiveScopeCookie";
import {
  loadShadowErpContext,
} from "@/lib/serverErpContext";

export const runtime = "nodejs";
export const dynamic =
  "force-dynamic";

export function json(
  body: unknown,
  status = 200,
) {
  return NextResponse.json(
    body,
    {
      status,
      headers: {
        "Cache-Control":
          "no-store, max-age=0",
      },
    },
  );
}

export async function loadPurchaseServerAuthority(
  request: NextRequest,
) {
  const user =
    await verifyAuth(
      request,
    );

  if (!user) {
    return {
      ok: false as const,
      response:
        json(
          {
            success: false,
            error:
              "UNAUTHORIZED",
          },
          401,
        ),
    };
  }

  if (
    String(
      user.role || "",
    ).toUpperCase() !==
    "ADMIN"
  ) {
    return {
      ok: false as const,
      response:
        json(
          {
            success: false,
            error:
              "PURCHASE_ADMIN_REQUIRED",
          },
          403,
        ),
    };
  }

  const url =
    process.env.SUPABASE_URL ||
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;
  const credential =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY;

  if (
    !url ||
    !credential
  ) {
    return {
      ok: false as const,
      response:
        json(
          {
            success: false,
            error:
              "SERVER_CONFIGURATION_MISSING",
          },
          500,
        ),
    };
  }

  const client =
    createClient(
      url,
      credential,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

  const context =
    await loadShadowErpContext(
      client,
      user.id,
      {
        requestedScopeId:
          readRequestedErpScopeId(
            request,
          ),
      },
    );

  if (!context.ready) {
    return {
      ok: false as const,
      response:
        json(
          {
            success: false,
            error:
              `ERP_CONTEXT_${context.reason}`,
          },
          403,
        ),
    };
  }

  return {
    ok: true as const,
    user,
    client,
    context,
  };
}
