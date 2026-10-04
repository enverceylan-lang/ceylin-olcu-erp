export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATCH_LIMIT = 100;
const ISTANBUL_TIME_ZONE = "Europe/Istanbul";
const DAY_POLICY = "CALENDAR_DAY_V1";

function istanbulDate(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ISTANBUL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts
      .filter(part => part.type !== "literal")
      .map(part => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function unauthorized(): Response {
  return Response.json(
    { ok: false, code: "POS_AUTO_SETTLEMENT_CRON_UNAUTHORIZED" },
    { status: 401 }
  );
}

export async function GET(request: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!cronSecret) {
    return Response.json(
      { ok: false, code: "POS_AUTO_SETTLEMENT_CRON_SECRET_MISSING" },
      { status: 503 }
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return unauthorized();
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json(
      { ok: false, code: "POS_AUTO_SETTLEMENT_SERVER_CONFIG_MISSING" },
      { status: 503 }
    );
  }

  const effectiveDate = istanbulDate();

  const response = await fetch(
    `${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/run_finance_pos_auto_settlement_v1`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_effective_date: effectiveDate,
        p_limit: BATCH_LIMIT,
      }),
      cache: "no-store",
    }
  );

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    console.error("[POS Auto Settlement] RPC failed", {
      status: response.status,
      effectiveDate,
      dayPolicy: DAY_POLICY,
    });

    return Response.json(
      {
        ok: false,
        code: "POS_AUTO_SETTLEMENT_RPC_FAILED",
        effectiveDate,
        dayPolicy: DAY_POLICY,
      },
      { status: 502 }
    );
  }

  return Response.json({
    ok: true,
    effectiveDate,
    dayPolicy: DAY_POLICY,
    result: payload,
  });
}
