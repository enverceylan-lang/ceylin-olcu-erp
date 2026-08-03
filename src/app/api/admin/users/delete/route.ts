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
  isUserInCompany,
} from "@/lib/companyUserScopeGuard";

function getServerClient() {
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

export async function POST(
  req: NextRequest,
) {
  try {
    const companySession =
      await requireCompanySession(
        req,
        "WEB",
      );

    if (!companySession.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: companySession.code,
        },
        {
          status: companySession.status,
        },
      );
    }

    const caller =
      companySession.actor;

    if (
      caller.role?.toLowerCase() !==
      "admin"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Yetkisiz erişim.",
        },
        {
          status: 403,
        },
      );
    }

    const body =
      await req.json();

    const id =
      String(
        body?.id || "",
      ).trim();

    if (
      !id ||
      id === caller.id
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Geçersiz kullanıcı ID.",
        },
        {
          status: 400,
        },
      );
    }

    const supabase =
      getServerClient();

    if (!supabase) {
      return NextResponse.json(
        {
          success: false,
          error:
            "SERVER_CONFIGURATION_MISSING",
        },
        {
          status: 500,
        },
      );
    }

    const targetInCompany =
      await isUserInCompany(
        supabase,
        companySession.session,
        id,
      );

    if (!targetInCompany) {
      return NextResponse.json(
        {
          success: false,
          code:
            "USER_OUTSIDE_COMPANY_SCOPE",
          error:
            "Hedef kullanıcı bu şirket kapsamında değil.",
        },
        {
          status: 403,
        },
      );
    }

    const {
      data: deactivatedScopes,
      error: scopeError,
    } = await supabase
      .from("erp_user_scopes")
      .update({
        is_active: false,
      })
      .eq("user_id", id)
      .eq(
        "tenant_id",
        companySession.session.tenantId,
      )
      .eq(
        "company_id",
        companySession.session.companyId,
      )
      .eq("is_active", true)
      .select("user_scope_id");

    if (
      scopeError ||
      !deactivatedScopes ||
      deactivatedScopes.length < 1
    ) {
      return NextResponse.json(
        {
          success: false,
          code:
            "USER_SCOPE_NOT_DEACTIVATED",
          error:
            "Kullanıcı şirket kapsamından çıkarılamadı.",
        },
        {
          status: 500,
        },
      );
    }

    const {
      count: remainingActiveScopeCount,
      error: remainingScopeError,
    } = await supabase
      .from("erp_user_scopes")
      .select(
        "*",
        {
          count: "exact",
          head: true,
        },
      )
      .eq("user_id", id)
      .eq("is_active", true);

    if (remainingScopeError) {
      return NextResponse.json(
        {
          success: false,
          code:
            "USER_SCOPE_RECHECK_FAILED",
          error:
            "Kullanıcı kapsamı yeniden doğrulanamadı.",
        },
        {
          status: 500,
        },
      );
    }

    if (
      (remainingActiveScopeCount || 0) === 0
    ) {
      const {
        error: userDeactivateError,
      } = await supabase
        .from("users")
        .update({
          isActive: false,
          updatedAt:
            new Date().toISOString(),
        })
        .eq("id", id);

      if (userDeactivateError) {
        return NextResponse.json(
          {
            success: false,
            code:
              "USER_DEACTIVATE_FAILED",
            error:
              "Kullanıcı hesabı pasife alınamadı.",
          },
          {
            status: 500,
          },
        );
      }
    }

    return NextResponse.json({
      success: true,
      action:
        "REMOVED_FROM_COMPANY",
      userId: id,
      companyId:
        companySession.session.companyId,
    });
  }
  catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Internal server error";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      {
        status: 500,
      },
    );
  }
}