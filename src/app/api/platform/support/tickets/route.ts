import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  createClient,
} from "@supabase/supabase-js";

import {
  requirePlatformSuperAdmin,
} from "@/lib/platformAdminServerGuard";

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
    data: tickets,
    error: ticketError,
  } = await supabase
    .from("erp_support_tickets")
    .select(
      "ticket_id,tenant_id,company_id,category,module_code,subject,description,status,created_by_user_id,created_by_role,created_at,updated_at,resolved_at,closed_at",
    )
    .order("created_at", {
      ascending: false,
    })
    .limit(500);

  if (ticketError) {
    console.error(
      "[Platform Support] Ticket read failed.",
    );
    return json(
      {
        success: false,
        error: "SUPPORT_READ_FAILED",
      },
      503,
    );
  }

  const companyIds =
    [
      ...new Set(
        (tickets || []).map(
          ticket =>
            String(ticket.company_id),
        ),
      ),
    ];

  const ticketIds =
    (tickets || []).map(
      ticket =>
        String(ticket.ticket_id),
    );

  let companies:
    Record<string, unknown>[] = [];
  let messages:
    Record<string, unknown>[] = [];
  let audits:
    Record<string, unknown>[] = [];

  if (companyIds.length > 0) {
    const {
      data,
      error,
    } = await supabase
      .from("erp_companies")
      .select(
        "company_id,tenant_id,company_code,slug,name,is_active",
      )
      .in(
        "company_id",
        companyIds,
      );

    if (error) {
      console.error(
        "[Platform Support] Company metadata read failed.",
      );
      return json(
        {
          success: false,
          error: "SUPPORT_COMPANY_METADATA_READ_FAILED",
        },
        503,
      );
    }

    companies =
      (data || []) as
        Record<string, unknown>[];
  }

  if (ticketIds.length > 0) {
    const messageResult =
      await supabase
        .from("erp_support_messages")
        .select(
          "message_id,ticket_id,tenant_id,company_id,sender_user_id,sender_side,sender_role,body,created_at",
        )
        .in(
          "ticket_id",
          ticketIds,
        )
        .order("created_at", {
          ascending: true,
        });

    if (messageResult.error) {
      console.error(
        "[Platform Support] Message read failed.",
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
      (messageResult.data || []) as
        Record<string, unknown>[];

    const auditResult =
      await supabase
        .from("erp_support_status_audits")
        .select(
          "audit_id,ticket_id,tenant_id,company_id,from_status,to_status,actor_user_id,actor_side,note,created_at",
        )
        .in(
          "ticket_id",
          ticketIds,
        )
        .order("created_at", {
          ascending: true,
        });

    if (auditResult.error) {
      console.error(
        "[Platform Support] Audit read failed.",
      );
      return json(
        {
          success: false,
          error: "SUPPORT_READ_FAILED",
        },
        503,
      );
    }

    audits =
      (auditResult.data || []) as
        Record<string, unknown>[];
  }

  return json(
    {
      success: true,
      tickets: tickets || [],
      companies,
      messages,
      audits,
    },
    200,
  );
}