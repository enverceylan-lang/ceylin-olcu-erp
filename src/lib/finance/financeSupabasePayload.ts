import type {
  FinanceTransaction
} from "@/lib/finance/financeContracts";
import {
  validateErpScope
} from "@/lib/erpScope";

export interface FinanceSupabaseTransactionRow {
  id: string;
  transaction_id: string;
  idempotency_key: string;

  tenant_id: string;
  company_id: string;
  branch_id: string;
  accounting_period_id: string;

  transaction_type:
    FinanceTransaction["transactionType"];
  direction:
    FinanceTransaction["direction"];
  payment_method:
    FinanceTransaction["paymentMethod"];

  finance_account_id: string | null;
  counter_account_id: string | null;

  customer_id: string;
  sale_id: string;

  source_document_id: string;
  source_document_type:
    FinanceTransaction["sourceDocumentType"];

  gross_amount: number;
  commission_amount: number;
  net_amount: number;

  currency: string;

  transaction_date: string;
  value_date: string | null;
  due_date: string | null;

  status:
    FinanceTransaction["status"];

  description: string | null;
  external_reference: string | null;
  reversal_of_transaction_id: string | null;

  created_by: string;
  created_at: string;
  posted_at: string | null;
  reversed_at: string | null;
  archived_at: string | null;

  projection_source:
    FinanceTransaction["projectionSource"];
}

export interface FinanceSupabaseAuditRow {
  id: string;
  transaction_id: string;
  idempotency_key: string;

  tenant_id: string;
  company_id: string;
  branch_id: string;
  accounting_period_id: string;

  action: "POSTED";
  actor_user_id: string;
  customer_id: string;
  sale_id: string;
  occurred_at: string;

  payload_hash: string;
}

export interface FinanceSupabasePersistencePayload {
  transaction:
    FinanceSupabaseTransactionRow;
  audit:
    FinanceSupabaseAuditRow;
}

function assertNonBlank(
  value: string,
  code: string
): void {
  if (!value.trim()) {
    throw new Error(code);
  }
}

function assertIsoDate(
  value: string,
  code: string
): void {
  const parsed =
    new Date(value);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    throw new Error(code);
  }
}

function stablePayloadText(
  transaction:
    FinanceSupabaseTransactionRow
): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(transaction)
        .sort(
          ([left], [right]) =>
            left.localeCompare(right)
        )
    )
  );
}

function hashText(
  value: string
): string {
  let hash = 2166136261;

  for (
    let index = 0;
    index < value.length;
    index += 1
  ) {
    hash ^=
      value.charCodeAt(index);

    hash =
      Math.imul(
        hash,
        16777619
      );
  }

  return (
    hash >>> 0
  )
    .toString(16)
    .padStart(8, "0");
}

