import assert from "node:assert/strict";
import fs from "node:fs";

const helper =
  fs.readFileSync(
    "src/lib/purchaseApprovalRouteAuthority.ts",
    "utf8",
  );
const draft =
  fs.readFileSync(
    "src/app/api/purchases/draft/route.ts",
    "utf8",
  );
const approve =
  fs.readFileSync(
    "src/app/api/purchases/approve/route.ts",
    "utf8",
  );

assert.match(
  helper,
  /verifyAuth/,
);
assert.match(
  helper,
  /PURCHASE_ADMIN_REQUIRED/,
);
assert.match(
  helper,
  /loadShadowErpContext/,
);
assert.match(
  helper,
  /readRequestedErpScopeId/,
);

assert.match(
  draft,
  /buildPurchaseCanonicalDraft/,
);
assert.match(
  draft,
  /hashPurchaseCanonicalDraft/,
);
assert.match(
  draft,
  /persist_purchase_document_draft_v1/,
);

assert.match(
  approve,
  /assertPurchaseApprovalRequest/,
);
assert.match(
  approve,
  /approve_purchase_document_authority_v1/,
);
assert.match(
  approve,
  /expectedDraftPayloadHash/,
);

for (const source of [
  draft,
  approve,
]) {
  assert.doesNotMatch(
    source,
    /registerSupplierReceiptPayable/,
  );
  assert.doesNotMatch(
    source,
    /supplierReceiptId/,
  );
}

console.log(
  "purchaseApprovalApiRouteContractSuite: PASS",
);
