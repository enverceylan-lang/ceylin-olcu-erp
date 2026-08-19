import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAuth } from "@/lib/authHelper";
import { readRequestedErpScopeId } from "@/lib/erpActiveScopeCookie";
import { loadShadowErpContext } from "@/lib/serverErpContext";
import {
  assertPersistSaleLineSourceRequestV1,
  type PersistSaleLineSourceRequestV1
} from "@/lib/saleLineSourceContracts";
import { persistSaleLineSourceSnapshotV1 } from "@/lib/saleLineSourceGateway";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

export async function POST(request: NextRequest) {
  const user = await verifyAuth(request);
  if (!user) return json({ success: false, error: "UNAUTHORIZED" }, 401);

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serverCredential = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serverCredential) {
    return json({ success: false, error: "SERVER_CONFIGURATION_MISSING" }, 500);
  }

  const client = createClient(supabaseUrl, serverCredential, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const context = await loadShadowErpContext(client, user.id, {
    requestedScopeId: readRequestedErpScopeId(request)
  });
  if (!context.ready) {
    return json({ success: false, error: `ERP_CONTEXT_${context.reason}` }, 403);
  }

  let body: PersistSaleLineSourceRequestV1;
  try {
    body = await request.json() as PersistSaleLineSourceRequestV1;
    assertPersistSaleLineSourceRequestV1(body, context.scope);
  } catch (error) {
    return json({
      success: false,
      error: error instanceof Error ? error.message : "SALE_LINE_SOURCE_REQUEST_INVALID"
    }, 422);
  }

  try {
    const result = await persistSaleLineSourceSnapshotV1(client, {
      source: body,
      actorUserId: user.id
    });
    return json({ success: true, result }, 201);
  } catch (error) {
    console.error("[Sale Line Source Persist]", error);
    return json({ success: false, error: "SALE_LINE_SOURCE_PERSIST_FAILED" }, 503);
  }
}
