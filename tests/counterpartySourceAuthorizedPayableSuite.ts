import assert from "node:assert/strict";
import test from "node:test";

import type {
  CounterpartyPayableMovement
} from "../src/lib/counterpartyPayableService";

import {
  authorizeCounterpartyAccrualAgainstSourceTruth,
  type CounterpartySourceTruthAuthorizationGateway
} from "../src/lib/finance/counterpartySourceTruthAuthorizationGateway";

const scope = {
  tenantId: "tenant-a",
  companyId: "company-a",
  branchId: "branch-a",
  accountingPeriodId: "period-a"
};

function supplierMovement(): CounterpartyPayableMovement {
  return {
    ...scope,
    id: "movement-supplier-1",
    idempotencyKey: "idem-supplier-1",
    counterpartyCustomerId: "supplier-customer-1",
    counterpartyType: "SUPPLIER",
    kind: "ACCRUAL",
    amount: 1200,
    currency: "TRY",
    occurredAt: "2026-08-05T10:00:00.000Z",
    recordedAt: "2026-08-05T10:00:01.000Z",
    sourceDocumentId: "purchase-document-1",
    supplierReceiptId: "receipt-1"
  };
}

function providerMovement(): CounterpartyPayableMovement {
  return {
    ...scope,
    id: "movement-provider-1",
    idempotencyKey: "idem-provider-1",
    counterpartyCustomerId: "provider-customer-1",
    counterpartyType: "TAILOR",
    kind: "ACCRUAL",
    amount: 750,
    currency: "TRY",
    occurredAt: "2026-08-05T11:00:00.000Z",
    recordedAt: "2026-08-05T11:00:01.000Z",
    sourceDocumentId: "sale-1",
    operationId: "operation-1",
    providerEarningsEntryId: "earning-1"
  };
}

test(
  "supplier accrual accepts exact authoritative source truth",
  async () => {
    const gateway: CounterpartySourceTruthAuthorizationGateway = {
      async readSupplierReceiptSource() {
        return {
          sourceId: "supplier-receipt-source:receipt-1",
          ...scope,
          supplierCustomerId: "supplier-customer-1",
          supplierOrderId: "supplier-order-1",
          receiptId: "receipt-1",
          sourceDocumentId: "purchase-document-1",
          stockItemId: "stock-1",
          receivedQuantity: 10,
          actualPurchaseUnitPrice: 100,
          purchaseVatRate: 20,
          netAmount: 1000,
          payableAmount: 1200,
          currency: "TRY",
          receivedAt: "2026-08-05T10:00:00.000Z",
          recordedAt: "2026-08-05T10:00:00.000Z"
        };
      },
      async readProviderEarningSource() {
        return null;
      }
    };

    assert.deepEqual(
      await authorizeCounterpartyAccrualAgainstSourceTruth(
        supplierMovement(),
        gateway
      ),
      {
        ok: true
      }
    );
  }
);

test(
  "supplier accrual fails closed when authoritative source is missing",
  async () => {
    const gateway: CounterpartySourceTruthAuthorizationGateway = {
      async readSupplierReceiptSource() {
        return null;
      },
      async readProviderEarningSource() {
        return null;
      }
    };

    assert.deepEqual(
      await authorizeCounterpartyAccrualAgainstSourceTruth(
        supplierMovement(),
        gateway
      ),
      {
        ok: false,
        reason: "SOURCE_TRUTH_NOT_FOUND"
      }
    );
  }
);

test(
  "supplier accrual rejects historical payable amount mismatch",
  async () => {
    const movement = supplierMovement();

    const gateway: CounterpartySourceTruthAuthorizationGateway = {
      async readSupplierReceiptSource() {
        return {
          sourceId: "supplier-receipt-source:receipt-1",
          ...scope,
          supplierCustomerId: "supplier-customer-1",
          supplierOrderId: "supplier-order-1",
          receiptId: "receipt-1",
          sourceDocumentId: "purchase-document-1",
          stockItemId: "stock-1",
          receivedQuantity: 10,
          actualPurchaseUnitPrice: 100,
          purchaseVatRate: 20,
          netAmount: 1000,
          payableAmount: 1199,
          currency: "TRY",
          receivedAt: "2026-08-05T10:00:00.000Z",
          recordedAt: "2026-08-05T10:00:00.000Z"
        };
      },
      async readProviderEarningSource() {
        return null;
      }
    };

    assert.deepEqual(
      await authorizeCounterpartyAccrualAgainstSourceTruth(
        movement,
        gateway
      ),
      {
        ok: false,
        reason: "SOURCE_AMOUNT_MISMATCH"
      }
    );
  }
);

