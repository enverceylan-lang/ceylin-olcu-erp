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
  loadShadowErpContext
} from "@/lib/serverErpContext";

import {
  handleFinanceSystemWorkflowApi
} from "@/lib/finance/financeSystemWorkflowApiHandler";

import type {
  FinanceSupabaseWorkflowCoordinatorClient
} from "@/lib/finance/financeSupabaseWorkflowCoordinator";

export const dynamic =
  "force-dynamic";

export async function POST(
  req:
    NextRequest
) {
  const user =
    await verifyAuth(req);

  if (!user) {
    return NextResponse.json(
      {
        outcome:
          "REJECT",
        reason:
          "UNAUTHORIZED"
      },
      {
        status:
          401,
        headers: {
          "Cache-Control":
            "no-store"
        }
      }
    );
  }

  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (
    !supabaseUrl ||
    !supabaseServiceKey
  ) {
    return NextResponse.json(
      {
        outcome:
          "REJECT",
        reason:
          "SERVER_CONFIGURATION_ERROR"
      },
      {
        status:
          500,
        headers: {
          "Cache-Control":
            "no-store"
        }
      }
    );
  }

  let body:
    unknown;

  try {
    body =
      await req.json();
  }
  catch {
    return NextResponse.json(
      {
        outcome:
          "REJECT",
        reason:
          "INVALID_JSON"
      },
      {
        status:
          400,
        headers: {
          "Cache-Control":
            "no-store"
        }
      }
    );
  }

  const supabaseServer =
    createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          persistSession:
            false,
          autoRefreshToken:
            false
        }
      }
    );

  const erpContext =
    await loadShadowErpContext(
      supabaseServer,
      user.id,
      {
        requestedScopeId:
          readRequestedErpScopeId(req)
      }
    );

  if (!erpContext.ready) {
    return NextResponse.json(
      {
        outcome:
          "REJECT",
        reason:
          erpContext.reason
      },
      {
        status:
          erpContext.reason ===
            "READ_FAILED"
            ? 503
            : 409,
        headers: {
          "Cache-Control":
            "no-store"
        }
      }
    );
  }

  /*
   * SupabaseClient generic overloadları, dar finance adapter
   * sözleşmesindeki satış/iade union satırlarını yapısal olarak
   * eşleştiremiyor. Runtime istemci gerekli from/rpc yeteneklerini
   * sağlıyor; cast yalnız server-side adapter sınırında tutulur.
   */
  const financeClient =
    supabaseServer as unknown as
      FinanceSupabaseWorkflowCoordinatorClient;

  const result =
    await handleFinanceSystemWorkflowApi(
      body,
      {
        userId:
          String(user.id),
        scope:
          erpContext.scope
      },
      financeClient
    );

  return NextResponse.json(
    result.body,
    {
      status:
        result.status,
      headers: {
        "Cache-Control":
          "no-store"
      }
    }
  );
}