import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAuth } from "@/lib/authHelper";
import { loadShadowErpContext } from "@/lib/serverErpContext";
import { readRequestedErpScopeId } from "@/lib/erpActiveScopeCookie";

const ALLOWED_PULL_ROLES = new Set([
  "ADMIN",
  "MODERATOR",
  "OFFICE",
  "SALES",
]);

function deepSanitizeMedia(value: unknown): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    if (
      value.startsWith("data:image") ||
      value.startsWith("data:video") ||
      value.includes(";base64,") ||
      value.length > 10000
    ) {
      return "[REDACTED_MEDIA]";
    }

    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => deepSanitizeMedia(item));
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (["photos", "videos", "addressPhotos"].includes(key)) {
        continue;
      }

      result[key] = deepSanitizeMedia(nestedValue);
    }

    return result;
  }

  return value;
}

function normalizeCursor(value: unknown): number | null {
  const cursor = Number(value);

  if (!Number.isSafeInteger(cursor) || cursor < 0) {
    return null;
  }

  return cursor;
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);

  if (!user) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized",
      },
      { status: 401 },
    );
  }

  if (!ALLOWED_PULL_ROLES.has(String(user.role).toUpperCase())) {
    return NextResponse.json(
      {
        success: false,
        error: "Forbidden",
      },
      { status: 403 },
    );
  }

  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("[Delta Pull Config] Required server configuration is missing.");

    return NextResponse.json(
      {
        success: false,
        error: "Server configuration error",
      },
      { status: 500 },
    );
  }

  try {
    const body = await req.json();
    const draftCursor = normalizeCursor(body?.draftCursor ?? 0);
    const measurementCursor = normalizeCursor(
      body?.measurementCursor ?? 0,
    );

    if (draftCursor === null || measurementCursor === null) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid cursor",
        },
        { status: 400 },
      );
    }

    const supabaseServer = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    const erpContext = await loadShadowErpContext(
      supabaseServer,
      user.id,
      { requestedScopeId: readRequestedErpScopeId(req) },
    );

    if (!erpContext.ready) {
      return NextResponse.json(
        {
          success: false,
          error: "ERP scope is not ready",
          reason: erpContext.reason,
        },
        { status: erpContext.reason === "READ_FAILED" ? 503 : 409 },
      );
    }

    const scopeColumns = {
      tenant_id: erpContext.scope.tenantId,
      company_id: erpContext.scope.companyId,
      branch_id: erpContext.scope.branchId,
      accounting_period_id:
        erpContext.scope.accountingPeriodId,
    };

    const [draftResult, measurementResult] = await Promise.all([
      supabaseServer
        .from("draft_changes")
        .select("*")
        .match(scopeColumns)
        .gt("revision", draftCursor)
        .order("revision", { ascending: true })
        .limit(100),

      supabaseServer
        .from("measurement_changes")
        .select("*")
        .match(scopeColumns)
        .gt("revision", measurementCursor)
        .order("revision", { ascending: true })
        .limit(100),
    ]);

    if (draftResult.error) {
      console.error("[Delta Pull] Draft query failed.");

      return NextResponse.json(
        {
          success: false,
          error: "Database error",
        },
        { status: 500 },
      );
    }

    if (measurementResult.error) {
      console.error("[Delta Pull] Measurement query failed.");

      return NextResponse.json(
        {
          success: false,
          error: "Database error",
        },
        { status: 500 },
      );
    }

    const sanitizedDrafts = (draftResult.data || []).map((change) => ({
      ...change,
      sourceTable: "draft_changes",
      patch: deepSanitizeMedia(change.patch),
    }));

    const sanitizedMeasurements = (measurementResult.data || []).map(
      (change) => ({
        ...change,
        sourceTable: "measurement_changes",
        patch: deepSanitizeMedia(change.patch),
      }),
    );

    const changes = [...sanitizedDrafts, ...sanitizedMeasurements];

    return NextResponse.json({
      success: true,
      changes,
      fetchedCount: changes.length,
    });
  } catch {
    console.error("[Delta Pull] Internal error.");

    return NextResponse.json(
      {
        success: false,
        error: "Internal Server Error",
      },
      { status: 500 },
    );
  }
}
