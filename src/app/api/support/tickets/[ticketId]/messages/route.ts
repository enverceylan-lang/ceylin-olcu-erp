import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  createClient,
} from "@supabase/supabase-js";

import {
  requireCompanySession,
} from "@/lib/companySessionGuard";
import {
  parseSupportMessageCreateInput,
} from "@/lib/support/supportMutationContracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
} as const;

function json(
  body: Record<string, unknown>,
  status: number,
) {
  return NextResponse.json(
    body,
    {
      status,
      headers: NO_STORE_HEADERS,
    },
  );
}

function serverClient() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(
    url,
    key,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

function isUuid(value: string): boolean {
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(value)
  );
}

export async function POST(
  request: NextRequest,
  context: {
    params:
      Promise<{
        ticketId: string;
      }>;
  },
) {
  const companySession =
    await requireCompanySession(
      request,
      "WEB",
    );

  if (!companySession.allowed) {
    return json(
      {
        success: false,
        error: companySession.code,
      },
      companySession.status,
    );
  }

  const {
    ticketId: rawTicketId,
  } = await context.params;

  const ticketId =
    String(rawTicketId || "")
      .trim()
      .toLowerCase();

  if (!isUuid(ticketId)) {
    return json(
      {
        success: false,
        error: "INVALID_TICKET_ID",
      },
      400,
    );
  }

  const parsed =
    parseSupportMessageCreateInput(
      await request
        .json()
        .catch(() => null),
    );

  if (!parsed.valid) {
    return json(
      {
        success: false,
        error: parsed.code,
      },
      400,
    );
  }

  const supabase =
    serverClient();

  if (!supabase) {
    return json(
      {
        success: false,
        error: "SERVER_CONFIGURATION_MISSING",
      },
      500,
    );
  }

  const {
    tenantId,
    companyId,
    userScopeId,
  } = companySession.session;

  if (!userScopeId) {
    return json(
      {
        success: false,
        error: "COMPANY_SCOPE_FORBIDDEN",
      },
      403,
    );
  }

  const actor =
    companySession.actor;

  const {
    data: rpcResult,
    error: rpcError,
  } = await supabase.rpc(
    "add_erp_company_support_message_v1",
    {
      p_ticket_id: ticketId,
      p_actor_user_id: actor.id,
      p_user_scope_id: userScopeId,
      p_tenant_id: tenantId,
      p_company_id: companyId,
      p_actor_role:
        String(actor.role || ""),
      p_body: parsed.input.body,
    },
  );

  const result =
    rpcResult as
      | {
          message_id?: unknown;
        }
      | null;

  const messageId =
    typeof result?.message_id === "string"
      ? result.message_id
      : "";

  if (rpcError || !isUuid(messageId)) {
    console.error(
      "[Support Message] Company message RPC failed.",
    );

    return json(
      {
        success: false,
        error: "SUPPORT_MESSAGE_CREATE_FAILED",
      },
      503,
    );
  }

  const {
    data: message,
    error: readError,
  } = await supabase
    .from("erp_support_messages")
    .select(
      "message_id,ticket_id,sender_side,sender_role,body,created_at",
    )
    .eq("tenant_id", tenantId)
    .eq("company_id", companyId)
    .eq("ticket_id", ticketId)
    .eq("message_id", messageId)
    .single();

  if (readError || !message) {
    console.error(
      "[Support Message] Company message read-back failed.",
    );

    return json(
      {
        success: false,
        error: "SUPPORT_READ_FAILED",
      },
      503,
    );
  }

  return json(
    {
      success: true,
      message,
    },
    201,
  );
}