import type { ErpScope } from "@/lib/erpScope";
import type { ProductionSourcePlan, ProductionSourceAllocation } from "@/lib/productionSourceModel";
import type { SupplierOrder, SupplierOrderPurpose, SupplierOrderUnit } from "@/lib/supplierSupplyFlow";

const EPSILON = 0.000001;
export interface CentralProcurementLine {
  supplierOrderId:string;saleId:string;saleItemId:string;stockItemId:string;supplierId:string;
  productionOrderId:string;allocationId:string;purpose:SupplierOrderPurpose;
  orderedQuantity:number;orderedUnit:SupplierOrderUnit;receivedQuantity:number;
  idempotencyKey:string;createdByUserId:string;createdAt:string;scope:ErpScope;
}
function txt(v:unknown,c:string){const x=String(v??"").trim();if(!x)throw new Error(c);return x}
export function rehydrateCentralProcurementLine(x:CentralProcurementLine){
  const q=Number(x.orderedQuantity),r=Number(x.receivedQuantity);
  if(!Number.isFinite(q)||q<=0)throw new Error("PROCUREMENT_ORDERED_QUANTITY_INVALID");
  if(!Number.isFinite(r)||r<0||r>q+EPSILON)throw new Error("PROCUREMENT_RECEIVED_QUANTITY_INVALID");
  if(!["mt","m2","adet"].includes(x.orderedUnit))throw new Error("PROCUREMENT_UNIT_INVALID");
  if(x.purpose!=="TAILOR_MATERIAL"&&x.purpose!=="MECHANICAL_PRODUCT")throw new Error("PROCUREMENT_PURPOSE_INVALID");
  const ready=r>=q-EPSILON;
  const order:SupplierOrder={...x.scope,id:txt(x.supplierOrderId,"PROCUREMENT_ORDER_ID_REQUIRED"),
    idempotencyKey:txt(x.idempotencyKey,"PROCUREMENT_IDEMPOTENCY_REQUIRED"),
    allocationId:txt(x.allocationId,"PROCUREMENT_ALLOCATION_REQUIRED"),supplierId:txt(x.supplierId,"PROCUREMENT_SUPPLIER_REQUIRED"),
    purchaseOrderId:x.supplierOrderId,saleId:txt(x.saleId,"PROCUREMENT_SALE_REQUIRED"),
    saleItemId:txt(x.saleItemId,"PROCUREMENT_SALE_ITEM_REQUIRED"),
    productionOrderId:txt(x.productionOrderId,"PROCUREMENT_PRODUCTION_REQUIRED"),
    stockItemId:txt(x.stockItemId,"PROCUREMENT_STOCK_REQUIRED"),orderedQuantity:q,orderedUnit:x.orderedUnit,
    purpose:x.purpose,createdByUserId:txt(x.createdByUserId,"PROCUREMENT_ACTOR_REQUIRED"),
    createdAt:txt(x.createdAt,"PROCUREMENT_CREATED_AT_REQUIRED"),receivedQuantity:r,
    status:ready?(x.purpose==="MECHANICAL_PRODUCT"?"READY_FOR_OPERATION":"READY_FOR_TAILOR"):(r>EPSILON?"PARTIALLY_RECEIVED":"ORDERED")};
  const allocation:ProductionSourceAllocation={id:order.allocationId,productionItemId:order.productionOrderId,
    sourceType:"SUPPLIER_ORDER",quantity:q,unit:x.orderedUnit,status:ready?"READY":"ORDERED",
    supplierId:order.supplierId,supplierOrderId:order.id};
  return {order,allocation};
}
export function attachCentralAllocation(plan:ProductionSourcePlan,input:ReturnType<typeof rehydrateCentralProcurementLine>){
  if(plan.productionItemId!==input.allocation.productionItemId)throw new Error("PROCUREMENT_PRODUCTION_ITEM_MISMATCH");
  const old=plan.allocations.find(a=>a.id===input.allocation.id);
  if(old){
    if(old.sourceType!==input.allocation.sourceType||old.supplierOrderId!==input.allocation.supplierOrderId||
      old.supplierId!==input.allocation.supplierId||old.unit!==input.allocation.unit||
      Math.abs(old.quantity-input.allocation.quantity)>EPSILON)throw new Error("PROCUREMENT_ALLOCATION_REPLAY_CONFLICT");
    return {...plan,allocations:plan.allocations.map(a=>a.id===old.id?{...a,status:input.allocation.status}:a)};
  }
  return {...plan,version:plan.version+1,allocations:[...plan.allocations,input.allocation]};
}