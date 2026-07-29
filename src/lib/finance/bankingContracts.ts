import type { ErpScope } from "@/lib/erpScope";

export type BankMovementType =
  | "EFT_IN"
  | "EFT_OUT"
  | "HAVALE_IN"
  | "HAVALE_OUT"
  | "FAST_IN"
  | "FAST_OUT"
  | "POS_SETTLEMENT"
  | "POS_COMMISSION"
  | "BANK_FEE"
  | "INTERNAL_TRANSFER_IN"
  | "INTERNAL_TRANSFER_OUT"
  | "REFUND_IN"
  | "REFUND_OUT"
  | "OTHER_IN"
  | "OTHER_OUT";

export type BankMovementDirection =
  | "IN"
  | "OUT";

export type BankMovementStatus =
  | "PLANNED"
  | "PENDING"
  | "PARTIALLY_SETTLED"
  | "SETTLED"
  | "CANCELLED"
  | "REVERSED";

export interface BankAccount extends ErpScope {
  id: string;
  bankCode: string;
  bankName: string;
  accountName: string;
  branchName: string | null;
  iban: string | null;
  accountNumber: string | null;
  currency: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface BankMovement extends ErpScope {
  id: string;
  movementNumber: string;
  bankAccountId: string;
  movementType: BankMovementType;
  direction: BankMovementDirection;

  sourceModule:
    | "SALES"
    | "FINANCE"
    | "PURCHASE"
    | "SUPPLIER"
    | "TAILOR"
    | "INSTALLATION"
    | "POS"
    | "MANUAL";

  sourceDocumentType: string;
  sourceDocumentId: string;
  sourceDocumentNumber: string;

  customerId: string | null;
  supplierId: string | null;
  tailorId: string | null;
  installerId: string | null;

  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  currency: string;

  transactionDate: string;
  valueDate: string | null;
  settlementDate: string | null;

  status: BankMovementStatus;
  description: string | null;
  externalReference: string | null;

  createdBy: string;
  createdAt: string;
  reversedAt: string | null;
  reversalOfMovementId: string | null;
}

export interface BankMovementReportSummary {
  totalInflow: number;
  totalOutflow: number;
  netMovement: number;

  eftIn: number;
  eftOut: number;

  havaleIn: number;
  havaleOut: number;

  fastIn: number;
  fastOut: number;

  posSettlementIn: number;
  posCommissionOut: number;

  bankFeesOut: number;
  otherIn: number;
  otherOut: number;
}
