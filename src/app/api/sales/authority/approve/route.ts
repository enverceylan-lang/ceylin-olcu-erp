import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/authHelper";
import { ensureMainOperationW1 } from "@/lib/mainOperationW1";
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
import {
  assertPersistSaleLineSourceRequestV1,
} from "@/lib/saleLineSourceContracts";
import {
  persistSaleLineSourceSnapshotV1,
} from "@/lib/saleLineSourceGateway";

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

    if (body && "recoverMainOperation" in body && body.recoverMainOperation === true) {
      if (typeof body.saleId !== "string" || !body.saleId.trim()) {
        return json({ success: false, error: "SALE_ID_REQUIRED" }, 422);
      }
      const mainOperation = await ensureMainOperationW1(client, context.scope, body.saleId, user.id);
      return json({ success: true, mainOperation });
    }

    if (!body.lineSource) {
      throw new Error("SALE_APPROVAL_LINE_SOURCE_REQUIRED");
    }

    assertPersistSaleLineSourceRequestV1(
      body.lineSource,
      context.scope,
    );

    if (body.lineSource.saleId !== body.saleId) {
      throw new Error("SALE_APPROVAL_LINE_SOURCE_SALE_MISMATCH");
    }

    const lineSourceResult =
      await persistSaleLineSourceSnapshotV1(client, {
        source: body.lineSource,
        actorUserId: user.id,
      });

    const approvedLineSnapshotVersion =
      lineSourceResult && typeof lineSourceResult === "object" && "sourceVersion" in lineSourceResult
        ? lineSourceResult.sourceVersion
        : undefined;
    if (typeof approvedLineSnapshotVersion !== "number" ||
        !Number.isSafeInteger(approvedLineSnapshotVersion) || approvedLineSnapshotVersion < 1) {
      throw new Error("W1_APPROVED_SNAPSHOT_VERSION_REQUIRED");
    }

    const isAdmin =
      String(user.role || "").trim().toUpperCase() === "ADMIN";

    const result = await approveSaleDocumentAuthority(client, {
      scope: context.scope,
      saleId: body.saleId,
      actorUserId: user.id,
      allowSelfApproval: isAdmin,
      approvedLineSnapshotVersion,
    });

    if (!result || typeof result !== "object" || !("outcome" in result) ||
        (result.outcome !== "APPROVED" && result.outcome !== "REPLAY")) {
      return json({ success: false, error: "SALE_APPROVAL_RESULT_INVALID" }, 502);
    }
    const mainOperation = await ensureMainOperationW1(client, context.scope, body.saleId, user.id);
    return json({
      success: true,
      result,
      lineSourceResult,
      mainOperation,
    });
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