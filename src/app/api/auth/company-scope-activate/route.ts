import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  createClient,
} from "@supabase/supabase-js";

import {
  requireCompanySession,
} from "@/lib/companySessionGuard";
import {
  ERP_ACTIVE_SCOPE_COOKIE,
} from "@/lib/erpActiveScopeCookie";
import {
  loadShadowErpContext,
} from "@/lib/serverErpContext";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control":
    "no-store, max-age=0",
} as const;

function getServerClient() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(
    url,
    key,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

export async function POST(
  req: NextRequest,
) {
  const companySession =
    await requireCompanySession(
      req,
      "WEB",
    );

  if (!companySession.allowed) {
    return NextResponse.json(
      {
        success: false,
        error:
          companySession.code,
      },
      {
        status:
          companySession.status,
        headers: NO_STORE_HEADERS,
      },
    );
  }

  const user =
    companySession.actor;

  const supabase =
    getServerClient();

  if (!supabase) {
    return NextResponse.json(
      {
        success: false,
        error:
          "SERVER_CONFIGURATION_MISSING",
      },
      {
        status: 500,
        headers: NO_STORE_HEADERS,
      },
    );
  }

  const body =
    (await req.json()
      .catch(() => null)) as
      | {
          companySlug?: unknown;
          scopeId?: unknown;
        }
      | null;

  const companySlug =
    String(
      body?.companySlug || "",
    )
      .trim()
      .toLowerCase();

  const scopeId =
    String(
      body?.scopeId || "",
    ).trim();

  if (
    !scopeId ||
    !/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/
      .test(companySlug) ||
    companySession.session.companySlug !==
      companySlug ||
    companySession.session.userScopeId !==
      scopeId
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "INVALID_REQUEST",
      },
      {
        status: 400,
        headers: NO_STORE_HEADERS,
      },
    );
  }

  const {
    data: scopeData,
    error: scopeError,
  } = await supabase
    .from("erp_user_scopes")
    .select(
      "user_scope_id,tenant_id,company_id,is_active",
    )
    .eq(
      "user_scope_id",
      scopeId,
    )
    .eq(
      "user_id",
      user.id,
    )
    .eq(
      "tenant_id",
      companySession.session.tenantId,
    )
    .eq(
      "company_id",
      companySession.session.companyId,
    )
    .eq(
      "is_active",
      true,
    )
    .maybeSingle();

  if (
    scopeError ||
    !scopeData
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "COMPANY_SCOPE_FORBIDDEN",
      },
      {
        status: 403,
        headers: NO_STORE_HEADERS,
      },
    );
  }

  const {
    data: companyData,
    error: companyError,
  } = await supabase
    .from("erp_companies")
    .select(
      "tenant_id,company_id,slug,is_active",
    )
    .eq(
      "tenant_id",
      String(
        scopeData.tenant_id,
      ),
    )
    .eq(
      "company_id",
      String(
        scopeData.company_id,
      ),
    )
    .eq(
      "slug",
      companySlug,
    )
    .eq(
      "is_active",
      true,
    )
    .maybeSingle();

  if (
    companyError ||
    !companyData
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "COMPANY_SCOPE_FORBIDDEN",
      },
      {
        status: 403,
        headers: NO_STORE_HEADERS,
      },
    );
  }

  const context =
    await loadShadowErpContext(
      supabase,
      user.id,
      {
        requestedScopeId:
          scopeId,
      },
    );

  if (
    !context.ready ||
    context.scope.tenantId !==
      String(
        companyData.tenant_id,
      ) ||
    context.scope.companyId !==
      String(
        companyData.company_id,
      )
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "COMPANY_SCOPE_FORBIDDEN",
      },
      {
        status: 403,
        headers: NO_STORE_HEADERS,
      },
    );
  }

  const response =
    NextResponse.json(
      {
        success: true,
        companySlug,
        scopeId,
      },
      {
        status: 200,
        headers: NO_STORE_HEADERS,
      },
    );

  response.cookies.set(
    ERP_ACTIVE_SCOPE_COOKIE,
    scopeId,
    {
      httpOnly: true,
      sameSite: "lax",
      secure:
        process.env.NODE_ENV ===
        "production",
      path: "/",
      maxAge:
        60 * 60 * 12,
    },
  );

  response.cookies.set(
    "enverp_company_slug",
    companySlug,
    {
      httpOnly: true,
      sameSite: "lax",
      secure:
        process.env.NODE_ENV ===
        "production",
      path: "/",
      maxAge:
        60 * 60 * 12,
    },
  );

  return response;
}