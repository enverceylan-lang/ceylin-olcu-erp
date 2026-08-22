import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { verifyAuth } from "@/lib/authHelper";
import { readRequestedErpScopeId } from "@/lib/erpActiveScopeCookie";
import {
  parseCustomerReceivableSnapshot,
} from "@/lib/finance/customerReceivableReadContracts";
import { guardServerFinanceAccess } from "@/lib/serverFinanceAccessGuard";
import { loadShadowErpContext } from "@/lib/serverErpContext";

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

  const customerId = (req.nextUrl.searchParams.get("customerId") || "").trim();
  const currency = (req.nextUrl.searchParams.get("currency") || "").trim().toUpperCase();

  if (!customerId) {
    return json(
      { success: false, error: "FINANCE_CUSTOMER_RECEIVABLE_CUSTOMER_REQUIRED" },
      400,
    );
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    return json(
      { success: false, error: "FINANCE_CUSTOMER_RECEIVABLE_CURRENCY_INVALID" },
      400,
    );
  }

  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ success: false, error: "SERVER_CONFIGURATION_ERROR" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const context = await loadShadowErpContext(supabase, user.id, {
    requestedScopeId: readRequestedErpScopeId(req),
  });

  if (!context.ready) {
    return json(
      {
        success: false,
        error: context.reason || "ERP_CONTEXT_NOT_READY",
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
    requestedPermission: "customerFinance.view",
    requestedCapability: "CUSTOMER_FINANCE",
    packageType: context.package,
    actorScope: context.scope,
    resourceScope: context.scope,
    customerId,
  });

  if (!access.allowed) {
    return json(
      {
        success: false,
        error: access.reasonCode || "FINANCE_ACCESS_DENIED",
      },
      403,
    );
  }

  const { data, error } = await supabase.rpc(
    "read_finance_customer_receivable_snapshot_v1",
    {
      p_scope: {
        tenantId: context.scope.tenantId,
        companyId: context.scope.companyId,
        branchId: context.scope.branchId,
        accountingPeriodId: context.scope.accountingPeriodId,
      },
      p_customer_id: customerId,
      p_currency: currency,
    },
  );

  if (error) {
    return json(
      {
        success: false,
        error: error.message.includes(
          "FINANCE_CUSTOMER_RECEIVABLE_READ_RECONCILIATION_FAILED",
        )
          ? "FINANCE_CUSTOMER_RECEIVABLE_READ_RECONCILIATION_FAILED"
          : "FINANCE_CUSTOMER_RECEIVABLE_READ_FAILED",
      },
      error.message.includes(
        "FINANCE_CUSTOMER_RECEIVABLE_READ_RECONCILIATION_FAILED",
      )
        ? 409
        : 503,
    );
  }

  try {
    const snapshot = parseCustomerReceivableSnapshot(data);
    if (snapshot.customerId !== customerId || snapshot.currency !== currency) {
      return json(
        {
          success: false,
          error: "FINANCE_CUSTOMER_RECEIVABLE_READ_SCOPE_MISMATCH",
        },
        409,
      );
    }
    return json({ success: true, snapshot }, 200);
  } catch {
    return json(
      {
        success: false,
        error: "FINANCE_CUSTOMER_RECEIVABLE_READ_INVALID_RESULT",
      },
      500,
    );
  }
}