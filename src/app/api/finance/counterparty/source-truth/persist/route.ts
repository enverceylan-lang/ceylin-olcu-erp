import {
  NextRequest,
  NextResponse
} from "next/server";

import {
  createClient
} from "@supabase/supabase-js";

import {
  verifyAuth
} from "@/lib/authHelper";

import {
  readRequestedErpScopeId
} from "@/lib/erpActiveScopeCookie";

import {
  erpScopeMatches,
  validateErpScope,
  type ErpScope
} from "@/lib/erpScope";

import {
  loadShadowErpContext
} from "@/lib/serverErpContext";

import {
  createCounterpartySourceTruthSupabaseGatewayAdapter,
  type SupabaseRpcClient
} from "@/lib/finance/counterpartySourceTruthSupabaseGatewayAdapter";

import type {
  ProviderEarningSourceTruth,
  SupplierReceiptSourceTruth
} from "@/lib/finance/counterpartySourceTruthPersistenceGateway";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control":
    "no-store, max-age=0"
} as const;

type SourceKind =
  | "SUPPLIER_RECEIPT"
  | "PROVIDER_EARNING";

function json(
  body:
    Record<string, unknown>,
  status:
    number
) {
  return NextResponse.json(
    body,
    {
      status,
      headers:
        NO_STORE_HEADERS
    }
  );
}

function isRecord(
  value:
    unknown
): value is Record<string, unknown> {
  return (
    typeof value ===
      "object" &&
    value !==
      null
  );
}

function readSourceScope(
  source:
    Record<string, unknown>
): ErpScope | null {
  const scope = {
    tenantId:
      String(
        source.tenantId ||
        ""
      ),
    companyId:
      String(
        source.companyId ||
        ""
      ),
    branchId:
      String(
        source.branchId ||
        ""
      ),
    accountingPeriodId:
      String(
        source.accountingPeriodId ||
        ""
      )
  };

  return validateErpScope(scope).valid
    ? scope
    : null;
}

export async function POST(
  request:
    NextRequest
) {
  const user =
    await verifyAuth(
      request
    );

  if (!user) {
    return json(
      {
        success:
          false,
        error:
          "UNAUTHORIZED"
      },
      401
    );
  }

  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (
    !supabaseUrl ||
    !serviceRoleKey
  ) {
    return json(
      {
        success:
          false,
        error:
          "SERVER_CONFIGURATION_MISSING"
      },
      500
    );
  }

  const body =
    await request
      .json()
      .catch(
        () =>
          null
      );

  if (!isRecord(body)) {
    return json(
      {
        success:
          false,
        error:
          "INVALID_REQUEST"
      },
      400
    );
  }

  const kind =
    String(
      body.kind ||
      ""
    ) as SourceKind;

  if (
    kind !==
      "SUPPLIER_RECEIPT" &&
    kind !==
      "PROVIDER_EARNING"
  ) {
    return json(
      {
        success:
          false,
        error:
          "INVALID_SOURCE_KIND"
      },
      400
    );
  }

  if (!isRecord(body.source)) {
    return json(
      {
        success:
          false,
        error:
          "INVALID_SOURCE"
      },
      400
    );
  }

  const requestedSourceScope =
    readSourceScope(
      body.source
    );

  if (!requestedSourceScope) {
    return json(
      {
        success:
          false,
        error:
          "INVALID_SOURCE_SCOPE"
      },
      400
    );
  }

  const supabaseServer =
    createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession:
            false,
          autoRefreshToken:
            false
        }
      }
    );

  const context =
    await loadShadowErpContext(
      supabaseServer,
      user.id,
      {
        requestedScopeId:
          readRequestedErpScopeId(
            request
          )
      }
    );

  if (!context.ready) {
    return json(
      {
        success:
          false,
        error:
          "ERP_CONTEXT_NOT_READY",
        reason:
          context.reason
      },
      context.reason ===
        "READ_FAILED"
        ? 503
        : 409
    );
  }

  if (
    !erpScopeMatches(
      requestedSourceScope,
      context.scope
    )
  ) {
    return json(
      {
        success:
          false,
        error:
          "SOURCE_SCOPE_FORBIDDEN"
      },
      403
    );
  }

  const gateway =
    createCounterpartySourceTruthSupabaseGatewayAdapter(
      supabaseServer as
        unknown as
        SupabaseRpcClient
    );

  try {
    const actor = {
      userId:
        String(user.id)
    };

    const result =
      kind ===
        "SUPPLIER_RECEIPT"
        ? await gateway
            .persistSupplierReceiptSource(
              body.source as
                unknown as
                SupplierReceiptSourceTruth,
              actor
            )
        : await gateway
            .persistProviderEarningSource(
              body.source as
                unknown as
                ProviderEarningSourceTruth,
              actor
            );

    if (
      result.status ===
        "CONFLICT"
    ) {
      return json(
        {
          success:
            false,
          status:
            result.status,
          sourceId:
            result.sourceId,
          reason:
            result.reason
        },
        409
      );
    }

    if (
      result.status ===
        "REJECTED"
    ) {
      return json(
        {
          success:
            false,
          status:
            result.status,
          sourceId:
            result.sourceId,
          reason:
            result.reason
        },
        422
      );
    }

    return json(
      {
        success:
          true,
        status:
          result.status,
        sourceId:
          result.sourceId
      },
      result.status ===
        "CREATED"
        ? 201
        : 200
    );
  }
  catch {
    console.error(
      "[Counterparty Source Truth API] Persistence failed."
    );

    return json(
      {
        success:
          false,
        error:
          "COUNTERPARTY_SOURCE_TRUTH_PERSISTENCE_FAILED"
      },
      503
    );
  }
}