import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/authHelper";
import type {
  SalesSyncActor,
  SalesSyncMutation
} from "@/lib/salesSyncApiContract";
import {
  decideSalesSyncRoute,
  isSalesSyncFeatureEnabled
} from "@/lib/salesSyncRoutePolicy";

interface SalesSyncRequestBody {
  mutations?: SalesSyncMutation[];
}

function jsonDecision(
  decision: ReturnType<typeof decideSalesSyncRoute>
) {
  return NextResponse.json(
    {
      success: false,
      code: decision.code,
      errors: decision.errors
    },
    { status: decision.status }
  );
}

export async function POST(request: NextRequest) {
  const authenticatedUser = await verifyAuth(request);

  const actor: SalesSyncActor | null =
    authenticatedUser
      ? {
          id: authenticatedUser.id,
          role: authenticatedUser.role as SalesSyncActor["role"],
          isActive: authenticatedUser.isActive
        }
      : null;

  if (!actor) {
    return jsonDecision(
      decideSalesSyncRoute(null, false, null)
    );
  }

  const featureEnabled =
    isSalesSyncFeatureEnabled(
      process.env.SALES_SYNC_ENABLED
    );

  if (!featureEnabled) {
    return jsonDecision(
      decideSalesSyncRoute(actor, false, null)
    );
  }

  let body: SalesSyncRequestBody;

  try {
    body = await request.json() as SalesSyncRequestBody;
  } catch {
    body = {};
  }

  return jsonDecision(
    decideSalesSyncRoute(
      actor,
      true,
      Array.isArray(body.mutations)
        ? body.mutations
        : null
    )
  );
}
