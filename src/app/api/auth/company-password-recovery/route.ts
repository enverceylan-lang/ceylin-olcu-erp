import crypto from "crypto";
import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  createClient,
} from "@supabase/supabase-js";

import {
  hashPassword,
} from "@/lib/authHelper";
import {
  normalizeUsername,
} from "@/lib/usernameHelper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
} as const;

function safeEqualText(
  left: string,
  right: string,
): boolean {
  const leftBuffer =
    Buffer.from(left, "utf8");
  const rightBuffer =
    Buffer.from(right, "utf8");

  return (
    leftBuffer.length ===
      rightBuffer.length &&
    crypto.timingSafeEqual(
      leftBuffer,
      rightBuffer,
    )
  );
}

function genericFailure(
  status: number,
) {
  return NextResponse.json(
    {
      success: false,
      error:
        "Recovery request could not be completed.",
    },
    {
      status,
      headers: NO_STORE_HEADERS,
    },
  );
}

export async function POST(
  request: NextRequest,
) {
  const recoveryToken =
    String(
      process.env.AUTH_RECOVERY_TOKEN ||
        "",
    ).trim();

  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (
    !recoveryToken ||
    !supabaseUrl ||
    !serviceRoleKey
  ) {
    console.error(
      "[Company Password Recovery] Required server configuration is missing.",
    );

    return genericFailure(503);
  }

  const body =
    (await request
      .json()
      .catch(() => null)) as
      | {
          recoveryToken?: unknown;
          companySlug?: unknown;
          username?: unknown;
          password?: unknown;
        }
      | null;

  const suppliedRecoveryToken =
    String(
      body?.recoveryToken || "",
    ).trim();

  if (
    !suppliedRecoveryToken ||
    !safeEqualText(
      suppliedRecoveryToken,
      recoveryToken,
    )
  ) {
    return genericFailure(401);
  }

  const companySlug =
    String(
      body?.companySlug || "",
    )
      .trim()
      .toLowerCase();

  const username =
    normalizeUsername(
      String(
        body?.username || "",
      ),
    );

  const password =
    String(
      body?.password || "",
    ).trim();

  if (
    !/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/
      .test(companySlug) ||
    !username ||
    password.length < 8 ||
    password === "123"
  ) {
    return genericFailure(400);
  }

  const supabase =
    createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

  const {
    data: companyData,
    error: companyError,
  } = await supabase
    .from("erp_companies")
    .select(
      "tenant_id,company_id,slug,is_active",
    )
    .eq("slug", companySlug)
    .eq("is_active", true)
    .maybeSingle();

  if (
    companyError ||
    !companyData
  ) {
    return genericFailure(404);
  }

  const {
    data: scopeRows,
    error: scopeError,
  } = await supabase
    .from("erp_user_scopes")
    .select("user_id")
    .eq(
      "tenant_id",
      String(
        companyData.tenant_id,
      ),
    )
    .eq(
      "company_id",
      String(
        companyData.company_id,
      ),
    )
    .eq("is_active", true);

  if (
    scopeError ||
    !scopeRows
  ) {
    return genericFailure(500);
  }

  const userIds =
    Array.from(
      new Set(
        scopeRows
          .map(row =>
            String(
              row.user_id || "",
            ).trim(),
          )
          .filter(Boolean),
      ),
    );

  if (userIds.length === 0) {
    return genericFailure(404);
  }

  const {
    data: userRows,
    error: userError,
  } = await supabase
    .from("users")
    .select(
      "id,username,role,isActive",
    )
    .eq("username", username)
    .in("id", userIds)
    .limit(2);

  if (
    userError ||
    !userRows ||
    userRows.length !== 1
  ) {
    return genericFailure(404);
  }

  const user =
    userRows[0];

  if (
    user.isActive !== true ||
    String(
      user.role || "",
    ) === "PLATFORM_SUPER_ADMIN"
  ) {
    return genericFailure(403);
  }

  const passwordHash =
    hashPassword(password);

  const {
    data: updatedRows,
    error: updateError,
  } = await supabase
    .from("users")
    .update({
      password: passwordHash,
      updatedAt:
        new Date().toISOString(),
    })
    .eq(
      "id",
      String(user.id),
    )
    .select("id");

  if (
    updateError ||
    !updatedRows ||
    updatedRows.length !== 1
  ) {
    return genericFailure(500);
  }

  return NextResponse.json(
    {
      success: true,
      companySlug,
      username,
      passwordChanged: true,
    },
    {
      status: 200,
      headers: NO_STORE_HEADERS,
    },
  );
}