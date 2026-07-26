import type { NextRequest } from "next/server";

export const ERP_ACTIVE_SCOPE_COOKIE = "enverp_active_scope";

export function readRequestedErpScopeId(
  req: NextRequest
): string | null {
  const value = req.cookies.get(ERP_ACTIVE_SCOPE_COOKIE)?.value;
  const cleanValue = String(value || "").trim();
  return cleanValue || null;
}