function validateTransaction(
  transaction:
    FinanceTransaction
): void {
  const scopeValidation =
    validateErpScope(transaction);

  if (!scopeValidation.valid) {
    throw new Error(
      `FINANCE_SCOPE_REQUIRED:${scopeValidation.missingFields.join(",")}`
    );
  }

  assertNonBlank(
    transaction.id,
    "FINANCE_ID_REQUIRED"
  );

  assertNonBlank(
    transaction.transactionId,
    "FINANCE_TRANSACTION_ID_REQUIRED"
  );

  assertNonBlank(
    transaction.idempotencyKey,
    "FINANCE_IDEMPOTENCY_KEY_REQUIRED"
  );

  assertNonBlank(
    transaction.customerId,
    "FINANCE_CUSTOMER_ID_REQUIRED"
  );

  assertNonBlank(
    transaction.saleId,
    "FINANCE_SALE_ID_REQUIRED"
  );

  assertNonBlank(
    transaction.sourceDocumentId,
    "FINANCE_SOURCE_DOCUMENT_ID_REQUIRED"
  );

  assertNonBlank(
    transaction.createdBy,
    "FINANCE_CREATED_BY_REQUIRED"
  );

  if (
    !Number.isFinite(
      transaction.grossAmount
    ) ||
    transaction.grossAmount <= 0 ||
    !Number.isFinite(
      transaction.commissionAmount
    ) ||
    transaction.commissionAmount < 0 ||
    !Number.isFinite(
      transaction.netAmount
    ) ||
    transaction.netAmount <= 0 ||
    transaction.netAmount >
      transaction.grossAmount
  ) {
    throw new Error(
      "FINANCE_AMOUNT_INVALID"
    );
  }

  const currency =
    transaction.currency
      .trim()
      .toUpperCase();

  if (
    !/^[A-Z]{3}$/.test(
      currency
    )
  ) {
    throw new Error(
      "FINANCE_CURRENCY_INVALID"
    );
  }

  assertIsoDate(
    transaction.transactionDate,
    "FINANCE_TRANSACTION_DATE_INVALID"
  );

  assertIsoDate(
    transaction.createdAt,
    "FINANCE_CREATED_AT_INVALID"
  );

  if (
    transaction.status !==
    "POSTED"
  ) {
    throw new Error(
      "FINANCE_STATUS_MUST_BE_POSTED"
    );
  }

  if (
    !transaction.postedAt
  ) {
    throw new Error(
      "FINANCE_POSTED_AT_REQUIRED"
    );
  }

  assertIsoDate(
    transaction.postedAt,
    "FINANCE_POSTED_AT_INVALID"
  );
}

export function buildFinanceSupabasePersistencePayload(
  transaction:
    FinanceTransaction
): FinanceSupabasePersistencePayload {
  validateTransaction(
    transaction
  );

  const row:
    FinanceSupabaseTransactionRow = {
    id:
      transaction.id,
    transaction_id:
      transaction.transactionId,
    idempotency_key:
      transaction.idempotencyKey,

    tenant_id:
      transaction.tenantId,
    company_id:
      transaction.companyId,
    branch_id:
      transaction.branchId,
    accounting_period_id:
      transaction.accountingPeriodId,

    transaction_type:
      transaction.transactionType,
    direction:
      transaction.direction,
    payment_method:
      transaction.paymentMethod,

    finance_account_id:
      transaction.financeAccountId,
    counter_account_id:
      transaction.counterAccountId,

    customer_id:
      transaction.customerId,
    sale_id:
      transaction.saleId,

    source_document_id:
      transaction.sourceDocumentId,
    source_document_type:
      transaction.sourceDocumentType,

    gross_amount:
      transaction.grossAmount,
    commission_amount:
      transaction.commissionAmount,
    net_amount:
      transaction.netAmount,

    currency:
      transaction.currency
        .trim()
        .toUpperCase(),

    transaction_date:
      transaction.transactionDate,
    value_date:
      transaction.valueDate,
    due_date:
      transaction.dueDate,

    status:
      transaction.status,

    description:
      transaction.description,
    external_reference:
      transaction.externalReference,
    reversal_of_transaction_id:
      transaction.reversalOfTransactionId,

    created_by:
      transaction.createdBy,
    created_at:
      transaction.createdAt,
    posted_at:
      transaction.postedAt,
    reversed_at:
      transaction.reversedAt,
    archived_at:
      transaction.archivedAt,

    projection_source:
      transaction.projectionSource
  };

  const occurredAt =
    transaction.postedAt;

  if (!occurredAt) {
    throw new Error(
      "FINANCE_POSTED_AT_REQUIRED"
    );
  }

  return {
    transaction:
      row,

    audit: {
      id:
        `audit:${transaction.transactionId}`,

      transaction_id:
        transaction.transactionId,

      idempotency_key:
        transaction.idempotencyKey,

      tenant_id:
        transaction.tenantId,

      company_id:
        transaction.companyId,

      branch_id:
        transaction.branchId,

      accounting_period_id:
        transaction.accountingPeriodId,

      action:
        "POSTED",

      actor_user_id:
        transaction.createdBy,

      customer_id:
        transaction.customerId,

      sale_id:
        transaction.saleId,

      occurred_at:
        occurredAt,

      payload_hash:
        hashText(
          stablePayloadText(row)
        )
    }
  };
}