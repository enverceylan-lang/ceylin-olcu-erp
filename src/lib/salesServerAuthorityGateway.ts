export interface SalesAuthorityRpcClient {
  rpc(
    functionName: string,
    parameters: Record<string, unknown>,
  ): PromiseLike<{
    data: unknown;
    error: { message?: string; code?: string } | null;
  }>;
}

function rpcError(error: {
  message?: string;
  code?: string;
} | null): Error {
  if (!error) return new Error("SALES_AUTHORITY_RPC_FAILED");
  return new Error(
    error.code
      ? `${error.code}:${error.message ?? ""}`
      : error.message || "SALES_AUTHORITY_RPC_FAILED",
  );
}

export async function persistSaleDocumentAuthority(
  client: SalesAuthorityRpcClient,
  input: {
    sale: Record<string, unknown>;
    actorUserId: string;
    payloadHash: string;
  },
): Promise<unknown> {
  const response = await client.rpc(
    "persist_sale_document_authority_v1",
    {
      p_sale: input.sale,
      p_actor_user_id: input.actorUserId,
      p_payload_hash: input.payloadHash,
    },
  );
  if (response.error) throw rpcError(response.error);
  return response.data;
}

export async function approveSaleDocumentAuthority(
  client: SalesAuthorityRpcClient,
  input: {
    scope: ErpScope;
    saleId: string;
    actorUserId: string;
    allowSelfApproval: boolean;
  },
): Promise<unknown> {
  const response = await client.rpc(
    "approve_sale_document_authority_v1",
    {
      p_scope: input.scope,
      p_sale_id: input.saleId,
      p_actor_user_id: input.actorUserId,
      p_allow_self_approval: input.allowSelfApproval,
    },
  );
  if (response.error) throw rpcError(response.error);
  return response.data;
}

export async function persistSaleReturnAuthority(
  client: SalesAuthorityRpcClient,
  input: {
    command: Record<string, unknown>;
    actorUserId: string;
    payloadHash: string;
  },
): Promise<unknown> {
  const response = await client.rpc(
    "persist_sale_return_authority_v1",
    {
      p_command: input.command,
      p_actor_user_id: input.actorUserId,
      p_payload_hash: input.payloadHash,
    },
  );
  if (response.error) throw rpcError(response.error);
  return response.data;
}
import { createClient } from "@supabase/supabase-js";
import type { ErpScope } from "@/lib/erpScope";
import type { NextRequest } from "next/server";
import { readRequestedErpScopeId } from "@/lib/erpActiveScopeCookie";
import { loadShadowErpContext } from "@/lib/serverErpContext";

export function createSalesAuthorityServerClient() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SERVER_CONFIGURATION_MISSING");
  }
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function loadSalesAuthorityContext(
  request: NextRequest,
  client: ReturnType<typeof createSalesAuthorityServerClient>,
  userId: string,
) {
  return loadShadowErpContext(client, userId, {
    requestedScopeId: readRequestedErpScopeId(request),
  });
}