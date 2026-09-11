import type { ErpScope } from "@/lib/erpScope";
export type PayableInstrumentType="CHEQUE"|"NOTE";
export type PayableInstrumentCounterpartyType="SUPPLIER"|"TAILOR"|"INSTALLER";
export interface CreatePayableInstrumentCommand extends ErpScope {
  operationId:string;idempotencyKey:string;instrumentType:PayableInstrumentType;
  counterpartyId:string;counterpartyType:PayableInstrumentCounterpartyType;
  amount:number;currency:string;occurredAt:string;description?:string|null;
  instrument:{instrumentNumber:string;drawerName:string;bankName?:string|null;bankBranch?:string|null;accountNumber?:string|null;issueDate?:string|null;issuePlace?:string|null;guarantorName?:string|null;dueDate:string};
}
export interface TransitionPayableInstrumentCommand extends ErpScope {
  operationId:string;idempotencyKey:string;instrumentId:string;instrumentType:PayableInstrumentType;
  fromState:"ISSUED";toState:"PAID"|"RETURNED"|"CANCELLED";bankAccountId?:string|null;reason?:string|null;occurredAt:string;
}