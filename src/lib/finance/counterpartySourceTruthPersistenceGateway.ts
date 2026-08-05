export type CounterpartySourceTruthPersistStatus =
  | "CREATED"
  | "REPLAY"
  | "CONFLICT"
  | "REJECTED";

export interface CounterpartySourceTruthPersistResult {
  status: CounterpartySourceTruthPersistStatus;
  sourceId?: string;
  reason?: string;
}

export interface SupplierReceiptSourceTruth {
  sourceId: string;

  tenantId: string;
  companyId: string;
  branchId: string;
  accountingPeriodId: string;

  supplierCustomerId: string;
  supplierOrderId: string;
  receiptId: string;
  sourceDocumentId: string;
  stockItemId: string;

  receivedQuantity: number;
  actualPurchaseUnitPrice: number;
  purchaseVatRate: 0 | 1 | 10 | 20;

  netAmount: number;
  payableAmount: number;

  currency: "TRY";

  receivedAt: string;
  recordedAt: string;
}

export interface ProviderEarningSourceTruth {
  sourceId: string;

  tenantId: string;
  companyId: string;
  branchId: string;
  accountingPeriodId: string;

  providerCustomerId: string;
  providerType:
    | "TAILOR"
    | "INSTALLER";

  assignmentType:
    | "EXTERNAL"
    | "INTERNAL";

  operationId: string;
  earningsEntryId: string;
  sourceDocumentId?: string;

  status:
    | "FINALIZED"
    | "PARTIALLY_PAID"
    | "PAID";

  finalizedAmount: number;
  currency: "TRY";

  occurredAt: string;
  finalizedAt: string;
  recordedAt: string;
}

export interface CounterpartySourceTruthActor {
  userId: string;
}

export interface CounterpartySourceTruthPersistenceGateway {
  persistSupplierReceiptSource(
    source: SupplierReceiptSourceTruth,
    actor: CounterpartySourceTruthActor
  ): Promise<CounterpartySourceTruthPersistResult>;

  persistProviderEarningSource(
    source: ProviderEarningSourceTruth,
    actor: CounterpartySourceTruthActor
  ): Promise<CounterpartySourceTruthPersistResult>;
}