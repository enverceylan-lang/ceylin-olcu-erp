import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAuth } from "@/lib/authHelper";
import {
  ERP_ACTIVE_SCOPE_COOKIE,
  readRequestedErpScopeId,
} from "@/lib/erpActiveScopeCookie";
import { getApprovedRoleCapabilities } from "@/lib/approvedAccessPolicy";
import { hasPackageFeature } from "@/lib/packageFeatures";
import {
  loadShadowErpContext,
  type UserScopeRow,
} from "@/lib/serverErpContext";
import { parseShadowAccessRole } from "@/lib/shadowFeatureAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
} as const;

function getServerClient() {
  const url =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function readScopeLabels(
  supabase: NonNullable<ReturnType<typeof getServerClient>>,
  rows: UserScopeRow[]
) {
  const tenantIds = [...new Set(rows.map((row) => row.tenant_id))];
  const companyIds = [...new Set(rows.map((row) => row.company_id))];
  const branchIds = [...new Set(rows.map((row) => row.branch_id))];
  const periodIds = [
    ...new Set(rows.map((row) => row.accounting_period_id)),
  ];

  const [tenants, companies, branches, periods] = await Promise.all([
    supabase
      .from("erp_tenants")
      .select("tenant_id, name")
      .in("tenant_id", tenantIds),
    supabase
      .from("erp_companies")
      .select("company_id, name")
      .in("company_id", companyIds),
    supabase
      .from("erp_branches")
      .select("branch_id, name")
      .in("branch_id", branchIds),
    supabase
      .from("erp_accounting_periods")
      .select("accounting_period_id, name")
      .in("accounting_period_id", periodIds),
  ]);

  if (
    tenants.error ||
    companies.error ||
    branches.error ||
    periods.error
  ) {
    return null;
  }

  const labelMap = (
    data: Array<Record<string, unknown>> | null,
    id: string,
    name: string
  ) =>
    new Map(
      (data || []).map((row) => [
        String(row[id]),
        String(row[name] || ""),
      ])
    );

  return {
    tenants: labelMap(tenants.data, "tenant_id", "name"),
    companies: labelMap(
      companies.data,
      "company_id",
      "name"
    ),
    branches: labelMap(branches.data, "branch_id", "name"),
    periods: labelMap(
      periods.data,
      "accounting_period_id",
      "name"
    ),
  };
}

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  const supabase = getServerClient();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "UNAUTHORIZED" },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "SERVER_CONFIGURATION_MISSING" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const { data, error } = await supabase
    .from("erp_user_scopes")
    .select(
      "user_scope_id, tenant_id, company_id, branch_id, accounting_period_id, is_default, is_active"
    )
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("is_default", { ascending: false });

  if (error) {
    return NextResponse.json(
      { success: false, error: "ERP_SCOPE_READ_FAILED" },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }

  const rows = (data || []) as UserScopeRow[];
  const labels = await readScopeLabels(supabase, rows);
  if (!labels) {
    return NextResponse.json(
      { success: false, error: "ERP_SCOPE_LABEL_READ_FAILED" },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }

  const requested = readRequestedErpScopeId(req);
  const selected =
    rows.find((row) => row.user_scope_id === requested) ||
    rows.find((row) => row.is_default) ||
    null;
  const context = await loadShadowErpContext(supabase, user.id, {
    requestedScopeId: selected?.user_scope_id,
  });
  const role = parseShadowAccessRole(user.role);
  const scopeAccess = role
    ? getApprovedRoleCapabilities(role).scopeAccess
    : "DEFAULT_ONLY";
  const canSelect =
    context.ready &&
    scopeAccess !== "DEFAULT_ONLY" &&
    hasPackageFeature(context.package, "multiBranch");

  return NextResponse.json(
    {
      success: true,
      selectedScopeId: selected?.user_scope_id || null,
      canSelect,
      scopes: rows.map((row) => ({
        id: row.user_scope_id,
        isDefault: row.is_default,
        tenantName: labels.tenants.get(row.tenant_id) || "Tenant",
        companyName:
          labels.companies.get(row.company_id) || "Şirket",
        branchName: labels.branches.get(row.branch_id) || "Şube",
        periodName:
          labels.periods.get(row.accounting_period_id) || "Dönem",
      })),
    },
    { headers: NO_STORE_HEADERS }
  );
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  const supabase = getServerClient();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "UNAUTHORIZED" },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "SERVER_CONFIGURATION_MISSING" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const body = (await req.json().catch(() => null)) as {
    scopeId?: unknown;
  } | null;
  const scopeId =
    typeof body?.scopeId === "string" ? body.scopeId.trim() : "";
  if (!scopeId) {
    return NextResponse.json(
      { success: false, error: "INVALID_SCOPE_ID" },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const context = await loadShadowErpContext(supabase, user.id, {
    requestedScopeId: scopeId,
  });
  const role = parseShadowAccessRole(user.role);
  const scopeAccess = role
    ? getApprovedRoleCapabilities(role).scopeAccess
    : "DEFAULT_ONLY";

  if (
    !context.ready ||
    scopeAccess === "DEFAULT_ONLY" ||
    !hasPackageFeature(context.package, "multiBranch")
  ) {
    return NextResponse.json(
      { success: false, error: "SCOPE_SELECTION_FORBIDDEN" },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  const response = NextResponse.json(
    { success: true, selectedScopeId: scopeId },
    { headers: NO_STORE_HEADERS }
  );
  response.cookies.set(ERP_ACTIVE_SCOPE_COOKIE, scopeId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}
