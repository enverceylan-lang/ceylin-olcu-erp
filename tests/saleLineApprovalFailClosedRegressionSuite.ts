import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { ensureMainOperationW1 } from "../src/lib/mainOperationW1";

// Focused API route behavior tests. External contract/RPC behavior is mocked:
// passing these tests does NOT prove real database transaction semantics.
const routePath = "src/app/api/sales/authority/approve/route.ts";
const sqlPath = "docs/sql/20261009_sale_line_source_authority_v1.sql";
const runtimePath = "src/lib/salesAuthorityRuntimeClient.ts";
const listPath = "src/app/satis/page.tsx";
const detailPath = "src/app/satis/[id]/page.tsx";
for (const f of [routePath, sqlPath, runtimePath, listPath, detailPath]) {
  assert.ok(fs.existsSync(f), `Missing source: ${f}`);
}
const source = fs.readFileSync(routePath, "utf8");
const sql = fs.readFileSync(sqlPath, "utf8");
const scope = { tenantId: "t", companyId: "c", branchId: "b", accountingPeriodId: "p" };
const canonical = { ...scope, saleId: "sale-a", customerId: "customer-a", currency: "TRY", lines: [{ sourceType: "MEASUREMENT", stockItemId: "stock-a", sourceSaleItemId: "item-a", sourceMeasurementIds: ["m-a"] }] };

type JsonRecord = Record<string, unknown>;
type SourceLine = { sourceType: string; stockItemId: string };
type SourcePayload = JsonRecord & { lines: SourceLine[] };
type RoutePost = (request: { json: () => Promise<unknown> }) => Promise<{ status: number; body: JsonRecord }>;
type Harness = { post: (body: unknown) => Promise<{status: number; body: JsonRecord}>; calls: string[]; };
function harness(opts: { persistError?: string } = {}): Harness {
  const calls: string[] = [];
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mocks: Record<string, unknown> = {
    "next/server": { NextResponse: { json: (body: unknown, cfg: {status: number}) => ({ status: cfg.status, body }) } },
    "@/lib/mainOperationW1": { ensureMainOperationW1 },
    "@/lib/authHelper": { verifyAuth: async () => ({ id: "actor", role: "ADMIN", isActive: true }) },
    "@/lib/salesServerAuthorityContracts": {
      canServerApproveSale: () => true,
      assertSaleAuthorityScope: (b: JsonRecord, s: JsonRecord) => { calls.push("scope"); for(const key of Object.keys(s)) if(b[key] !== s[key]) throw Error("SALE_AUTHORITY_SCOPE_MISMATCH"); },
    },
    "@/lib/salesServerAuthorityGateway": {
      createSalesAuthorityServerClient: () => ({
        rpc: async (name: string, args: JsonRecord) => {
          assert.equal(name, "ensure_approved_main_operation_w1_candidate");
          assert.deepEqual(args, {
            p_tenant_id: "t", p_company_id: "c", p_branch_id: "b",
            p_accounting_period_id: "p", p_sale_id: "sale-a", p_actor_user_id: "actor",
          });
          calls.push("ensure");
          return { data: null, error: { message: "W1_INCOMPLETE_SALE_LINES" } };
        },
      }),
      loadSalesAuthorityContext: async () => ({ ready: true, scope }),
      approveSaleDocumentAuthority: async (_client: unknown, input: JsonRecord) => { assert.equal(input.approvedLineSnapshotVersion, 1); calls.push("approve"); return { outcome: "APPROVED" }; },
    },
    "@/lib/saleLineSourceContracts": {
      assertPersistSaleLineSourceRequestV1: (line: SourcePayload, s: JsonRecord) => {
        calls.push("contract");
        for (const key of Object.keys(s)) if (line[key] !== s[key]) throw Error("SALE_LINE_SOURCE_SCOPE_MISMATCH");
        if (line.lines.some((l: SourceLine) => l.sourceType === "MEASUREMENT" && !l.stockItemId)) throw Error("SALE_LINE_SOURCE_MEASUREMENT_STOCK_REQUIRED");
      },
    },
    "@/lib/saleLineSourceGateway": {
      persistSaleLineSourceSnapshotV1: async () => { calls.push("persist"); if (opts.persistError) throw Error(opts.persistError); return { outcome: "CREATED", sourceVersion: 1 }; },
    },
  };
  const exportsObj: { POST?: RoutePost } = {};
  const context = vm.createContext({ exports: exportsObj, require: (id: string) => { assert.ok(id in mocks, `Unexpected dependency: ${id}`); return mocks[id]; }, Error });
  new vm.Script(compiled, { filename: routePath }).runInContext(context);
  return { calls, post: async (body: unknown) => {
    assert.ok(exportsObj.POST, "Route POST export missing");
    const response = await exportsObj.POST({ json: async () => body });
    return { status: response.status, body: response.body };
  } };
}

