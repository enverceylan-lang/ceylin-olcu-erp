import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/authHelper";
import { stableFinanceOperationHash } from "@/lib/finance/stableFinanceOperationHash";
import {
  assertSaleAuthorityScope,
  assertSaleDraftAuthorityInput,
  type SaleAuthorityDraftInput,
} from "@/lib/salesServerAuthorityContracts";
import {
  createSalesAuthorityServerClient,
  loadSalesAuthorityContext,
  persistSaleDocumentAuthority,
} from "@/lib/salesServerAuthorityGateway";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

export async function POST(request: NextRequest) {
  const user = await verifyAuth(request);
  if (!user) return json({ success: false, error: "UNAUTHORIZED" }, 401);

  let body: SaleAuthorityDraftInput;
  try {
    body = await request.json();
    assertSaleDraftAuthorityInput(body);
  } catch (error) {
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : "INVALID_REQUEST",
      },
      422,
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

    const serverSale = {
      tenantId: context.scope.tenantId,
      companyId: context.scope.companyId,
      branchId: context.scope.branchId,
      accountingPeriodId: context.scope.accountingPeriodId,
      saleId: body.saleId,
      customerId: body.customerId,
      saleNumber: body.saleNumber ?? null,
      status: body.status,
      totalAmount: body.totalAmount,
      currency: body.currency,
    };

    const result = await persistSaleDocumentAuthority(client, {
      sale: serverSale,
      actorUserId: user.id,
      payloadHash: stableFinanceOperationHash(serverSale),
    });

    return json({ success: true, result });
  } catch (error) {
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : "SALE_AUTHORITY_FAILED",
      },
      409,
    );
  }
}