import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function main() {
  const source =
    fs.readFileSync(
      path.join(
        process.cwd(),
        "src/app/api/operations/supplier-receipts/route.ts"
      ),
      "utf8"
    );

  assert.match(
    source,
    /verifyAuth\(request\)/
  );
  assert.match(
    source,
    /SUPPLIER_RECEIPT_ADMIN_REQUIRED/
  );
  assert.match(
    source,
    /loadShadowErpContext/
  );
  assert.match(
    source,
    /context\.scope\.tenantId/
  );
  assert.match(
    source,
    /persist_supplier_receipt_stock_v1/
  );
  assert.match(
    source,
    /SUPABASE_SERVICE_ROLE_KEY/
  );
  assert.match(
    source,
    /hashStablePayload/
  );
  assert.match(
    source,
    /supplierOrderLineId/
  );

  console.log(
    "supplierReceiptStockServerApiRouteContractSuite: PASS"
  );
}

main();