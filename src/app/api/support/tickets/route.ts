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
  parseSupportTicketCreateInput,
} from "@/lib/support/supportContracts";

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

export async function GET(
  request: NextRequest,
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
  } = companySession.session;

  const {
    data: tickets,
    error: ticketError,
  } = await supabase
    .from("erp_support_tickets")
    .select(
      "ticket_id,category,module_code,subject,description,status,created_by_user_id,created_by_role,created_at,updated_at,resolved_at,closed_at",
    )
    .eq("tenant_id", tenantId)
    .eq("company_id", companyId)
    .order("created_at", {
      ascending: false,
    })
    .limit(200);

  if (ticketError) {
    console.error(
      "[Support Tickets] Company ticket read failed.",
    );
    return json(
      {
        success: false,
        error: "SUPPORT_READ_FAILED",
      },
      503,
    );
  }

  const ticketIds =
    (tickets || []).map(
      ticket =>
        String(ticket.ticket_id),
    );

  let messages:
    Record<string, unknown>[] = [];

  if (ticketIds.length > 0) {
    const {
      data,
      error,
    } = await supabase
      .from("erp_support_messages")
      .select(
        "message_id,ticket_id,sender_side,sender_role,body,created_at",
      )
      .eq("tenant_id", tenantId)
      .eq("company_id", companyId)
      .in("ticket_id", ticketIds)
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      console.error(
        "[Support Tickets] Company message read failed.",
      );
      return json(
        {
          success: false,
          error: "SUPPORT_READ_FAILED",
        },
        503,
      );
    }

    messages =
      (data || []) as
        Record<string, unknown>[];
  }

  return json(
    {
      success: true,
      tickets: tickets || [],
      messages,
    },
    200,
  );
}

export async function POST(
  request: NextRequest,
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

  const parsed =
    parseSupportTicketCreateInput(
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

  const actor =
    companySession.actor;

  if (!userScopeId) {
    return json(
      {
        success: false,
        error: "COMPANY_SCOPE_FORBIDDEN",
      },
      403,
    );
  }

  const {
    data: rpcResult,
    error: rpcError,
  } = await supabase.rpc(
    "create_erp_support_ticket_v1",
    {
      p_request: {
        category:
          parsed.input.category,
        module_code:
          parsed.input.moduleCode,
        subject:
          parsed.input.subject,
        description:
          parsed.input.description,
      },
      p_actor_user_id:
        actor.id,
      p_user_scope_id:
        userScopeId,
      p_tenant_id:
        tenantId,
      p_company_id:
        companyId,
      p_actor_role:
        String(actor.role || ""),
    },
  );

  if (rpcError || !rpcResult) {
    console.error(
      "[Support Tickets] Atomic ticket create failed.",
    );
    return json(
      {
        success: false,
        error: "SUPPORT_CREATE_FAILED",
      },
      503,
    );
  }

  const ticketId =
    typeof rpcResult === "object" &&
    rpcResult !== null &&
    "ticket_id" in rpcResult
      ? String(
          (
            rpcResult as {
              ticket_id?: unknown;
            }
          ).ticket_id || "",
        )
      : "";

  if (!ticketId) {
    return json(
      {
        success: false,
        error: "SUPPORT_CREATE_FAILED",
      },
      503,
    );
  }

  const {
    data: ticket,
    error: ticketReadError,
  } = await supabase
    .from("erp_support_tickets")
    .select(
      "ticket_id,category,module_code,subject,description,status,created_by_user_id,created_by_role,created_at,updated_at",
    )
    .eq("tenant_id", tenantId)
    .eq("company_id", companyId)
    .eq("ticket_id", ticketId)
    .single();

  if (ticketReadError || !ticket) {
    console.error(
      "[Support Tickets] Created ticket read-back failed.",
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
      ticket,
    },
    201,
  );
}