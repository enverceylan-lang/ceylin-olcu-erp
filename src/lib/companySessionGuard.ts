import type {
  NextRequest,
} from "next/server";
import {
  createClient,
} from "@supabase/supabase-js";

import {
  verifyAuth,
  type AuthenticatedUser,
} from "@/lib/authHelper";
import {
  readCompanySessionToken,
  type CompanySessionPayload,
} from "@/lib/companySession";
import type {
  ErpChannel,
} from "@/lib/channelAccess";
import {
  loadServerChannelAccess,
} from "@/lib/serverChannelAccess";

export type CompanySessionGuardResult =
  | {
      allowed: true;
      actor: AuthenticatedUser;
      session: CompanySessionPayload;
    }
  | {
      allowed: false;
      status: 401 | 403 | 500;
      code:
        | "UNAUTHORIZED"
        | "COMPANY_SESSION_REQUIRED"
        | "COMPANY_SCOPE_FORBIDDEN"
        | "COMPANY_CHANNEL_FORBIDDEN"
        | "SERVER_CONFIGURATION_MISSING";
    };

export async function requireCompanySession(
  req: NextRequest,
  expectedChannel?: ErpChannel,
): Promise<CompanySessionGuardResult> {
  const actor =
    await verifyAuth(req);

  if (!actor) {
    return {
      allowed: false,
      status: 401,
      code: "UNAUTHORIZED",
    };
  }

  const authHeader =
    req.headers.get("Authorization");

  const token =
    authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";

  const secret =
    process.env.SESSION_SECRET || "";

  const session =
    token && secret
      ? readCompanySessionToken(
          token,
          secret,
        )
      : null;

  if (
    !session ||
    session.sessionType !== "COMPANY" ||
    session.sub !== actor.id ||
    session.username !== actor.username ||
    session.role !== actor.role
  ) {
    return {
      allowed: false,
      status: 403,
      code: "COMPANY_SESSION_REQUIRED",
    };
  }

  if (
    expectedChannel &&
    session.channel !== expectedChannel
  ) {
    return {
      allowed: false,
      status: 403,
      code: "COMPANY_CHANNEL_FORBIDDEN",
    };
  }

  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      allowed: false,
      status: 500,
      code: "SERVER_CONFIGURATION_MISSING",
    };
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
    data: scopeData,
    error: scopeError,
  } = await supabase
    .from("erp_user_scopes")
    .select(
      "user_scope_id,user_id,tenant_id,company_id,is_active",
    )
    .eq("user_scope_id", session.userScopeId)
    .eq("user_id", actor.id)
    .eq("tenant_id", session.tenantId)
    .eq("company_id", session.companyId)
    .eq("is_active", true)
    .maybeSingle();

  if (scopeError || !scopeData) {
    return {
      allowed: false,
      status: 403,
      code: "COMPANY_SCOPE_FORBIDDEN",
    };
  }

  const {
    data: companyData,
    error: companyError,
  } = await supabase
    .from("erp_companies")
    .select(
      "tenant_id,company_id,slug,is_active",
    )
    .eq("tenant_id", session.tenantId)
    .eq("company_id", session.companyId)
    .eq("slug", session.companySlug)
    .eq("is_active", true)
    .maybeSingle();

  if (companyError || !companyData) {
    return {
      allowed: false,
      status: 403,
      code: "COMPANY_SCOPE_FORBIDDEN",
    };
  }

  if (expectedChannel) {
    const channelAccess =
      await loadServerChannelAccess(
        supabase,
        {
          tenantId: session.tenantId,
          userScopeId: session.userScopeId,
          channel: expectedChannel,
        },
      );

    if (!channelAccess.allowed) {
      return {
        allowed: false,
        status: 403,
        code: "COMPANY_CHANNEL_FORBIDDEN",
      };
    }
  }

  return {
    allowed: true,
    actor,
    session,
  };
}