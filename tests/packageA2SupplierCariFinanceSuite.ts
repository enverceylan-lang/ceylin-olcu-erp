import assert from "node:assert/strict";
import test from "node:test";
import {
  useCounterpartyPayableStore
} from "../src/store/useCounterpartyPayableStore";
import {
  useSupplyChainStore
} from "../src/store/useSupplyChainStore";
import {
  registerSupplierReceiptPayable
} from "../src/lib/supplierReceiptPayableBridge";
import type {
  SupplierOrder,
  SupplierReceipt
} from "../src/lib/supplierSupplyFlow";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId:
    "period-1"
};

function order():
  SupplierOrder {
  return {
    ...scope,
    id:
      "supplier-order-1",
    idempotencyKey:
      "SUPPLIER_ORDER:supplier-order-1",
    allocationId:
      "allocation-1",
    supplierId:
      "supplier-cari-1",
    purchaseOrderId:
      "po-1",
    saleId:
      "sale-1",
    saleItemId:
      "sale-item-1",
    productionOrderId:
      "production-1",
    stockItemId:
      "stock-1",
    orderedQuantity: 10,
    orderedUnit:
      "mt",
    purpose:
      "TAILOR_MATERIAL",
    createdByUserId:
      "admin-1",
    createdAt:
      "2026-08-05T08:00:00.000Z",
    status:
      "PARTIALLY_RECEIVED",
    receivedQuantity: 4
  };
}

function receipt(
  id: string,
  quantity: number,
  at: string
):
  SupplierReceipt {
  return {
    ...scope,
    id,
    idempotencyKey:
      `RECEIPT:${id}`,
    supplierOrderId:
      "supplier-order-1",
    receivedQuantity:
      quantity,
    receivedByUserId:
      "admin-1",
    receivedAt:
      at,
    cumulativeReceivedQuantity:
      quantity,
    orderStatus:
      "PARTIALLY_RECEIVED"
  };
}

function reset() {
  useSupplyChainStore.setState({
    lots: [],
    reservations: [],
    supplierOrders: [],
    supplierReceipts: [],
    purchaseDocuments: [],
    tradeOrderLinks: [],
    cutCompletions: []
  });

  useCounterpartyPayableStore
    .setState({
      movements: []
    });
}

test(
  "partial supplier receipt creates payable only for received quantity using document price snapshot",
  () => {
    reset();

    const result =
      registerSupplierReceiptPayable({
        order:
          order(),
        receipt:
          receipt(
            "receipt-1",
            4,
            "2026-08-05T10:00:00.000Z"
          ),
        supplierName:
          "Tedarikçi A",
        unitPrice: 100,
        purchaseVatRate: 20,
        stockCode:
          "ST-1",
        stockName:
          "Ürün 1",
        createdByUserId:
          "admin-1"
      });

    assert.equal(
      result.outcome,
      "CREATED"
    );

    if (
      result.outcome !==
      "CREATED"
    ) {
      return;
    }

    assert.equal(
      result.payableAmount,
      480
    );

    const movement =
      useCounterpartyPayableStore
        .getState()
        .movements[0];

    assert.equal(
      movement.counterpartyCustomerId,
      "supplier-cari-1"
    );

    assert.equal(
      movement.counterpartyType,
      "SUPPLIER"
    );

    assert.equal(
      movement.amount,
      480
    );

    assert.equal(
      movement.occurredAt,
      "2026-08-05T10:00:00.000Z"
    );
  }
);

test(
  "same supplier receipt is idempotent",
  () => {
    reset();

    const input = {
      order:
        order(),
      receipt:
        receipt(
          "receipt-1",
          4,
          "2026-08-05T10:00:00.000Z"
        ),
      supplierName:
        "Tedarikçi A",
      unitPrice: 100,
      purchaseVatRate: 20,
      createdByUserId:
        "admin-1"
    };

    const first =
      registerSupplierReceiptPayable(
        input
      );

    assert.equal(
      first.outcome,
      "CREATED"
    );

    const replay =
      registerSupplierReceiptPayable(
        input
      );

    assert.equal(
      replay.outcome,
      "REPLAY"
    );

    assert.equal(
      useCounterpartyPayableStore
        .getState()
        .movements.length,
      1
    );
  }
);

