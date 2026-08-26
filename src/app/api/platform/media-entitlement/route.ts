import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

import { requirePlatformSuperAdmin } from "@/lib/platformAdminServerGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
} as const;

type CompanyRow = {
  tenant_id: string;
  company_id: string;
  name: string;
};

type CompanyEntitlementRow = {
  tenant_id: string;
  company_id: string;
  is_enabled: boolean;
};

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
  request: NextRequest,
): Promise<NextResponse> {
  const access =
    await requirePlatformSuperAdmin(request);

  if (!access.allowed) {
    return json(
      {
        success: false,
        code: access.code,
      },
      access.status,
    );
  }

  const supabase = getServerClient();
  if (!supabase) {
    return json(
      {
        success: false,
        code: "SERVER_CONFIGURATION_MISSING",
      },
      500,
    );
  }

  const [
    globalResult,
    companiesResult,
    entitlementsResult,
  ] = await Promise.all([
    supabase
      .from("erp_platform_feature_switches")
      .select("is_enabled")
      .eq("feature_code", "MEDIA")
      .maybeSingle(),
    supabase
      .from("erp_companies")
      .select("tenant_id,company_id,name")
      .order("name", { ascending: true }),
    supabase
      .from("erp_company_feature_entitlements")
      .select("tenant_id,company_id,is_enabled")
      .eq("feature_code", "MEDIA"),
  ]);

  if (
    globalResult.error ||
    companiesResult.error ||
    entitlementsResult.error
  ) {
    return json(
      {
        success: false,
        code: "MEDIA_ENTITLEMENT_READ_FAILED",
      },
      500,
    );
  }

  const entitlementRows =
    (entitlementsResult.data || []) as CompanyEntitlementRow[];

  const entitlementByCompany = new Map(
    entitlementRows.map(row => [
      `${row.tenant_id}:${row.company_id}`,
      row.is_enabled === true,
    ]),
  );

  const companyRows =
    (companiesResult.data || []) as CompanyRow[];

  const companies =
    companyRows.map(company => ({
      tenantId: company.tenant_id,
      companyId: company.company_id,
      name: company.name,
      mediaEnabled:
        entitlementByCompany.get(
          `${company.tenant_id}:${company.company_id}`,
        ) === true,
    }));

  return json({
    success: true,
    globalMediaEnabled:
      globalResult.data?.is_enabled === true,
    companies,
  });
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  const access =
    await requirePlatformSuperAdmin(request);

  if (!access.allowed) {
    return json(
      {
        success: false,
        code: access.code,
      },
      access.status,
    );
  }

  const supabase = getServerClient();
  if (!supabase) {
    return json(
      {
        success: false,
        code: "SERVER_CONFIGURATION_MISSING",
      },
      500,
    );
  }

  let body: Record<string, unknown>;
  try {
    body =
      (await request.json()) as Record<
        string,
        unknown
      >;
  } catch {
    return json(
      {
        success: false,
        code: "INVALID_JSON",
      },
      400,
    );
  }

  const scope =
    String(body.scope || "").trim().toUpperCase();
  const enabled =
    body.enabled === true;

  if (
    body.enabled !== true &&
    body.enabled !== false
  ) {
    return json(
      {
        success: false,
        code: "MEDIA_ENTITLEMENT_INVALID_ENABLED",
      },
      400,
    );
  }

  if (scope === "GLOBAL") {
    const { error } = await supabase.rpc(
      "set_platform_feature_switch_v1",
      {
        p_feature_code: "MEDIA",
        p_is_enabled: enabled,
        p_actor_user_id: access.actor.id,
      },
    );

    if (error) {
      return json(
        {
          success: false,
          code: "MEDIA_ENTITLEMENT_WRITE_FAILED",
        },
        500,
      );
    }

    return json({
      success: true,
      scope: "GLOBAL",
      mediaEnabled: enabled,
    });
  }

  if (scope === "COMPANY") {
    const tenantId =
      String(body.tenantId || "").trim();
    const companyId =
      String(body.companyId || "").trim();

    if (!tenantId || !companyId) {
      return json(
        {
          success: false,
          code: "MEDIA_ENTITLEMENT_COMPANY_SCOPE_REQUIRED",
        },
        400,
      );
    }

    const { error } = await supabase.rpc(
      "set_company_feature_entitlement_v1",
      {
        p_tenant_id: tenantId,
        p_company_id: companyId,
        p_feature_code: "MEDIA",
        p_is_enabled: enabled,
        p_actor_user_id: access.actor.id,
      },
    );

    if (error) {
      return json(
        {
          success: false,
          code: "MEDIA_ENTITLEMENT_WRITE_FAILED",
        },
        500,
      );
    }

    return json({
      success: true,
      scope: "COMPANY",
      tenantId,
      companyId,
      mediaEnabled: enabled,
    });
  }

  return json(
    {
      success: false,
      code: "MEDIA_ENTITLEMENT_INVALID_SCOPE",
    },
    400,
  );
}