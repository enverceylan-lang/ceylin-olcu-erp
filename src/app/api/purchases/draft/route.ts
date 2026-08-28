import {
  NextRequest,
} from "next/server";

import {
  buildPurchaseCanonicalDraft,
  hashPurchaseCanonicalDraft,
  type PurchaseDraftPersistRequest,
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
        PurchaseDraftPersistRequest;

    const draft =
      buildPurchaseCanonicalDraft(
        {
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
        },
      );

    const payloadHash =
      hashPurchaseCanonicalDraft(
        draft,
      );

    const rpc =
      await authority.client.rpc(
        "persist_purchase_document_draft_v1",
        {
          p_draft: draft,
          p_actor_user_id:
            authority.user.id,
          p_payload_hash:
            payloadHash,
        },
      );

    if (rpc.error) {
      throw new Error(
        rpc.error.code
          ? `${rpc.error.code}:${rpc.error.message ?? ""}`
          : rpc.error.message ||
              "PURCHASE_DRAFT_RPC_FAILED",
      );
    }

    const row =
      Array.isArray(rpc.data)
        ? rpc.data[0]
        : rpc.data;

    if (
      !row ||
      ![
        "CREATED",
        "UPDATED",
        "REPLAY",
      ].includes(
        row.outcome,
      ) ||
      row.purchase_document_id !==
        draft.purchaseDocumentId
    ) {
      throw new Error(
        "PURCHASE_DRAFT_RPC_RESULT_INVALID",
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
          payloadHash:
            row.payload_hash,
          updatedAt:
            row.updated_at,
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
            : "PURCHASE_DRAFT_PERSIST_FAILED",
      },
      409,
    );
  }
}
