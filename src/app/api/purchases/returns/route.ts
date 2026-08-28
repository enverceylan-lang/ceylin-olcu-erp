import {
  NextRequest,
} from "next/server";
import {
  createHash,
} from "node:crypto";

import {
  assertPurchaseReturnRequest,
  type PurchaseReturnRequest,
} from "@/lib/purchaseReturnServerContract";
import {
  json,
  loadPurchaseServerAuthority,
} from "@/lib/purchaseApprovalRouteAuthority";

function stable(
  value: unknown,
): unknown {
  if (Array.isArray(value)) {
    return value.map(stable);
  }

  if (
    value &&
    typeof value === "object"
  ) {
    const source =
      value as Record<string, unknown>;

    return Object.keys(source)
      .sort()
      .reduce<
        Record<string, unknown>
      >(
        (result, key) => {
          result[key] =
            stable(
              source[key],
            );
          return result;
        },
        {},
      );
  }

  return value;
}

function payloadHash(
  value: unknown,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify(
        stable(value),
      ),
    )
    .digest("hex");
}

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
        PurchaseReturnRequest;

    const scoped = {
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

    assertPurchaseReturnRequest(
      scoped,
      authority.context.scope,
    );

    const hash =
      payloadHash(
        scoped,
      );

    const rpc =
      await authority.client.rpc(
        "persist_purchase_return_authority_v1",
        {
          p_scope:
            authority.context.scope,
          p_purchase_return_id:
            scoped.purchaseReturnId,
          p_purchase_document_id:
            scoped.purchaseDocumentId,
          p_idempotency_key:
            scoped.idempotencyKey,
          p_returned_at:
            scoped.returnedAt,
          p_reason:
            scoped.reason,
          p_lines:
            scoped.lines,
          p_payload_hash:
            hash,
          p_actor_user_id:
            authority.user.id,
        },
      );

    if (rpc.error) {
      throw new Error(
        rpc.error.code
          ? `${rpc.error.code}:${rpc.error.message ?? ""}`
          : rpc.error.message ||
              "PURCHASE_RETURN_RPC_FAILED",
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
      row.purchase_return_id !==
        scoped.purchaseReturnId ||
      row.purchase_document_id !==
        scoped.purchaseDocumentId ||
      !row.payable_reversal_movement_id
    ) {
      throw new Error(
        "PURCHASE_RETURN_RPC_RESULT_INVALID",
      );
    }

    return json(
      {
        success: true,
        result: {
          outcome:
            row.outcome,
          purchaseReturnId:
            row.purchase_return_id,
          purchaseDocumentId:
            row.purchase_document_id,
          grossAmount:
            Number(
              row.gross_amount,
            ),
          payableReversalMovementId:
            row.payable_reversal_movement_id,
          returnedAt:
            row.returned_at,
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
            : "PURCHASE_RETURN_FAILED",
      },
      409,
    );
  }
}
