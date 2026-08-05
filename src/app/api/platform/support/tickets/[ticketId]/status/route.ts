import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  createClient,
} from "@supabase/supabase-js";

import {
  verifyAuth,
} from "@/lib/authHelper";
import {
  requirePlatformSuperAdmin,
} from "@/lib/platformAdminServerGuard";
import {
  parseSupportStatusTransitionInput,
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

export async function PATCH(
  request: NextRequest,
  context: {
    params:
      Promise<{
        ticketId: string;
      }>;
  },
) {
  const access =
    await requirePlatformSuperAdmin(
      request,
    );

  if (!access.allowed) {
    return json(
      {
        success: false,
        error: access.code,
      },
      access.status,
    );
  }

  const actor =
    await verifyAuth(request);

  if (
    !actor ||
    actor.role !== "PLATFORM_SUPER_ADMIN"
  ) {
    return json(
      {
        success: false,
        error: "UNAUTHORIZED",
      },
      401,
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
    parseSupportStatusTransitionInput(
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
    data: rpcResult,
    error: rpcError,
  } = await supabase.rpc(
    "transition_erp_support_ticket_status_v1",
    {
      p_ticket_id: ticketId,
      p_actor_user_id: actor.id,
      p_actor_role:
        String(actor.role || ""),
      p_to_status:
        parsed.input.status,
      p_note:
        parsed.input.note,
    },
  );

  const result =
    rpcResult as
      | {
          audit_id?: unknown;
          tenant_id?: unknown;
          company_id?: unknown;
        }
      | null;

  const auditId =
    typeof result?.audit_id === "string"
      ? result.audit_id
      : "";

  const tenantId =
    typeof result?.tenant_id === "string"
      ? result.tenant_id
      : "";

  const companyId =
    typeof result?.company_id === "string"
      ? result.company_id
      : "";

  if (
    rpcError ||
    !isUuid(auditId) ||
    !isUuid(tenantId) ||
    !isUuid(companyId)
  ) {
    console.error(
      "[Platform Support] Status transition RPC failed.",
    );

    return json(
      {
        success: false,
        error: "SUPPORT_STATUS_UPDATE_FAILED",
      },
      503,
    );
  }

  const ticketResult =
    await supabase
      .from("erp_support_tickets")
      .select(
        "ticket_id,tenant_id,company_id,status,updated_at,resolved_at,closed_at",
      )
      .eq("tenant_id", tenantId)
      .eq("company_id", companyId)
      .eq("ticket_id", ticketId)
      .single();

  const auditResult =
    await supabase
      .from("erp_support_status_audits")
      .select(
        "audit_id,ticket_id,tenant_id,company_id,from_status,to_status,actor_user_id,actor_side,note,created_at",
      )
      .eq("tenant_id", tenantId)
      .eq("company_id", companyId)
      .eq("ticket_id", ticketId)
      .eq("audit_id", auditId)
      .single();

  if (
    ticketResult.error ||
    !ticketResult.data ||
    auditResult.error ||
    !auditResult.data
  ) {
    console.error(
      "[Platform Support] Status read-back failed.",
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
      ticket: ticketResult.data,
      audit: auditResult.data,
    },
    200,
  );
}