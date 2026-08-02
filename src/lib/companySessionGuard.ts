import type {
  NextRequest,
} from "next/server";

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

export type CompanySessionGuardResult =
  | {
      allowed: true;
      actor: AuthenticatedUser;
      session: CompanySessionPayload;
    }
  | {
      allowed: false;
      status: 401 | 403;
      code:
        | "UNAUTHORIZED"
        | "COMPANY_SESSION_REQUIRED"
        | "COMPANY_CHANNEL_FORBIDDEN";
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

  return {
    allowed: true,
    actor,
    session,
  };
}