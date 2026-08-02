import type { NextRequest } from "next/server";
import {
  verifyAuth,
  type AuthenticatedUser,
} from "@/lib/authHelper";
import {
  isPlatformSuperAdmin,
} from "@/lib/platformAdminContracts";

export type PlatformSuperAdminGuardResult =
  | {
      allowed: true;
      actor: AuthenticatedUser;
    }
  | {
      allowed: false;
      status: 401 | 403;
      code:
        | "UNAUTHORIZED"
        | "PLATFORM_SUPER_ADMIN_REQUIRED";
    };

export function decidePlatformSuperAdminAccess(
  actor:
    | Pick<AuthenticatedUser, "id" | "role">
    | null
    | undefined,
): PlatformSuperAdminGuardResult {
  if (!actor) {
    return {
      allowed: false,
      status: 401,
      code: "UNAUTHORIZED",
    };
  }

  if (
    !isPlatformSuperAdmin({
      userId: actor.id,
      role: actor.role,
    })
  ) {
    return {
      allowed: false,
      status: 403,
      code: "PLATFORM_SUPER_ADMIN_REQUIRED",
    };
  }

  return {
    allowed: true,
    actor: actor as AuthenticatedUser,
  };
}

export async function requirePlatformSuperAdmin(
  request: NextRequest,
): Promise<PlatformSuperAdminGuardResult> {
  const actor = await verifyAuth(request);
  return decidePlatformSuperAdminAccess(actor);
}