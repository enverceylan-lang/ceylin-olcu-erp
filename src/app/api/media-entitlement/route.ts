import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

import { readRequestedErpScopeId } from "@/lib/erpActiveScopeCookie";
import { requireCompanySession } from "@/lib/companySessionGuard";
import { loadShadowErpContext } from "@/lib/serverErpContext";
import { loadMediaEntitlement } from "@/lib/serverMediaEntitlement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
} as const;

function json(
  body: Record<string, unknown>,
  status = 200,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

function getServerClient(): SupabaseClient | null {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function GET(
  req: NextRequest,
): Promise<NextResponse> {
  const companySession =
    await requireCompanySession(req, "WEB");

  if (!companySession.allowed) {
    return json(
      {
        success: false,
        error: companySession.code,
      },
      companySession.status,
    );
  }

  const supabase = getServerClient();
  if (!supabase) {
    return json(
      {
        success: false,
        error: "MEDIA_ENTITLEMENT_SERVER_CONFIGURATION_MISSING",
      },
      503,
    );
  }

  const erpContext = await loadShadowErpContext(
    supabase,
    companySession.actor.id,
    {
      requestedScopeId: readRequestedErpScopeId(req),
    },
  );

  if (!erpContext.ready) {
    return json(
      {
        success: false,
        error: erpContext.reason,
      },
      erpContext.reason === "READ_FAILED"
        ? 503
        : 409,
    );
  }

  if (
    companySession.session.tenantId !==
      erpContext.scope.tenantId ||
    companySession.session.companyId !==
      erpContext.scope.companyId
  ) {
    return json(
      {
        success: false,
        error: "MEDIA_SCOPE_SESSION_MISMATCH",
      },
      403,
    );
  }

  const entitlement =
    await loadMediaEntitlement(
      supabase,
      erpContext.scope.tenantId,
      erpContext.scope.companyId,
    );

  if (!entitlement.ready) {
    return json(
      {
        success: false,
        error: "MEDIA_ENTITLEMENT_READ_FAILED",
      },
      503,
    );
  }

  return json({
    success: true,
    mediaEnabled: entitlement.enabled,
  });
}