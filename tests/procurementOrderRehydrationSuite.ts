import assert from "node:assert/strict";
import {attachCentralAllocation,rehydrateCentralProcurementLine} from "../src/lib/procurement/procurementOrderRehydration";
const h=rehydrateCentralProcurementLine({supplierOrderId:"o",saleId:"s",saleItemId:"i",stockItemId:"st",supplierId:"sup",
productionOrderId:"central-production-s-i",allocationId:"a",purpose:"TAILOR_MATERIAL",orderedQuantity:12,orderedUnit:"mt",
receivedQuantity:0,idempotencyKey:"k",createdByUserId:"u",createdAt:"2026-08-22T00:00:00Z",
scope:{tenantId:"t",companyId:"c",branchId:"b",accountingPeriodId:"p"}});
assert.equal(h.order.status,"ORDERED");assert.equal(h.allocation.sourceType,"SUPPLIER_ORDER");
const p={id:"p",productionItemId:"central-production-s-i",requiredQuantity:12,unit:"mt" as const,version:1,allocations:[]};
const a=attachCentralAllocation(p,h);assert.equal(a.version,2);assert.equal(attachCentralAllocation(a,h).allocations.length,1);
console.log("PAK procurement rehydration");