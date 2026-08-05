import {
  projectSupplierReceiptSourceTruth
} from "@/lib/finance/counterpartySourceTruthProducerBridge";
import {
  enqueueCounterpartySourceTruthPersistence
} from "@/lib/finance/counterpartySourceTruthOutbox";
import type {
  PurchaseDocument,
  PurchaseTaxRate
} from "@/lib/purchaseContracts";
import type {
  SupplierOrder,
  SupplierReceipt
} from "@/lib/supplierSupplyFlow";
import {
  useCounterpartyPayableStore
} from "@/store/useCounterpartyPayableStore";
import {
  useSupplyChainStore
} from "@/store/useSupplyChainStore";

export type SupplierReceiptPayableResult =
  | {
      outcome:
        "CREATED" |
        "REPLAY";
      purchaseDocument:
        PurchaseDocument;
      payableAmount:
        number;
    }
  | {
      outcome:
        "REJECTED";
      reason:
        | "INVALID_UNIT_PRICE"
        | "INVALID_TAX_RATE"
        | "UNIT_NOT_SUPPORTED"
        | "SUPPLIER_NOT_FOUND"
        | "PURCHASE_DOCUMENT_REJECTED"
        | "PAYABLE_REJECTED";
    };

function allowedTaxRate(
  value: number
): value is PurchaseTaxRate {
  return (
    value === 0 ||
    value === 1 ||
    value === 10 ||
    value === 20
  );
}

function purchaseUnit(
  order:
    SupplierOrder
):
  | "mt"
  | "m2"
  | "adet"
  | null {
  const unit =
    order.orderedUnit ??
    "mt";

  if (
    unit === "mt" ||
    unit === "m2" ||
    unit === "adet"
  ) {
    return unit;
  }

  return null;
}

export function registerSupplierReceiptPayable(
  input: {
    order:
      SupplierOrder;
    receipt:
      SupplierReceipt;
    supplierName:
      string;
    unitPrice:
      number;
    purchaseVatRate:
      number;
    stockCode?:
      string;
    stockName?:
      string;
    createdByUserId:
      string;
  }
): SupplierReceiptPayableResult {
  const {
    order,
    receipt
  } = input;

  if (
    !Number.isFinite(
      input.unitPrice
    ) ||
    input.unitPrice <= 0
  ) {
    return {
      outcome:
        "REJECTED",
      reason:
        "INVALID_UNIT_PRICE"
    };
  }

  if (
    !allowedTaxRate(
      input.purchaseVatRate
    )
  ) {
    return {
      outcome:
        "REJECTED",
      reason:
        "INVALID_TAX_RATE"
    };
  }

  if (
    !order.supplierId.trim() ||
    !input.supplierName.trim()
  ) {
    return {
      outcome:
        "REJECTED",
      reason:
        "SUPPLIER_NOT_FOUND"
    };
  }

  const unit =
    purchaseUnit(order);

  if (!unit) {
    return {
      outcome:
        "REJECTED",
      reason:
        "UNIT_NOT_SUPPORTED"
    };
  }

  const purchaseDocumentId =
    `purchase-receipt:${receipt.id}`;

  const purchase =
    useSupplyChainStore
      .getState()
      .createPurchaseDocument({
        tenantId:
          order.tenantId,
        companyId:
          order.companyId,
        branchId:
          order.branchId,
        accountingPeriodId:
          order.accountingPeriodId,
        id:
          purchaseDocumentId,
        idempotencyKey:
          `PURCHASE_RECEIPT:${receipt.id}`,
        documentNo:
          `TESLIM-${receipt.id}`,
        supplierId:
          order.supplierId,
        supplierName:
          input.supplierName,
        documentDate:
          receipt.receivedAt,
        lines: [
          {
            id:
              `purchase-line:${receipt.id}`,
            kind:
              "GOODS",
            stockItemId:
              order.stockItemId,
            stockCode:
              input.stockCode,
            description:
              input.stockName ||
              order.stockItemId,
            quantity:
              receipt.receivedQuantity,
            unit,
            unitPrice:
              input.unitPrice,
            taxRate:
              input.purchaseVatRate,
            receivedQuantity:
              receipt.receivedQuantity
          }
        ],
        supplierOrderId:
          order.id,
        createdByUserId:
          input.createdByUserId,
        now:
          receipt.receivedAt
      });

  if (
    purchase.outcome ===
    "REJECTED"
  ) {
    return {
      outcome:
        "REJECTED",
      reason:
        "PURCHASE_DOCUMENT_REJECTED"
    };
  }

  const document =
    purchase.value;

  const payableAmount =
    document.totals
      .receivedValue;

  if (
    !Number.isFinite(
      payableAmount
    ) ||
    payableAmount <= 0
  ) {
    return {
      outcome:
        "REJECTED",
      reason:
        "PAYABLE_REJECTED"
    };
  }

  const sourceTruth =
    projectSupplierReceiptSourceTruth({
      tenantId:
        order.tenantId,
      companyId:
        order.companyId,
      branchId:
        order.branchId,
      accountingPeriodId:
        order.accountingPeriodId,

      supplierCustomerId:
        order.supplierId,
      supplierOrderId:
        order.id,
      receiptId:
        receipt.id,
      sourceDocumentId:
        document.id,
      stockItemId:
        order.stockItemId,

      receivedQuantity:
        receipt.receivedQuantity,
      actualPurchaseUnitPrice:
        input.unitPrice,
      purchaseVatRate:
        input.purchaseVatRate,

      receivedAt:
        receipt.receivedAt,
      recordedAt:
        receipt.receivedAt
    });

  if (!sourceTruth.ok) {
    return {
      outcome:
        "REJECTED",
      reason:
        "PAYABLE_REJECTED"
    };
  }

  enqueueCounterpartySourceTruthPersistence({
    kind:
      "SUPPLIER_RECEIPT",
    source:
      sourceTruth.value
  });
  const payable =
    useCounterpartyPayableStore
      .getState()
      .registerAccrual({
        tenantId:
          order.tenantId,
        companyId:
          order.companyId,
        branchId:
          order.branchId,
        accountingPeriodId:
          order.accountingPeriodId,
        id:
          `supplier-payable:${receipt.id}`,
        idempotencyKey:
          `SUPPLIER_PAYABLE:${receipt.id}`,
        counterpartyCustomerId:
          order.supplierId,
        counterpartyType:
          "SUPPLIER",
        kind:
          "ACCRUAL",
        amount:
          payableAmount,
        currency:
          "TRY",
        occurredAt:
          receipt.receivedAt,
        recordedAt:
          receipt.receivedAt,
        sourceDocumentId:
          document.id,
        supplierReceiptId:
          receipt.id,
        operationId:
          document.sourceOperationId,
        note:
          `Tedarikçi teslimi ${order.id}`
      });

  if (
    payable.outcome ===
    "REJECTED"
  ) {
    return {
      outcome:
        "REJECTED",
      reason:
        "PAYABLE_REJECTED"
    };
  }

  return {
    outcome:
      payable.outcome,
    purchaseDocument:
      document,
    payableAmount
  };
}