test(
  "invalid price cannot create supplier debt",
  () => {
    reset();

    const result =
      registerSupplierReceiptPayable({
        order:
          order(),
        receipt:
          receipt(
            "receipt-1",
            4,
            "2026-08-05T10:00:00.000Z"
          ),
        supplierName:
          "Tedarikçi A",
        unitPrice: 0,
        purchaseVatRate: 20,
        createdByUserId:
          "admin-1"
      });

    assert.deepEqual(
      result,
      {
        outcome:
          "REJECTED",
        reason:
          "INVALID_UNIT_PRICE"
      }
    );

    assert.equal(
      useCounterpartyPayableStore
        .getState()
        .movements.length,
      0
    );
  }
);
test(
  "supplier payment and reversal preserve supplier identity and derived balance",
  () => {
    reset();

    const accrual =
      registerSupplierReceiptPayable({
        order:
          order(),
        receipt:
          receipt(
            "receipt-payment-1",
            4,
            "2026-08-05T10:00:00.000Z"
          ),
        supplierName:
          "Tedarikçi A",
        unitPrice: 100,
        purchaseVatRate: 20,
        createdByUserId:
          "admin-1"
      });

    assert.equal(
      accrual.outcome,
      "CREATED"
    );

    if (
      accrual.outcome !==
      "CREATED"
    ) {
      return;
    }

    const payment =
      useCounterpartyPayableStore
        .getState()
        .registerPayment({
          ...scope,
          id:
            "supplier-payment-movement-1",
          idempotencyKey:
            "SUPPLIER_PAYMENT:supplier-payment-1",
          counterpartyCustomerId:
            "supplier-cari-1",
          counterpartyType:
            "SUPPLIER",
          amount: 200,
          currency:
            "TRY",
          occurredAt:
            "2026-08-06T10:00:00.000Z",
          recordedAt:
            "2026-08-06T10:00:00.000Z",
          sourceDocumentId:
            "supplier-payment-document-1",
          sourcePaymentId:
            "supplier-payment-1"
        });

    assert.equal(
      payment.outcome,
      "CREATED"
    );

    assert.equal(
      useCounterpartyPayableStore
        .getState()
        .getBalance(
          scope,
          "supplier-cari-1"
        ),
      280
    );

    if (
      payment.outcome !==
      "CREATED"
    ) {
      return;
    }

    assert.equal(
      payment.movement.counterpartyCustomerId,
      "supplier-cari-1"
    );
    assert.equal(
      payment.movement.counterpartyType,
      "SUPPLIER"
    );
    assert.equal(
      payment.movement.sourcePaymentId,
      "supplier-payment-1"
    );
    assert.equal(
      payment.movement.sourceDocumentId,
      "supplier-payment-document-1"
    );

    const reversal =
      useCounterpartyPayableStore
        .getState()
        .reverseMovement({
          scope,
          sourceMovementId:
            payment.movement.id,
          reversalMovementId:
            "supplier-payment-reversal-1",
          idempotencyKey:
            "SUPPLIER_PAYMENT_REVERSAL:supplier-payment-1",
          occurredAt:
            "2026-08-07T10:00:00.000Z",
          recordedAt:
            "2026-08-07T10:00:00.000Z"
        });

    assert.equal(
      reversal.outcome,
      "CREATED"
    );

    assert.equal(
      useCounterpartyPayableStore
        .getState()
        .getBalance(
          scope,
          "supplier-cari-1"
        ),
      480
    );

    if (
      reversal.outcome !==
      "CREATED"
    ) {
      return;
    }

    assert.equal(
      reversal.movement.counterpartyCustomerId,
      "supplier-cari-1"
    );
    assert.equal(
      reversal.movement.counterpartyType,
      "SUPPLIER"
    );
    assert.equal(
      reversal.movement.reversalOfMovementId,
      payment.movement.id
    );
    assert.equal(
      reversal.movement.sourceDocumentId,
      "supplier-payment-document-1"
    );
  }
);

