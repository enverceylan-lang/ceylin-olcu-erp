import type { ErpScope } from "./erpScope";
import { validateErpScope } from "./erpScope";

interface ReadyErpContextResponse {
  success: true;
  configured: true;
  context: {
    scope: ErpScope;
  };
}

export async function loadVerifiedClientErpScope(
  sessionToken: string | null | undefined,
): Promise<ErpScope> {
  if (!sessionToken) {
    throw new Error("ERP_CONTEXT_SESSION_REQUIRED");
  }

  const response = await fetch("/api/erp-context", {
    method: "GET",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  });

  const body = await response.json() as
    | ReadyErpContextResponse
    | { success?: boolean; configured?: boolean; reason?: string; error?: string };

  if (
    !response.ok ||
    body.success !== true ||
    body.configured !== true ||
    !("context" in body)
  ) {
    throw new Error(
      ("reason" in body && body.reason) ||
      ("error" in body && body.error) ||
      "ERP_CONTEXT_NOT_READY",
    );
  }

  const validation = validateErpScope(body.context.scope);
  if (!validation.valid) {
    throw new Error(
      `ERP_CONTEXT_SCOPE_INVALID:${validation.missingFields.join(",")}`,
    );
  }

  return body.context.scope;
}