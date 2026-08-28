import {
  NextRequest,
} from "next/server";

import {
  assertPurchaseApprovalRequest,
  type PurchaseApprovalRequest,
} from "@/lib/purchaseApprovalServerContract";
import {
  json,
  loadPurchaseServerAuthority,
} from "@/lib/purchaseApprovalRouteAuthority";

export async function POST(
  request: NextRequest,
) {
  const authority =
    await loadPurchaseServerAuthority(
      request,
    );

  if (!authority.ok) {
    return authority.response;
  }

  try {
    const body =
      await request.json() as
        PurchaseApprovalRequest;

    const scopedRequest = {
      ...body,
      tenantId:
        authority.context
          .scope.tenantId,
      companyId:
        authority.context
          .scope.companyId,
      branchId:
        authority.context
          .scope.branchId,
      accountingPeriodId:
        authority.context
          .scope
          .accountingPeriodId,
    };

    assertPurchaseApprovalRequest(
      scopedRequest,
      authority.context.scope,
    );

    const rpc =
      await authority.client.rpc(
        "approve_purchase_document_authority_v1",
        {
          p_scope:
            authority.context.scope,
          p_purchase_document_id:
            scopedRequest
              .purchaseDocumentId,
          p_approval_idempotency_key:
            scopedRequest
              .approvalIdempotencyKey,
          p_expected_draft_payload_hash:
            scopedRequest
              .expectedDraftPayloadHash,
          p_actor_user_id:
            authority.user.id,
        },
      );

    if (rpc.error) {
      throw new Error(
        rpc.error.code
          ? `${rpc.error.code}:${rpc.error.message ?? ""}`
          : rpc.error.message ||
              "PURCHASE_APPROVAL_RPC_FAILED",
      );
    }

    const row =
      Array.isArray(rpc.data)
        ? rpc.data[0]
        : rpc.data;

    if (
      !row ||
      (
        row.outcome !==
          "CREATED" &&
        row.outcome !==
          "REPLAY"
      ) ||
      row.purchase_document_id !==
        scopedRequest
          .purchaseDocumentId ||
      !row.payable_movement_id
    ) {
      throw new Error(
        "PURCHASE_APPROVAL_RPC_RESULT_INVALID",
      );
    }

    return json(
      {
        success: true,
        result: {
          outcome:
            row.outcome,
          purchaseDocumentId:
            row.purchase_document_id,
          payableMovementId:
            row.payable_movement_id,
          price1Updates:
            row.price1_updates ??
            [],
          approvedAt:
            row.approved_at,
        },
      },
      row.outcome ===
        "CREATED"
        ? 201
        : 200,
    );
  } catch (error) {
    return json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "PURCHASE_APPROVAL_FAILED",
      },
      409,
    );
  }
}
