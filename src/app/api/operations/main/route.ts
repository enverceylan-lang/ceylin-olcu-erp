import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/authHelper";
import { canViewAllScopedOperations } from "@/lib/operationAccessPolicy";
import { readMainOperationsW1 } from "@/lib/mainOperationW1";
import { createSalesAuthorityServerClient, loadSalesAuthorityContext } from "@/lib/salesServerAuthorityGateway";

export async function GET(request: NextRequest) {
  const user = await verifyAuth(request);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!canViewAllScopedOperations({ userId: user.id, role: user.role })) {
    return NextResponse.json({ error: "W1_READ_FORBIDDEN" }, { status: 403 });
  }
  try {
    const client = createSalesAuthorityServerClient();
    const context = await loadSalesAuthorityContext(request, client, user.id);
    if (!context.ready) return NextResponse.json({ error: "W1_SCOPE_REQUIRED" }, { status: 403 });
    const operations = await readMainOperationsW1(client, context.scope);
    return NextResponse.json({ operations }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "W1_READ_FAILED" }, { status: 502 });
  }
}
