"use client";
import { useMemo,useState } from "react";
import type { Sale } from "@/store/salesStore";
import { useStore } from "@/store/useStore";
import { useProductionMaterialStore } from "@/store/useProductionMaterialStore";
import { analyzeProductionSourcePlan } from "@/lib/productionSourceModel";

type OpScope={tenantId:string;companyId:string;branchId:string;accountingPeriodId:string};
type SupplierLite={id:string;name?:string};
export default function ProcurementDecisionPanel({operation,sale,currentUserId,suppliers}:{
  operation:OpScope;sale?:Sale;currentUserId:string;suppliers:SupplierLite[];
}){
  const products=useStore(s=>s.products),plans=useProductionMaterialStore(s=>s.plans);
  const [selected,setSelected]=useState<Record<string,boolean>>({}),[busy,setBusy]=useState(false),[message,setMessage]=useState<string|null>(null);
  const rows=useMemo(()=>{
    if(!sale||sale.status!=="ONAYLANDI")return [];
    return sale.items.flatMap(item=>{
      const stockItemId=String(item.stockItemId||"").trim();if(!stockItemId)return [];
      const productionOrderId=["central-production",sale.id,item.id].join("-");
      const plan=plans.find(p=>p.productionItemId===productionOrderId);if(!plan)return [];
      const missing=analyzeProductionSourcePlan(plan).missingQuantity;if(missing<=0.000001)return [];
      const product=products.find(p=>p.id===stockItemId),supplierId=String(product?.defaultSupplierCustomerId||"").trim();
      return [{needId:["procurement-need",sale.id,item.id,stockItemId].join(":"),saleItemId:item.id,stockItemId,supplierId,
        supplierName:suppliers.find(s=>s.id===supplierId)?.name||supplierId,productionOrderId,
        allocationId:["supplier-allocation",sale.id,item.id,stockItemId].join(":"),purpose:"TAILOR_MATERIAL" as const,
        requiredQuantity:missing,requiredUnit:plan.unit,label:`${item.roomName||""} ${item.windowName||""} — ${item.productType||item.productGroup||stockItemId}`.trim()}];
    });
  },[sale,products,plans,suppliers]);
  const missingSupplier=rows.filter(r=>!r.supplierId).length,chosen=rows.filter(r=>selected[r.needId]);
  async function createOrders(){
    if(!sale||sale.status!=="ONAYLANDI"){setMessage("Yalnız onaylı satış için tedarik kararı verilebilir.");return}
    if(!currentUserId.trim()){setMessage("Aktif kullanıcı bulunamadı.");return}
    if(missingSupplier){setMessage("Eksik tedarikçisi olan stok kartları var. Sistem tahmin ederek devam etmez.");return}
    if(!chosen.length){setMessage("Sipariş verilecek en az bir eksik satır seçin.");return}
    const groups=new Map<string,typeof chosen>();for(const r of chosen)groups.set(r.supplierId,[...(groups.get(r.supplierId)||[]),r]);
    setBusy(true);setMessage(null);
    try{for(const [supplierId,lines] of groups){
      const supplierOrderId=["supplier-order",sale.id,supplierId].join(":");
      const res=await fetch("/api/operations/procurement",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({
        ...operation,action:"CREATE_ORDER",saleId:sale.id,supplierId,supplierOrderId,
        idempotencyKey:["supplier-order",operation.tenantId,operation.companyId,operation.branchId,operation.accountingPeriodId,sale.id,supplierId].join(":"),
        lines:lines.map(r=>({...r,supplierOrderLineId:["supplier-order-line",sale.id,supplierId,r.saleItemId,r.stockItemId].join(":")}))})});
      const body=await res.json().catch(()=>null);if(!res.ok||!body?.success)throw new Error(String(body?.error||`PROCUREMENT_HTTP_${res.status}`));
    }setSelected({});setMessage("Tedarikçi siparişi merkezi olarak kaydedildi. Teslim alınmadan üretim hazır sayılmaz.");
    }catch(e){setMessage(e instanceof Error?e.message:"Tedarikçi siparişi oluşturulamadı.");}finally{setBusy(false)}
  }
  if(!sale||sale.status!=="ONAYLANDI")return null;
  return <section className="mt-4 rounded-xl border border-amber-800/50 bg-amber-950/20 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-amber-200">Tedarik Kararı</h3>
      <p className="mt-1 text-xs text-amber-300/80">Sipariş otomatik oluşmaz. Eksik satırları seçip siz oluşturursunuz.</p></div>
      <button type="button" disabled={busy||!chosen.length||Boolean(missingSupplier)} onClick={createOrders}
        className="min-h-11 rounded-lg bg-amber-500 px-4 text-sm font-bold text-slate-950 disabled:opacity-50">
        {busy?"Oluşturuluyor...":"Tedarikçi Siparişi Oluştur"}</button></div>
    {missingSupplier>0&&<div className="mt-3 rounded-lg border border-red-800 bg-red-950/30 p-3 text-xs text-red-300">
      {missingSupplier} eksik satırda varsayılan tedarikçi yok. DUR — önce stok kartındaki tedarikçiyi belirleyin.</div>}
    <div className="mt-3 space-y-2">{rows.map(r=><label key={r.needId} className="flex gap-3 rounded-lg border border-slate-700 p-3">
      <input type="checkbox" checked={Boolean(selected[r.needId])} onChange={e=>setSelected(p=>({...p,[r.needId]:e.target.checked}))}/>
      <span><b className="block text-sm text-slate-100">{r.label}</b><span className="text-xs text-slate-400">
        Eksik: {r.requiredQuantity} {r.requiredUnit} · Tedarikçi: {r.supplierName||"YOK"}</span></span></label>)}</div>
    {message&&<div className="mt-3 rounded-lg border border-slate-700 p-3 text-xs text-slate-200">{message}</div>}
  </section>;
}