test(
  "provider accrual requires EXTERNAL FINALIZED exact source truth",
  async () => {
    const gateway: CounterpartySourceTruthAuthorizationGateway = {
      async readSupplierReceiptSource() {
        return null;
      },
      async readProviderEarningSource() {
        return {
          sourceId: "provider-earning-source:earning-1",
          ...scope,
          providerCustomerId: "provider-customer-1",
          providerType: "TAILOR",
          assignmentType: "EXTERNAL",
          operationId: "operation-1",
          earningsEntryId: "earning-1",
          sourceDocumentId: "sale-1",
          status: "FINALIZED",
          finalizedAmount: 750,
          currency: "TRY",
          occurredAt: "2026-08-05T11:00:00.000Z",
          finalizedAt: "2026-08-05T11:00:00.000Z",
          recordedAt: "2026-08-05T11:00:00.000Z"
        };
      }
    };

    assert.deepEqual(
      await authorizeCounterpartyAccrualAgainstSourceTruth(
        providerMovement(),
        gateway
      ),
      {
        ok: true
      }
    );
  }
);

test(
  "provider accrual rejects INTERNAL source",
  async () => {
    const gateway: CounterpartySourceTruthAuthorizationGateway = {
      async readSupplierReceiptSource() {
        return null;
      },
      async readProviderEarningSource() {
        return {
          sourceId: "provider-earning-source:earning-1",
          ...scope,
          providerCustomerId: "provider-customer-1",
          providerType: "TAILOR",
          assignmentType: "INTERNAL",
          operationId: "operation-1",
          earningsEntryId: "earning-1",
          sourceDocumentId: "sale-1",
          status: "FINALIZED",
          finalizedAmount: 750,
          currency: "TRY",
          occurredAt: "2026-08-05T11:00:00.000Z",
          finalizedAt: "2026-08-05T11:00:00.000Z",
          recordedAt: "2026-08-05T11:00:00.000Z"
        };
      }
    };

    assert.deepEqual(
      await authorizeCounterpartyAccrualAgainstSourceTruth(
        providerMovement(),
        gateway
      ),
      {
        ok: false,
        reason:
          "SOURCE_PROVIDER_ASSIGNMENT_NOT_EXTERNAL"
      }
    );
  }
);

test(
  "PAYMENT bypasses accrual source authorization",
  async () => {
    const movement: CounterpartyPayableMovement = {
      ...supplierMovement(),
      kind: "PAYMENT",
      sourcePaymentId: "payment-1"
    };

    const gateway: CounterpartySourceTruthAuthorizationGateway = {
      async readSupplierReceiptSource() {
        throw new Error("must not read");
      },
      async readProviderEarningSource() {
        throw new Error("must not read");
      }
    };

    assert.deepEqual(
      await authorizeCounterpartyAccrualAgainstSourceTruth(
        movement,
        gateway
      ),
      {
        ok: true
      }
    );
  }
);

test(
  "REVERSAL bypasses accrual source authorization",
  async () => {
    const movement: CounterpartyPayableMovement = {
      ...supplierMovement(),
      kind: "REVERSAL",
      reversalOfMovementId: "movement-old"
    };

    const gateway: CounterpartySourceTruthAuthorizationGateway = {
      async readSupplierReceiptSource() {
        throw new Error("must not read");
      },
      async readProviderEarningSource() {
        throw new Error("must not read");
      }
    };

    assert.deepEqual(
      await authorizeCounterpartyAccrualAgainstSourceTruth(
        movement,
        gateway
      ),
      {
        ok: true
      }
    );
  }
);