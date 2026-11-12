import { erpScopeMatches, type ErpScope } from "./erpScope";
import type { OperationRecord } from "./operationsWorkflow";
import type { SalesAuthorityRpcClient } from "./salesServerAuthorityGateway";

// Existing SECURITY DEFINER RPCs are executable only by service_role.
// Ensure owns the locked sale/version/hash/approval and legacy line checks.
// The snapshot version and the sale document version are not interchangeable.
function parameters(scope: ErpScope) {
  return {
    p_tenant_id: scope.tenantId,
    p_company_id: scope.companyId,
    p_branch_id: scope.branchId,
    p_accounting_period_id: scope.accountingPeriodId,
  };
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("W1_INVALID_OPERATION_PAYLOAD");
  }
  return value as Record<string, unknown>;
}

function operation(value: unknown, scope: ErpScope): OperationRecord {
  const row = object(value);
  const payload = object(row.operation_payload ?? row);
  const record = payload as unknown as OperationRecord;
  if (!erpScopeMatches(record, scope)) throw new Error("W1_OPERATION_SCOPE_MISMATCH");
  if (record.kind !== "GENERAL" || typeof record.saleId !== "string" || !record.saleId.trim() ||
      record.sourceId !== record.saleId || record.id !== `general-operation:${record.saleId}` ||
      record.idempotencyKey !== `GENERAL:${record.saleId}` || record.parentOperationId != null ||
      !["DRAFT", "ASSIGNED", "SENT", "ACCEPTED", "IN_PROGRESS", "COMPLETED", "PROBLEM", "CANCELLED"].includes(record.status) ||
      ![record.customerId, record.customerName, record.title, record.createdByUserId].every(field =>
        typeof field === "string" && field.trim()) ||
      ![record.scheduledAt, record.dueAt, record.createdAt, record.updatedAt].every(field =>
        typeof field === "string" && Number.isFinite(Date.parse(field))) ||
      !Array.isArray(record.details) || !record.details.every(detail => typeof detail === "string")) {
    throw new Error("W1_INVALID_OPERATION_PAYLOAD");
  }
  return record;
}

export type MainOperationW1Result =
  | { ok: true; operation: OperationRecord }
  | { ok: false; error: string };

export async function ensureMainOperationW1(
  client: SalesAuthorityRpcClient, scope: ErpScope, saleId: string, actorUserId: string,
): Promise<MainOperationW1Result> {
  try {
    const { data, error } = await client.rpc("ensure_approved_main_operation_w1_candidate", {
      ...parameters(scope), p_sale_id: saleId, p_actor_user_id: actorUserId,
    });
    if (error) throw new Error(error.message);
    const row = object(data);
    if (!row.operation_payload) throw new Error(typeof row.error === "string" ? row.error : "W1_INVALID_OPERATION_PAYLOAD");
    const record = operation(row, scope);
    if (record.saleId !== saleId) throw new Error("W1_OPERATION_SALE_MISMATCH");
    return { ok: true, operation: record };
  } catch (error) {
    const code = error instanceof Error ? error.message.match(/^W1_[A-Z0-9_]+$/)?.[0] : undefined;
    return { ok: false, error: code ?? "W1_ENSURE_FAILED" };
  }
}

export async function readMainOperationsW1(client: SalesAuthorityRpcClient, scope: ErpScope) {
  const { data, error } = await client.rpc("read_main_operations_w1_candidate", {
    ...parameters(scope), p_limit: 200,
  });
  if (error || !Array.isArray(data)) throw new Error("W1_READ_FAILED");
  const operations = data.map(row => operation(row, scope));
  if (new Set(operations.map(record => record.id)).size !== operations.length) {
    throw new Error("W1_DUPLICATE_OPERATION_ID");
  }
  return operations;
}

export function mergeMainOperationsW1(
  local: OperationRecord[], central: OperationRecord[], scope: ErpScope,
) {
  const added: OperationRecord[] = [];
  const review: string[] = [];
  for (const incoming of central) {
    if (!erpScopeMatches(incoming, scope)) throw new Error("W1_OPERATION_SCOPE_MISMATCH");
    const matches = local.filter(record => erpScopeMatches(record, scope) &&
      (record.id === incoming.id || (record.kind === "GENERAL" && record.saleId === incoming.saleId)));
    if (matches.length > 1 || matches.some(record => record.id !== incoming.id ||
        record.kind !== "GENERAL" || record.saleId !== incoming.saleId ||
        record.sourceId !== incoming.sourceId || record.idempotencyKey !== incoming.idempotencyKey ||
        record.customerId !== incoming.customerId)) {
      review.push(incoming.id);
    } else if (!matches.length) {
      added.push(incoming);
    }
  }
  return { added, review };
}
