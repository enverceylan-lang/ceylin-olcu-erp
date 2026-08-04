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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN_SHA256 =
  "9522e22fee47c5bdaf36c0b3f7fcbb1d318921f21756c3b85dedff31092a7f4a";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
} as const;

function fail(
  status: number,
  code: string,
) {
  return NextResponse.json(
    {
      success: false,
      code,
    },
    {
      status,
      headers: NO_STORE_HEADERS,
    },
  );
}

function sha256(
  value: string,
): string {
  return crypto
    .createHash("sha256")
    .update(value, "utf8")
    .digest("hex");
}

export async function POST(
  request: NextRequest,
) {
  const body =
    (await request
      .json()
      .catch(() => null)) as
      | {
          token?: unknown;
          password?: unknown;
        }
      | null;

  const token =
    String(body?.token || "");

  const password =
    String(body?.password || "").trim();

  const suppliedHash =
    sha256(token);

  const expected =
    Buffer.from(
      TOKEN_SHA256,
      "utf8",
    );

  const supplied =
    Buffer.from(
      suppliedHash,
      "utf8",
    );

  if (
    expected.length !== supplied.length ||
    !crypto.timingSafeEqual(
      expected,
      supplied,
    )
  ) {
    return fail(
      401,
      "RECOVERY_DENIED",
    );
  }

  if (
    password.length < 8 ||
    password === "123"
  ) {
    return fail(
      400,
      "PASSWORD_WEAK",
    );
  }

  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return fail(
      503,
      "SERVER_CONFIGURATION_MISSING",
    );
  }

  const supabase =
    createClient(
      url,
      key,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

  const {
    data: companies,
    error: companyError,
  } = await supabase
    .from("erp_companies")
    .select(
      "tenant_id,company_id,slug,is_active",
    )
    .eq(
      "slug",
      "perdeco",
    )
    .eq(
      "is_active",
      true,
    )
    .limit(2);

  if (
    companyError ||
    !companies ||
    companies.length !== 1
  ) {
    return fail(
      404,
      "COMPANY_SCOPE_INVALID",
    );
  }

  const company =
    companies[0];

  const {
    data: scopes,
    error: scopeError,
  } = await supabase
    .from("erp_user_scopes")
    .select(
      "user_id,username,is_active",
    )
    .eq(
      "tenant_id",
      company.tenant_id,
    )
    .eq(
      "company_id",
      company.company_id,
    )
    .eq(
      "username",
      "omer",
    )
    .eq(
      "is_active",
      true,
    )
    .limit(2);

  if (
    scopeError ||
    !scopes ||
    scopes.length !== 1
  ) {
    return fail(
      404,
      "USER_SCOPE_INVALID",
    );
  }

  const userId =
    String(
      scopes[0].user_id || "",
    );

  const {
    data: users,
    error: userError,
  } = await supabase
    .from("users")
    .select(
      "id,role,isActive",
    )
    .eq(
      "id",
      userId,
    )
    .limit(2);

  if (
    userError ||
    !users ||
    users.length !== 1
  ) {
    return fail(
      404,
      "USER_INVALID",
    );
  }

  if (
    users[0].isActive !== true ||
    String(users[0].role || "") !==
      "COMPANY_ADMIN"
  ) {
    return fail(
      403,
      "TARGET_NOT_COMPANY_ADMIN",
    );
  }

  const passwordHash =
    hashPassword(password);

  const {
    data: updated,
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
      userId,
    )
    .select("id");

  if (
    updateError ||
    !updated ||
    updated.length !== 1
  ) {
    return fail(
      500,
      "PASSWORD_UPDATE_FAILED",
    );
  }

  return NextResponse.json(
    {
      success: true,
      companySlug: "perdeco",
      username: "omer",
      role: "COMPANY_ADMIN",
      passwordChanged: true,
    },
    {
      status: 200,
      headers: NO_STORE_HEADERS,
    },
  );
}