import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/authHelper";
import {
  assertSaleAuthorityScope,
  assertSaleReturnAuthorityInput,
  canServerApproveSale,
  type SaleReturnAuthorityInput,
} from "@/lib/salesServerAuthorityContracts";
import {
  createSalesAuthorityServerClient,
  loadSalesAuthorityContext,
  persistSaleReturnAuthority,
} from "@/lib/salesServerAuthorityGateway";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

export async function POST(request: NextRequest) {
  const user = await verifyAuth(request);
  if (!user) return json({ success: false, error: "UNAUTHORIZED" }, 401);

  let body: SaleReturnAuthorityInput;
  try {
    body = await request.json();
    assertSaleReturnAuthorityInput(body);
  } catch (error) {
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : "INVALID_REQUEST",
      },
      422,
    );
  }

  if (
    body.action !== "START" &&
    !canServerApproveSale(user)
  ) {
    return json(
      { success: false, error: "SALE_RETURN_AUTHORITY_FORBIDDEN" },
      403,
    );
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

    const result = await persistSaleReturnAuthority(client, {
      command: {
        ...body,
        ...context.scope,
      },
      actorUserId: user.id,
      payloadHash: body.payloadHash,
    });

    return json({ success: true, result });
  } catch (error) {
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : "SALE_RETURN_AUTHORITY_FAILED",
      },
      409,
    );
  }
}