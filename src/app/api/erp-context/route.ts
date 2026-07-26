import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAuth } from "@/lib/authHelper";
import { loadShadowErpContext } from "@/lib/serverErpContext";
import { buildShadowErpContextApiResponse } from "@/lib/serverErpContextApi";
import { readRequestedErpScopeId } from "@/lib/erpActiveScopeCookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
} as const;

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);

  if (!user) {
    return NextResponse.json(
      { success: false, error: "UNAUTHORIZED" },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { success: false, error: "SERVER_CONFIGURATION_MISSING" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const supabaseServer = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const result = await loadShadowErpContext(supabaseServer, user.id, {
    requestedScopeId: readRequestedErpScopeId(req),
  });
  const response = buildShadowErpContextApiResponse(
    result,
    user.role,
    process.env.ERP_PACKAGE_ENFORCEMENT_MODE
  );

  return NextResponse.json(response.body, {
    status: response.status,
    headers: NO_STORE_HEADERS,
  });
}
