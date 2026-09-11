"use client";
import {useMemo,useState} from "react";
import type {ErpScope} from "@/lib/erpScope";
import {useAuthStore} from "@/store/useAuthStore";

type Action="SETTLE_TRANSACTION"|"POST_MONTHLY_FEE"|"REFUND_TRANSACTION"|"REVERSE_TRANSACTION";
type Field={key:string;label:string;kind?:"number"|"date"|"datetime"};

const FIELDS:Record<Action,readonly Field[]>={
  SETTLE_TRANSACTION:[
    {key:"transactionId",label:"POS transaction UUID"},
    {key:"scheduleLineId",label:"Settlement schedule line UUID"},
    {key:"amount",label:"Settlement amount",kind:"number"},
    {key:"settlementDate",label:"Settlement date",kind:"date"},
    {key:"description",label:"Description"}
  ],
  POST_MONTHLY_FEE:[
    {key:"contractId",label:"POS contract UUID"},
    {key:"year",label:"Year",kind:"number"},
    {key:"month",label:"Month",kind:"number"},
    {key:"paymentDate",label:"Payment date",kind:"date"},
    {key:"description",label:"Description"}
  ],
  REFUND_TRANSACTION:[
    {key:"originalTransactionId",label:"Original POS transaction UUID"},
    {key:"refundAmount",label:"Refund amount",kind:"number"},
    {key:"refundDate",label:"Refund date",kind:"date"},
    {key:"description",label:"Description"}
  ],
  REVERSE_TRANSACTION:[
    {key:"transactionId",label:"POS transaction UUID"},
    {key:"reversalReason",label:"Reversal reason"},
    {key:"occurredAt",label:"Operation time",kind:"datetime"}
  ]
};

export function PosAdminOperationsWorkspace({scope}:{scope:ErpScope}){
  const token=useAuthStore(s=>s.sessionToken);
  const [action,setAction]=useState<Action>("SETTLE_TRANSACTION");
  const [values,setValues]=useState<Record<string,string>>({});
  const [message,setMessage]=useState("");
  const fields=useMemo(()=>FIELDS[action],[action]);

  function setValue(key:string,value:string){
    setValues(current=>({...current,[key]:value}));
  }

  async function submit(){
    if(!token)return;
    const detail:Record<string,unknown>={};
    for(const field of fields){
      const raw=(values[field.key]||"").trim();
      if(!raw){setMessage(`${field.label} is required.`);return;}
      if(field.kind==="number"){
        const n=Number(raw);
        if(!Number.isFinite(n)){setMessage(`${field.label} is invalid.`);return;}
        detail[field.key]=n;
      }else if(field.kind==="datetime"){
        const d=new Date(raw);
        if(!Number.isFinite(d.getTime())){setMessage(`${field.label} is invalid.`);return;}
        detail[field.key]=d.toISOString();
      }else{
        detail[field.key]=raw;
      }
    }

    const operationId=crypto.randomUUID();
    if(action==="SETTLE_TRANSACTION"){
      detail.settlementId=crypto.randomUUID();
      detail.settlementNumber=`SET-${Date.now()}`;
    }else if(action==="POST_MONTHLY_FEE"){
      detail.monthlyFeeId=crypto.randomUUID();
      detail.feeNumber=`FEE-${Date.now()}`;
    }else if(action==="REFUND_TRANSACTION"){
      detail.refundTransactionId=crypto.randomUUID();
      detail.refundTransactionNumber=`REF-${Date.now()}`;
    }else{
      detail.reversalTransactionId=crypto.randomUUID();
    }

    const key=action==="SETTLE_TRANSACTION"?"settlement":
      action==="POST_MONTHLY_FEE"?"monthlyFee":
      action==="REFUND_TRANSACTION"?"refund":"reversal";

    const posCommand={
      ...scope,
      operationId,
      idempotencyKey:`POS:${action}:${operationId}`,
      action,
      occurredAt:new Date().toISOString(),
      [key]:detail
    };

    const response=await fetch("/api/finance/operations",{
      method:"POST",
      headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},
      body:JSON.stringify({posCommand})
    });
    const body=await response.json().catch(()=>null);
    setMessage(response.ok?"POS operation recorded by canonical authority.":(body?.error||body?.reason||"POS operation failed."));
  }

  return <div className="mt-4 grid gap-3 rounded-xl border p-4">
    <strong>POS Admin Operations</strong>
    <p className="text-xs text-slate-500">Settlement, monthly fee, refund and reversal use the existing canonical POS authority.</p>
    <select className="min-h-10 rounded-lg border px-3" value={action} onChange={e=>{setAction(e.target.value as Action);setValues({});setMessage("");}}>
      <option value="SETTLE_TRANSACTION">POS settlement</option>
      <option value="POST_MONTHLY_FEE">Monthly fixed fee</option>
      <option value="REFUND_TRANSACTION">POS refund</option>
      <option value="REVERSE_TRANSACTION">POS reversal</option>
    </select>
    <div className="grid gap-3 sm:grid-cols-2">
      {fields.map(field=><label key={field.key} className="grid gap-1 text-xs font-semibold">
        {field.label}
        <input
          className="min-h-10 rounded-lg border px-3 text-sm"
          type={field.kind==="date"?"date":field.kind==="datetime"?"datetime-local":field.kind==="number"?"number":"text"}
          value={values[field.key]||""}
          onChange={e=>setValue(field.key,e.target.value)}
        />
      </label>)}
    </div>
    <button type="button" className="min-h-10 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white" onClick={()=>void submit()}>
      Record POS operation
    </button>
    {message?<p className="text-sm">{message}</p>:null}
  </div>;
}