test(
  "same supplier payment is idempotent",
  () => {
    reset();

    const accrual =
      registerSupplierReceiptPayable({
        order:
          order(),
        receipt:
          receipt(
            "receipt-payment-replay",
            4,
            "2026-08-05T10:00:00.000Z"
          ),
        supplierName:
          "Tedarikçi A",
        unitPrice: 100,
        purchaseVatRate: 20,
        createdByUserId:
          "admin-1"
      });

    assert.equal(
      accrual.outcome,
      "CREATED"
    );

    const request = {
      ...scope,
      id:
        "supplier-payment-replay-movement",
      idempotencyKey:
        "SUPPLIER_PAYMENT:replay",
      counterpartyCustomerId:
        "supplier-cari-1",
      counterpartyType:
        "SUPPLIER" as const,
      amount: 200,
      currency:
        "TRY" as const,
      occurredAt:
        "2026-08-06T10:00:00.000Z",
      recordedAt:
        "2026-08-06T10:00:00.000Z",
      sourceDocumentId:
        "supplier-payment-doc-replay",
      sourcePaymentId:
        "supplier-payment-replay"
    };

    const first =
      useCounterpartyPayableStore
        .getState()
        .registerPayment(
          request
        );

    assert.equal(
      first.outcome,
      "CREATED"
    );

    const replay =
      useCounterpartyPayableStore
        .getState()
        .registerPayment(
          request
        );

    assert.equal(
      replay.outcome,
      "REPLAY"
    );

    assert.equal(
      useCounterpartyPayableStore
        .getState()
        .movements.length,
      2
    );
  }
);

test(
  "supplier overpayment is rejected",
  () => {
    reset();

    const accrual =
      registerSupplierReceiptPayable({
        order:
          order(),
        receipt:
          receipt(
            "receipt-overpayment",
            4,
            "2026-08-05T10:00:00.000Z"
          ),
        supplierName:
          "Tedarikçi A",
        unitPrice: 100,
        purchaseVatRate: 20,
        createdByUserId:
          "admin-1"
      });

    assert.equal(
      accrual.outcome,
      "CREATED"
    );

    const result =
      useCounterpartyPayableStore
        .getState()
        .registerPayment({
          ...scope,
          id:
            "supplier-payment-over",
          idempotencyKey:
            "SUPPLIER_PAYMENT:over",
          counterpartyCustomerId:
            "supplier-cari-1",
          counterpartyType:
            "SUPPLIER",
          amount: 481,
          currency:
            "TRY",
          occurredAt:
            "2026-08-06T10:00:00.000Z",
          recordedAt:
            "2026-08-06T10:00:00.000Z",
          sourceDocumentId:
            "supplier-payment-doc-over",
          sourcePaymentId:
            "supplier-payment-over"
        });

    assert.equal(
      result.outcome,
      "REJECTED"
    );

    if (
      result.outcome ===
      "REJECTED"
    ) {
      assert.equal(
        result.reason,
        "PAYMENT_EXCEEDS_OPEN_AMOUNT"
      );
    }

    assert.equal(
      useCounterpartyPayableStore
        .getState()
        .movements.length,
      1
    );
  }
);