async function main() {
  // T01: missing lineSource must reject and never approve.
  { const h=harness(); const r=await h.post({...scope,saleId:"sale-a"}); assert.equal(r.body.error,"SALE_APPROVAL_LINE_SOURCE_REQUIRED"); assert.ok(!h.calls.includes("approve")); }
  // T02: mismatch must reject before persistence/approval.
  { const h=harness(); const r=await h.post({...scope,saleId:"sale-b",lineSource:canonical}); assert.equal(r.body.error,"SALE_APPROVAL_LINE_SOURCE_SALE_MISMATCH"); assert.ok(!h.calls.includes("persist")); assert.ok(!h.calls.includes("approve")); }
  // T03: route rejects missing measurement stock via its validation dependency.
  { const h=harness(); const r=await h.post({...scope,saleId:"sale-a",lineSource:{...canonical,lines:[{...canonical.lines[0],stockItemId:""}]}}); assert.equal(r.body.error,"SALE_LINE_SOURCE_MEASUREMENT_STOCK_REQUIRED"); assert.ok(!h.calls.includes("approve")); }
  // T04: persistence exception must prevent approval.
  { const h=harness({persistError:"REMOTE_ERROR"}); const r=await h.post({...scope,saleId:"sale-a",lineSource:canonical}); assert.equal(r.body.error,"REMOTE_ERROR"); assert.deepEqual(h.calls,["scope","contract","persist"]); }
  // T05: persistence resolves before approval is invoked.
  { const h=harness(); const r=await h.post({...scope,saleId:"sale-a",lineSource:canonical}); assert.equal(r.body.success,true); assert.deepEqual(h.calls,["scope","contract","persist","approve","ensure"]); assert.equal(JSON.stringify(r.body.mainOperation), JSON.stringify({ok:false,error:"W1_INCOMPLETE_SALE_LINES"})); }
  // T08: request or embedded source scope mismatch must fail closed.
  { const h=harness(); const r=await h.post({...scope,companyId:"foreign",saleId:"sale-a",lineSource:canonical}); assert.equal(r.body.success,false); assert.ok(!h.calls.includes("approve")); }
  { const h=harness(); const r=await h.post({...scope,saleId:"sale-a",lineSource:{...canonical,companyId:"foreign"}}); assert.equal(r.body.success,false); assert.ok(!h.calls.includes("approve")); }
  // T06/T07/T09: SQL source contract assertions only (not live DB behavioral proof).
  assert.match(sql,/if v_existing\.payload = p_source then[\s\S]*?'outcome','IDEMPOTENT'/);
  assert.match(sql,/if v_sale\.status='ONAYLANDI' then\s*raise exception 'SALE_LINE_SOURCE_APPROVED_IMMUTABLE'/);
  assert.match(sql,/if v_sale\.customer_id is distinct from v_customer_id then\s*raise exception 'SALE_LINE_SOURCE_CUSTOMER_MISMATCH'/);
  assert.match(sql,/v_source_sale_item_id = any\(v_seen_ids\)/);
  assert.match(sql,/primary key \(\s*tenant_id, company_id, branch_id, accounting_period_id,\s*sale_id, source_version, source_sale_item_id/);
  // T10: both callers must send full Sale to the canonical runtime producer.
  const runtime=fs.readFileSync(runtimePath,"utf8");
  assert.match(runtime,/buildApprovedSaleLineSourcePayloadV1\(\{\s*sale: input\.sale,[\s\S]*scope: input\.scope/);
  assert.match(runtime,/saleId: input\.sale\.id,\s*lineSource/);
  for(const p of [listPath,detailPath]) assert.match(fs.readFileSync(p,"utf8"),/approveSaleServerAuthority\(\{\s*sale[,:]/,`Full Sale caller missing: ${p}`);
  console.log("PAK: targeted route mocked behavior + SQL source structural checks; live DB semantics NOT PROVEN");
}
main().catch(err=> {console.error(err);process.exitCode=1;});
