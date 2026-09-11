import type {ErpScope} from "@/lib/erpScope";
import {resolveFinanceChannelPermission} from "./financeChannelPermissions";
import type {CreatePayableInstrumentCommand,TransitionPayableInstrumentCommand} from "./payableInstrumentContracts";
import {validateCreatePayableInstrumentCommand,validateTransitionPayableInstrumentCommand} from "./payableInstrumentPolicy";
const same=(a:ErpScope,b:ErpScope)=>a.tenantId===b.tenantId&&a.companyId===b.companyId&&a.branchId===b.branchId&&a.accountingPeriodId===b.accountingPeriodId;
export function decidePayableInstrumentCreateServerContract(body:unknown,scope:ErpScope){
 if(!body||typeof body!=="object"||Array.isArray(body))return{allowed:false as const,status:400 as const,code:"INVALID_REQUEST"};
 const raw=(body as {payableInstrumentCommand?:unknown}).payableInstrumentCommand;if(!raw||typeof raw!=="object"||Array.isArray(raw))return{allowed:false as const,status:400 as const,code:"FINANCE_PAYABLE_INSTRUMENT_COMMAND_REQUIRED"};
 const command=raw as CreatePayableInstrumentCommand;const v=validateCreatePayableInstrumentCommand(command);if(!v.ok)return{allowed:false as const,status:400 as const,code:v.reason};
 if(!same(command,scope))return{allowed:false as const,status:403 as const,code:"FINANCE_PAYABLE_INSTRUMENT_SCOPE_MISMATCH"};
 const p=resolveFinanceChannelPermission({channel:command.instrumentType,operation:"ISSUE",direction:"CREATE"});if(!p)return{allowed:false as const,status:403 as const,code:"FINANCE_PAYABLE_INSTRUMENT_PERMISSION_MAPPING_MISSING"};
 return{allowed:true as const,command,requestedPermission:p.permission,direction:"CREATE" as const};
}
export function decidePayableInstrumentTransitionServerContract(body:unknown,scope:ErpScope){
 if(!body||typeof body!=="object"||Array.isArray(body))return{allowed:false as const,status:400 as const,code:"INVALID_REQUEST"};
 const raw=(body as {payableInstrumentTransitionCommand?:unknown}).payableInstrumentTransitionCommand;if(!raw||typeof raw!=="object"||Array.isArray(raw))return{allowed:false as const,status:400 as const,code:"FINANCE_PAYABLE_INSTRUMENT_TRANSITION_COMMAND_REQUIRED"};
 const command=raw as TransitionPayableInstrumentCommand;const v=validateTransitionPayableInstrumentCommand(command);if(!v.ok)return{allowed:false as const,status:400 as const,code:v.reason};
 if(!same(command,scope))return{allowed:false as const,status:403 as const,code:"FINANCE_PAYABLE_INSTRUMENT_SCOPE_MISMATCH"};
 const direction:"CREATE"|"REVERSE"=command.toState==="PAID"?"CREATE":"REVERSE";const p=resolveFinanceChannelPermission({channel:command.instrumentType,operation:"ISSUE",direction});if(!p)return{allowed:false as const,status:403 as const,code:"FINANCE_PAYABLE_INSTRUMENT_PERMISSION_MAPPING_MISSING"};
 return{allowed:true as const,command,requestedPermission:p.permission,direction};
}