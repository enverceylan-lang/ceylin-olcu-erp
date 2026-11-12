import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { approveSaleDocumentAuthority } from "../src/lib/salesServerAuthorityGateway";

async function run() {
  const scope = { tenantId: "t", companyId: "c", branchId: "b", accountingPeriodId: "p" };
  await approveSaleDocumentAuthority({
    async rpc(name, args) {
      assert.equal(name, "approve_sale_document_authority_v1");
      assert.deepEqual(args.p_scope, { ...scope, approvedLineSnapshotVersion: 4 });
      return { data: { outcome: "APPROVED" }, error: null };
    },
  }, { scope, saleId: "s", actorUserId: "u", allowSelfApproval: false, approvedLineSnapshotVersion: 4 });

  const sql = readFileSync("docs/sql/20261112_w1_approved_snapshot_general.sql", "utf8");
  assert.match(sql, /for update;[\s\S]+?approved_line_snapshot_version=v_snapshot\.source_version/);
  assert.match(sql, /v_snapshot\.sale_document_version is distinct from v_sale\.source_version/);
  assert.match(sql, /v_snapshot\.sale_document_payload_hash is distinct from v_sale\.payload_hash/);
  assert.match(sql, /v_version,v_line_count,p_source,btrim\(p_actor_user_id\),v_sale\.source_version,v_sale\.payload_hash/);
  assert.doesNotMatch(sql, /\bsource_version=v_snapshot\.source_version,\s+updated_at/);
  console.log("W1 snapshot approval gateway and SQL source contract: PAK");
}
void run().catch(error => { console.error(error); process.exitCode = 1; });
