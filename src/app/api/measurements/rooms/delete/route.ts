import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAuth } from "@/lib/authHelper";
import { loadShadowErpContext } from "@/lib/serverErpContext";
import { readRequestedErpScopeId } from "@/lib/erpActiveScopeCookie";

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
    if (user.role !== "ADMIN") return NextResponse.json({ success: false, error: "ADMIN_REQUIRED" }, { status: 403 });
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return NextResponse.json({ success: false, error: "SERVER_CONFIG_MISSING" }, { status: 503 });
    const server = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const context = await loadShadowErpContext(server, user.id, {
      requestedScopeId: readRequestedErpScopeId(request),
    });
    if (!context.ready) return NextResponse.json({ success: false, error: "ERP_SCOPE_NOT_READY" }, { status: 409 });
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ success: false, error: "INVALID_REQUEST" }, { status: 400 });
    const input = body as Record<string, unknown>;
    const customerId = typeof input.customerId === "string" ? input.customerId.trim() : "";
    const roomId = typeof input.roomId === "string" ? input.roomId.trim() : "";
    if (!customerId || !roomId) return NextResponse.json({ success: false, error: "ROOM_DELETE_ID_REQUIRED" }, { status: 400 });
    const { data, error } = await server.rpc("medya_delete_room_v1", {
      p_customer_id: customerId,
      p_room_id: roomId,
      p_context: {
        tenantId: context.scope.tenantId,
        companyId: context.scope.companyId,
        branchId: context.scope.branchId,
        accountingPeriodId: context.scope.accountingPeriodId,
      },
    });
    if (error) return NextResponse.json({ success: false, error: "ROOM_DELETE_REJECTED", reason: error.message }, { status: 409 });
    if (!data || data.success !== true) return NextResponse.json({ success: false, error: "ROOM_DELETE_UNCONFIRMED" }, { status: 409 });
    return NextResponse.json({ success: true, result: data });
  } catch {
    return NextResponse.json({ success: false, error: "ROOM_DELETE_ERROR" }, { status: 500 });
  }
}
