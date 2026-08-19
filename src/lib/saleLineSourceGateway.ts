import type { PersistSaleLineSourceRequestV1 } from "@/lib/saleLineSourceContracts";

export interface SaleLineSourceRpcClientV1 {
  rpc(
    functionName: "persist_sale_line_source_snapshot_v1",
    parameters: { p_source: PersistSaleLineSourceRequestV1; p_actor_user_id: string }
  ): PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }>;
}

export async function persistSaleLineSourceSnapshotV1(
  client: SaleLineSourceRpcClientV1,
  input: { source: PersistSaleLineSourceRequestV1; actorUserId: string }
): Promise<unknown> {
  const actorUserId = String(input.actorUserId || "").trim();
  if (!actorUserId) throw new Error("SALE_LINE_SOURCE_ACTOR_REQUIRED");
  const response = await client.rpc("persist_sale_line_source_snapshot_v1", {
    p_source: input.source,
    p_actor_user_id: actorUserId
  });
  if (response.error) {
    throw new Error(response.error.code
      ? `${response.error.code}:${response.error.message ?? ""}`
      : response.error.message || "SALE_LINE_SOURCE_RPC_FAILED");
  }
  return response.data;
}
