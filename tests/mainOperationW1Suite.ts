import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ensureMainOperationW1, mergeMainOperationsW1, readMainOperationsW1 } from "../src/lib/mainOperationW1";
import type { OperationRecord } from "../src/lib/operationsWorkflow";
import type { SalesAuthorityRpcClient } from "../src/lib/salesServerAuthorityGateway";

async function run() {
  const scope = { tenantId: "t", companyId: "c", branchId: "b", accountingPeriodId: "p" };
  const time = "2026-11-11T10:00:00Z";
  const record: OperationRecord = {
    ...scope, id: "general-operation:s", idempotencyKey: "GENERAL:s", kind: "GENERAL",
    sourceId: "s", saleId: "s", customerId: "c1", customerName: "Customer", title: "General",
    details: [], scheduledAt: time, dueAt: time, createdAt: time, updatedAt: time,
    createdByUserId: "actor", status: "DRAFT",
  };
  let failure: string | null = "W1_INCOMPLETE_SALE_LINES";
  let persisted: OperationRecord | undefined;
  const client: SalesAuthorityRpcClient = { async rpc(name, args) {
    assert.equal(args.p_tenant_id, "t");
    assert.equal(args.p_company_id, "c");
    assert.equal(args.p_branch_id, "b");
    assert.equal(args.p_accounting_period_id, "p");
    if (name === "read_main_operations_w1_candidate") {
      assert.equal(args.p_limit, 200);
      return { data: persisted ? [{ operation_payload: persisted }] : [], error: null };
    }
    assert.equal(name, "ensure_approved_main_operation_w1_candidate");
    assert.equal(args.p_sale_id, "s");
    assert.equal(args.p_actor_user_id, "actor");
    if (failure) return { data: null, error: { message: failure } };
    persisted ??= record;
    return { data: { operation_payload: persisted }, error: null };
  } };
  assert.deepEqual(await ensureMainOperationW1(client, scope, "s", "actor"),
    { ok: false, error: "W1_INCOMPLETE_SALE_LINES" });
  failure = "W1_SOURCE_VERSION_MISMATCH";
  assert.deepEqual(await ensureMainOperationW1(client, scope, "s", "actor"),
    { ok: false, error: "W1_SOURCE_VERSION_MISMATCH" });
  failure = "W1_PAYLOAD_HASH_MISMATCH";
  assert.deepEqual(await ensureMainOperationW1(client, scope, "s", "actor"),
    { ok: false, error: "W1_PAYLOAD_HASH_MISMATCH" });
  assert.deepEqual(await readMainOperationsW1(client, scope), []);
  failure = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    assert.deepEqual(await ensureMainOperationW1(client, scope, "s", "actor"), { ok: true, operation: record });
  }
  const central = await readMainOperationsW1(client, scope);
  assert.deepEqual(mergeMainOperationsW1([], central, scope), { added: [record], review: [] });
  const local: OperationRecord = { ...record, status: "IN_PROGRESS", notes: "keep", dueAt: "2026-11-12T10:00:00Z" };
  const child: OperationRecord = { ...record, id: "child", kind: "TAILOR", parentOperationId: local.id };
  assert.deepEqual(mergeMainOperationsW1([local, child], central, scope), { added: [], review: [] });
  assert.equal(local.notes, "keep");
  assert.equal(local.status, "IN_PROGRESS");
  assert.equal(child.parentOperationId, record.id);
  assert.deepEqual(mergeMainOperationsW1([{ ...local, customerId: "conflict" }], central, scope),
    { added: [], review: [record.id] });
  for (const key of Object.keys(scope)) {
    assert.throws(() => mergeMainOperationsW1([], [{ ...record, [key]: "other" }], scope), /SCOPE_MISMATCH/);
  }
  const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const route = source("src/app/api/sales/authority/approve/route.ts");
  assert.match(route, /if \(body && "recoverMainOperation" in body[\s\S]+?return json\(\{ success: true, mainOperation \}\);[\s\S]+?await persistSaleLineSourceSnapshotV1/);
  assert.match(route, /await approveSaleDocumentAuthority[\s\S]+?await ensureMainOperationW1[\s\S]+?lineSourceResult,\s+mainOperation,/);
  for (const path of ["src/app/satis/page.tsx", "src/app/satis/[id]/page.tsx"]) {
    const page = source(path);
    const flow = page.slice(page.indexOf("const approval = await approveSaleServerAuthority"));
    assert.match(flow, /if \(approval\.replay\) \{[^}]+return;\s+\}/);
    assert.ok(flow.indexOf("if (approval.replay)") < flow.indexOf("await updateSaleWithFinanceOutbox"));
    assert.match(flow, /executeSaleApprovalOperations\(\{\s+centralOperationHandled: true/);
  }
  console.log("W1 mock gateway, store merge and recovery wiring: PAK");
}

void run().catch(error => { console.error(error); process.exitCode = 1; });
