import type {CreatePayableInstrumentCommand,TransitionPayableInstrumentCommand} from "./payableInstrumentContracts";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text=(v:unknown)=>typeof v==="string"&&v.trim().length>0;
const uuid=(v:unknown)=>typeof v==="string"&&UUID.test(v);
const date=(v:unknown)=>typeof v==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(v);
export function validateCreatePayableInstrumentCommand(c:CreatePayableInstrumentCommand){
 if(!text(c.tenantId)||!text(c.companyId)||!text(c.branchId)||!text(c.accountingPeriodId))return{ok:false as const,reason:"FINANCE_PAYABLE_INSTRUMENT_SCOPE_REQUIRED"};
 if(!uuid(c.operationId)||!text(c.idempotencyKey)||!["CHEQUE","NOTE"].includes(c.instrumentType))return{ok:false as const,reason:"FINANCE_PAYABLE_INSTRUMENT_IDENTITY_INVALID"};
 if(!text(c.counterpartyId)||!["SUPPLIER","TAILOR","INSTALLER"].includes(c.counterpartyType))return{ok:false as const,reason:"FINANCE_PAYABLE_INSTRUMENT_COUNTERPARTY_INVALID"};
 if(!Number.isFinite(c.amount)||c.amount<=0||!/^[A-Z]{3}$/.test(c.currency)||!Number.isFinite(Date.parse(c.occurredAt)))return{ok:false as const,reason:"FINANCE_PAYABLE_INSTRUMENT_AMOUNT_DATE_INVALID"};
 if(!text(c.instrument.instrumentNumber)||!text(c.instrument.drawerName)||!date(c.instrument.dueDate)||(c.instrumentType==="CHEQUE"&&!text(c.instrument.bankName)))return{ok:false as const,reason:"FINANCE_PAYABLE_INSTRUMENT_REQUIRED_FIELD_INVALID"};
 return{ok:true as const};
}
export function validateTransitionPayableInstrumentCommand(c:TransitionPayableInstrumentCommand){
 if(!text(c.tenantId)||!text(c.companyId)||!text(c.branchId)||!text(c.accountingPeriodId))return{ok:false as const,reason:"FINANCE_PAYABLE_INSTRUMENT_SCOPE_REQUIRED"};
 if(!uuid(c.operationId)||!uuid(c.instrumentId)||!text(c.idempotencyKey)||c.fromState!=="ISSUED"||!["PAID","RETURNED","CANCELLED"].includes(c.toState))return{ok:false as const,reason:"FINANCE_PAYABLE_INSTRUMENT_TRANSITION_INVALID"};
 if(c.toState==="PAID"&&!uuid(c.bankAccountId))return{ok:false as const,reason:"FINANCE_PAYABLE_INSTRUMENT_BANK_ACCOUNT_REQUIRED"};
 if((c.toState==="RETURNED"||c.toState==="CANCELLED")&&!text(c.reason))return{ok:false as const,reason:"FINANCE_PAYABLE_INSTRUMENT_REASON_REQUIRED"};
 return{ok:true as const};
}