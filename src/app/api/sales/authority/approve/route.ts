import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/authHelper";
import {
  assertSaleAuthorityScope,
  canServerApproveSale,
  type SaleApprovalAuthorityInput,
} from "@/lib/salesServerAuthorityContracts";
import {
  approveSaleDocumentAuthority,
  createSalesAuthorityServerClient,
  loadSalesAuthorityContext,
} from "@/lib/salesServerAuthorityGateway";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

export async function POST(request: NextRequest) {
  const user = await verifyAuth(request);
  if (!user) return json({ success: false, error: "UNAUTHORIZED" }, 401);

  if (!canServerApproveSale(user)) {
    return json({ success: false, error: "SALE_APPROVE_FORBIDDEN" }, 403);
  }

  let body: SaleApprovalAuthorityInput;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: "INVALID_REQUEST" }, 422);
  }

  try {
    const client = createSalesAuthorityServerClient();
    const context = await loadSalesAuthorityContext(
      request,
      client,
      user.id,
    );
    if (!context.ready) {
      return json(
        { success: false, error: `ERP_CONTEXT_${context.reason}` },
        403,
      );
    }

    assertSaleAuthorityScope(body, context.scope);

    const isAdmin =
      String(user.role || "").trim().toUpperCase() === "ADMIN";

    const result = await approveSaleDocumentAuthority(client, {
      scope: context.scope,
      saleId: body.saleId,
      actorUserId: user.id,
      allowSelfApproval: isAdmin,
    });

    return json({ success: true, result });
  } catch (error) {
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : "SALE_APPROVAL_FAILED",
      },
      409,
    );
  }
}