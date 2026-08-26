import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { verifyAuth } from "@/lib/authHelper";
import { readRequestedErpScopeId } from "@/lib/erpActiveScopeCookie";
import { guardServerFinanceAccess } from "@/lib/serverFinanceAccessGuard";
import { loadShadowErpContext } from "@/lib/serverErpContext";
import { erpScopeMatches } from "@/lib/erpScope";
import { parseFinanceOverviewSnapshot } from "@/lib/finance/financeOverviewReadContracts";

export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);

  if (!user) {
    return json({ success: false, error: "UNAUTHORIZED" }, 401);
  }

  const currency =
    req.nextUrl.searchParams.get("currency")?.trim().toUpperCase() || "";

  if (!/^[A-Z]{3}$/.test(currency)) {
    return json(
      { success: false, error: "FINANCE_OVERVIEW_CURRENCY_INVALID" },
      400,
    );
  }

  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return json(
      { success: false, error: "SERVER_CONFIGURATION_ERROR" },
      500,
    );
  }

  const supabaseServer = createClient(
    supabaseUrl,
    supabaseServiceKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  const requestedScopeId = readRequestedErpScopeId(req);
  const context = await loadShadowErpContext(
    supabaseServer,
    user.id,
    {
      requestedScopeId,
    },
  );

  if (!context.ready) {
    return json(
      {
        success: false,
        error: "ERP_CONTEXT_NOT_READY",
        reason: context.reason,
      },
      403,
    );
  }

  const access = guardServerFinanceAccess({
    authenticatedUser: {
      id: user.id,
      role: user.role,
      storedPermissions: user.permissions,
      permissionVersion: user.permissionVersion,
      sessionPermissionVersion: user.sessionPermissionVersion,
    },
    requestedPermission: "finance.view",
    requestedCapability: "BASIC_FINANCE",
    packageType: context.package,
    actorScope: context.scope,
    resourceScope: context.scope,
  });

  if (!access.allowed) {
    return json(
      {
        success: false,
        error: "FINANCE_ACCESS_DENIED",
        reason: access.reasonCode,
      },
      403,
    );
  }

  try {
    const { data, error } = await supabaseServer.rpc(
      "read_finance_overview_snapshot_v1",
      {
        p_scope: context.scope,
        p_currency: currency,
      },
    );

    if (error) {
      console.error("[Finance Overview API] Canonical snapshot read failed.");
      return json(
        { success: false, error: "FINANCE_OVERVIEW_READ_FAILED" },
        503,
      );
    }

    const snapshot = parseFinanceOverviewSnapshot(data);

    if (!erpScopeMatches(context.scope, snapshot.scope)) {
      return json(
        { success: false, error: "FINANCE_OVERVIEW_SCOPE_MISMATCH" },
        503,
      );
    }

    if (snapshot.currency !== currency) {
      return json(
        { success: false, error: "FINANCE_OVERVIEW_CURRENCY_MISMATCH" },
        503,
      );
    }

    return json(
      {
        success: true,
        snapshot,
      },
      200,
    );
  }
  catch {
    console.error("[Finance Overview API] Invalid canonical snapshot.");
    return json(
      { success: false, error: "FINANCE_OVERVIEW_READ_INVALID_RESULT" },
      503,
    );
  }
}
