import crypto from "crypto";
import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  createClient,
} from "@supabase/supabase-js";

import {
  hashPasswordV2,
  verifyPassword,
} from "@/lib/authHelper";
import {
  createCompanySessionToken,
} from "@/lib/companySession";
import {
  LEGACY_FINANCE_PERMISSION_VERSION,
  resolveFinancePermissions,
} from "@/lib/finance/financePermissionResolver";
import {
  normalizeUsername,
} from "@/lib/usernameHelper";
import {
  loadShadowErpContext,
} from "@/lib/serverErpContext";
import {
  loadServerChannelAccess,
} from "@/lib/serverChannelAccess";
import {
  ERP_ACTIVE_SCOPE_COOKIE,
} from "@/lib/erpActiveScopeCookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control":
    "no-store, max-age=0",
} as const;

type LoginUserRecord = {
  id: string;
  name: string | null;
  username: string;
  password: string;
  role: string;
  isActive: boolean;
  permissions: unknown[] | null;
  email: string | null;
  phone: string | null;
  providerCustomerId: string | null;
  providerType:
    | "TAILOR"
    | "INSTALLER"
    | null;
  tcNo: string | null;
  address: string | null;
  profileCompletedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type CompanyRow = {
  tenant_id: string;
  company_id: string;
  slug: string;
  name: string;
  is_active: boolean;
};

type UserScopeRow = {
  user_scope_id: string;
  user_id: string;
  tenant_id: string;
  company_id: string;
  username: string;
  is_default: boolean;
  is_active: boolean;
};

function normalizeCompanySlug(
  value: unknown,
): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isValidCompanySlug(
  value: string,
): boolean {
  return (
    /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/
      .test(value)
  );
}

function getAuthVersion(
  user: {
    updatedAt?: string | null;
    createdAt?: string | null;
  },
): string {
  return String(
    user.updatedAt ||
      user.createdAt ||
      "",
  );
}

function genericUnauthorized() {
  return NextResponse.json(
    {
      success: false,
      error:
        "Kullanıcı adı veya şifre hatalı.",
    },
    {
      status: 401,
      headers: NO_STORE_HEADERS,
    },
  );
}

export async function POST(
  req: NextRequest,
) {
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  const sessionSecret =
    process.env.SESSION_SECRET;

  if (
    !supabaseUrl ||
    !serviceRoleKey ||
    !sessionSecret
  ) {
    console.error(
      "[Company Login Config] Missing server configuration.",
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Sunucu yapılandırması tamamlanmamış.",
      },
      {
        status: 500,
        headers: NO_STORE_HEADERS,
      },
    );
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

  try {
    const body =
      (await req.json()) as {
        companySlug?: unknown;
        username?: unknown;
        password?: unknown;
      };

    const companySlug =
      normalizeCompanySlug(
        body.companySlug,
      );

    const username =
      normalizeUsername(
        String(
          body.username || "",
        ),
      );

    const password =
      String(
        body.password || "",
      ).trim();

    if (
      !isValidCompanySlug(
        companySlug,
      ) ||
      !username ||
      !password
    ) {
      return genericUnauthorized();
    }

    const {
      data: companyData,
      error: companyError,
    } = await supabase
      .from("erp_companies")
      .select(
        "tenant_id,company_id,slug,name,is_active",
      )
      .eq(
        "slug",
        companySlug,
      )
      .eq(
        "is_active",
        true,
      )
      .maybeSingle();

    const company =
      companyData as
        | CompanyRow
        | null;

    if (
      companyError ||
      !company ||
      !company.is_active
    ) {
      return genericUnauthorized();
    }

    const {
      data: scopeData,
      error: scopeError,
    } = await supabase
      .from("erp_user_scopes")
      .select(
        "user_scope_id,user_id,tenant_id,company_id,username,is_default,is_active",
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
        username,
      )
      .eq(
        "is_active",
        true,
      )
      .order(
        "is_default",
        {
          ascending: false,
        },
      )
      .limit(1)
      .maybeSingle();

    const scope =
      scopeData as
        | UserScopeRow
        | null;

    if (
      scopeError ||
      !scope ||
      !scope.is_active ||
      scope.tenant_id !==
        company.tenant_id ||
      scope.company_id !==
        company.company_id ||
      scope.username !== username
    ) {
      return genericUnauthorized();
    }

    const {
      data: userData,
      error: userError,
    } = await supabase
      .from("users")
      .select(
        [
          "id",
          "name",
          "username",
          "password",
          "role",
          "isActive",
          "permissions",
          "email",
          "phone",
          "tcNo",
          "address",
          "profileCompletedAt",
          "createdAt",
          "updatedAt",
          "providerCustomerId",
          "providerType",
        ].join(","),
      )
      .eq(
        "id",
        scope.user_id,
      )
      .maybeSingle();

    const user =
      userData as
        | LoginUserRecord
        | null;

    if (
      userError ||
      !user ||
      user.id !== scope.user_id ||
      !user.isActive ||
      !user.password ||
      user.role ===
        "PLATFORM_SUPER_ADMIN"
    ) {
      return genericUnauthorized();
    }

    const passwordVerification =
      verifyPassword(
        user.password,
        password,
      );

    if (!passwordVerification.valid) {
      return genericUnauthorized();
    }

    if (passwordVerification.needsRehash) {
      const passwordUpgradedAt =
        new Date().toISOString();

      const {
        error: passwordUpgradeError,
      } = await supabase
        .from("users")
        .update({
          password:
            hashPasswordV2(password),
          updatedAt:
            passwordUpgradedAt,
        })
        .eq("id", user.id);

      if (passwordUpgradeError) {
        console.error(
          "[Company Login] Legacy password upgrade failed.",
        );
      } else {
        user.updatedAt =
          passwordUpgradedAt;
      }
    }

    const context =
      await loadShadowErpContext(
        supabase,
        user.id,
        {
          requestedScopeId:
            scope.user_scope_id,
        },
      );

    if (
      !context.ready ||
      context.scope.tenantId !==
        company.tenant_id ||
      context.scope.companyId !==
        company.company_id
    ) {
      return genericUnauthorized();
    }
    const webAccess =
      await loadServerChannelAccess(
        supabase,
        {
          tenantId:
            company.tenant_id,
          userScopeId:
            scope.user_scope_id,
          channel: "WEB",
        },
      );

    if (!webAccess.allowed) {
      return genericUnauthorized();
    }

    const permissionResolution =
      resolveFinancePermissions({
        role: user.role,
        storedPermissions:
          user.permissions,
        financePermissionGrants: [],
        financePermissionDenies: [],
        permissionVersion:
          LEGACY_FINANCE_PERMISSION_VERSION,
        expectedPermissionVersion:
          LEGACY_FINANCE_PERMISSION_VERSION,
        applyRoleDefaults: true,
      });

    const nowSeconds =
      Math.floor(
        Date.now() / 1000,
      );

    const sessionLifetimeSeconds =
      12 * 60 * 60;

    const sessionToken =
      createCompanySessionToken(
        {
          sub:
            String(user.id),

          username:
            String(
              user.username,
            ),

          role:
            String(user.role),

          authVersion:
            getAuthVersion(user),

          permissionVersion:
            LEGACY_FINANCE_PERMISSION_VERSION,

          sessionType:
            "COMPANY",

          channel:
            "WEB",

          tenantId:
            company.tenant_id,

          companyId:
            company.company_id,

          userScopeId:
            scope.user_scope_id,

          companySlug:
            company.slug,

          iat:
            nowSeconds,

          exp:
            nowSeconds +
            sessionLifetimeSeconds,
        },
        sessionSecret,
      );

    const sanitizedUser =
      Object.fromEntries(
        Object.entries(user)
          .filter(
            ([key]) =>
              key !== "password",
          ),
      ) as Omit<
        LoginUserRecord,
        "password"
      >;

    const response = NextResponse.json(
      {
        success: true,

        company: {
          tenantId:
            company.tenant_id,

          companyId:
            company.company_id,

          companySlug:
            company.slug,

          companyName:
            company.name,

          userScopeId:
            scope.user_scope_id,
        },

        user: {
          ...sanitizedUser,

          storedPermissions:
            Array.isArray(
              user.permissions,
            )
              ? [
                  ...user.permissions,
                ]
              : [],

          permissions:
            permissionResolution
              .effectivePermissions,

          permissionVersion:
            LEGACY_FINANCE_PERMISSION_VERSION,
        },

        session: {
          token:
            sessionToken,

          type:
            "COMPANY",

          channel:
            "WEB",

          expiresAt:
            new Date(
              (
                nowSeconds +
                sessionLifetimeSeconds
              ) * 1000,
            ).toISOString(),

          rememberMe:
            false,

          companySlug:
            company.slug,

          companyScopeId:
            scope.user_scope_id,

          permissionVersion:
            LEGACY_FINANCE_PERMISSION_VERSION,
        },
      },
      {
        status: 200,
        headers: NO_STORE_HEADERS,
      },
    );


    response.cookies.set(
      ERP_ACTIVE_SCOPE_COOKIE,
      scope.user_scope_id,
      {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: sessionLifetimeSeconds,
      },
    );

    return response;
  } catch {
    console.error(
      "[Company Login] Internal error.",
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Giriş işlemi sırasında beklenmeyen bir hata oluştu.",
      },
      {
        status: 500,
        headers: NO_STORE_HEADERS,
      },
    );
  }
}