test(
  "supplier payment reversal replays and second key is rejected",
  () => {
    reset();

    const accrual =
      registerSupplierReceiptPayable({
        order:
          order(),
        receipt:
          receipt(
            "receipt-reversal-replay",
            4,
            "2026-08-05T10:00:00.000Z"
          ),
        supplierName:
          "Tedarikçi A",
        unitPrice: 100,
        purchaseVatRate: 20,
        createdByUserId:
          "admin-1"
      });

    assert.equal(
      accrual.outcome,
      "CREATED"
    );

    const payment =
      useCounterpartyPayableStore
        .getState()
        .registerPayment({
          ...scope,
          id:
            "supplier-payment-for-reversal",
          idempotencyKey:
            "SUPPLIER_PAYMENT:for-reversal",
          counterpartyCustomerId:
            "supplier-cari-1",
          counterpartyType:
            "SUPPLIER",
          amount: 200,
          currency:
            "TRY",
          occurredAt:
            "2026-08-06T10:00:00.000Z",
          recordedAt:
            "2026-08-06T10:00:00.000Z",
          sourceDocumentId:
            "supplier-payment-doc-for-reversal",
          sourcePaymentId:
            "supplier-payment-for-reversal"
        });

    assert.equal(
      payment.outcome,
      "CREATED"
    );

    if (
      payment.outcome !==
      "CREATED"
    ) {
      return;
    }

    const request = {
      scope,
      sourceMovementId:
        payment.movement.id,
      reversalMovementId:
        "supplier-reversal-replay-1",
      idempotencyKey:
        "SUPPLIER_REVERSAL:replay",
      occurredAt:
        "2026-08-07T10:00:00.000Z",
      recordedAt:
        "2026-08-07T10:00:00.000Z"
    };

    const first =
      useCounterpartyPayableStore
        .getState()
        .reverseMovement(
          request
        );

    assert.equal(
      first.outcome,
      "CREATED"
    );

    const replay =
      useCounterpartyPayableStore
        .getState()
        .reverseMovement(
          request
        );

    assert.equal(
      replay.outcome,
      "REPLAY"
    );

    const conflict =
      useCounterpartyPayableStore
        .getState()
        .reverseMovement({
          ...request,
          reversalMovementId:
            "supplier-reversal-replay-2",
          idempotencyKey:
            "SUPPLIER_REVERSAL:different-key"
        });

    assert.equal(
      conflict.outcome,
      "REJECTED"
    );

    if (
      conflict.outcome ===
      "REJECTED"
    ) {
      assert.equal(
        conflict.reason,
        "ALREADY_REVERSED"
      );
    }
  }
);

test(
  "supplier reversal fails closed across scope",
  () => {
    reset();

    const accrual =
      registerSupplierReceiptPayable({
        order:
          order(),
        receipt:
          receipt(
            "receipt-scope-reversal",
            4,
            "2026-08-05T10:00:00.000Z"
          ),
        supplierName:
          "Tedarikçi A",
        unitPrice: 100,
        purchaseVatRate: 20,
        createdByUserId:
          "admin-1"
      });

    assert.equal(
      accrual.outcome,
      "CREATED"
    );

    const payment =
      useCounterpartyPayableStore
        .getState()
        .registerPayment({
          ...scope,
          id:
            "supplier-payment-scope",
          idempotencyKey:
            "SUPPLIER_PAYMENT:scope",
          counterpartyCustomerId:
            "supplier-cari-1",
          counterpartyType:
            "SUPPLIER",
          amount: 200,
          currency:
            "TRY",
          occurredAt:
            "2026-08-06T10:00:00.000Z",
          recordedAt:
            "2026-08-06T10:00:00.000Z",
          sourceDocumentId:
            "supplier-payment-doc-scope",
          sourcePaymentId:
            "supplier-payment-scope"
        });

    assert.equal(
      payment.outcome,
      "CREATED"
    );

    if (
      payment.outcome !==
      "CREATED"
    ) {
      return;
    }

    const crossScope =
      useCounterpartyPayableStore
        .getState()
        .reverseMovement({
          scope: {
            ...scope,
            companyId:
              "company-2"
          },
          sourceMovementId:
            payment.movement.id,
          reversalMovementId:
            "supplier-reversal-wrong-scope",
          idempotencyKey:
            "SUPPLIER_REVERSAL:wrong-scope",
          occurredAt:
            "2026-08-07T10:00:00.000Z",
          recordedAt:
            "2026-08-07T10:00:00.000Z"
        });

    assert.equal(
      crossScope.outcome,
      "REJECTED"
    );

    if (
      crossScope.outcome ===
      "REJECTED"
    ) {
      assert.equal(
        crossScope.reason,
        "SOURCE_NOT_FOUND"
      );
    }
  }
);