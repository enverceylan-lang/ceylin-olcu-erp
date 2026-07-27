import type { ErpScope } from "@/lib/erpScope";
import { validateErpScope } from "@/lib/erpScope";
import {
  getSaleNetTotal,
  getSalePaidTotal,
  getSaleRemainingBalance,
} from "@/lib/salesFinance";
import type { Sale, SalePayment } from "@/store/salesStore";
import type {
  FinancePaymentMethod,
  FinanceTransaction,
  SaleFinanceProjectionIssue,
  SaleFinanceProjectionResult,
} from "./financeContracts";

export interface ProjectSaleFinanceInput {
  sale: Sale;
  scope: ErpScope;
  currency: string;
  projectionAt: string;
}

const PROJECTION_ACTOR = "SALE_FINANCE_PROJECTION";

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function sourceKey(value: string): string {
  return encodeURIComponent(value);
}

function paymentMethod(method: SalePayment["method"]): FinancePaymentMethod {
  const methods: Record<SalePayment["method"], FinancePaymentMethod> = {
    NAKIT: "CASH",
    KART: "CREDIT_CARD",
    HAVALE: "BANK_TRANSFER",
    EFT: "EFT",
    DIGER: "OTHER",
  };
  return methods[method];
}

function issue(
  code: SaleFinanceProjectionIssue["code"],
  message: string,
  saleId: string | null,
  paymentId: string | null = null,
  expected: number | string | null = null,
  actual: number | string | null = null,
  severity: SaleFinanceProjectionIssue["severity"] = "ERROR",
): SaleFinanceProjectionIssue {
  return {
    code,
    severity,
    message,
    saleId,
    paymentId,
    expected,
    actual,
  };
}

function transactionBase(
  input: ProjectSaleFinanceInput,
  sourceDocumentId: string,
  projectionSource: FinanceTransaction["projectionSource"],
  transactionDate: string,
): Pick<
  FinanceTransaction,
  | keyof ErpScope
  | "customerId"
  | "saleId"
  | "sourceDocumentId"
  | "currency"
  | "transactionDate"
  | "createdBy"
  | "createdAt"
  | "projectionSource"
  | "financeAccountId"
  | "counterAccountId"
  | "commissionAmount"
  | "valueDate"
  | "dueDate"
  | "status"
  | "externalReference"
  | "reversalOfTransactionId"
  | "postedAt"
  | "reversedAt"
  | "archivedAt"
> {
  return {
    ...input.scope,
    customerId: input.sale.customerId,
    saleId: input.sale.id,
    sourceDocumentId,
    currency: input.currency,
    transactionDate,
    createdBy: PROJECTION_ACTOR,
    createdAt: input.projectionAt,
    projectionSource,
    financeAccountId: null,
    counterAccountId: null,
    commissionAmount: 0,
    valueDate: transactionDate,
    dueDate: null,
    status: "POSTED",
    externalReference: null,
    reversalOfTransactionId: null,
    postedAt: input.projectionAt,
    reversedAt: null,
    archivedAt: null,
  };
}

function emptyResult(
  input: ProjectSaleFinanceInput,
  issues: SaleFinanceProjectionIssue[],
): SaleFinanceProjectionResult {
  return {
    saleId: input.sale.id,
    customerId: input.sale.customerId,
    scope: { ...input.scope },
    currency: input.currency,
    projectedAt: input.projectionAt,
    transactions: [],
    summary: {
      saleNetTotal: 0,
      paymentTotal: 0,
      effectivePaidTotal: 0,
      legacyDownPaymentDifference: 0,
      projectedDebit: 0,
      projectedCredit: 0,
      projectedBalance: 0,
      expectedPaidTotal: 0,
      expectedRemainingBalance: 0,
      reconciled: false,
    },
    issues,
  };
}

/**
 * Deterministic IDs:
 * - charge: finance:sale:<encoded-sale-id>:charge
 * - payment: finance:sale:<encoded-sale-id>:payment:<encoded-payment-id>
 * - legacy down payment: finance:sale:<encoded-sale-id>:legacy-down-payment
 *
 * Ordering is charge, real payments sorted by paidAt then id, and finally the
 * optional legacy difference. No random UUID or ambient clock is used.
 */
export function projectSaleFinance(
  input: ProjectSaleFinanceInput,
): SaleFinanceProjectionResult {
  const issues: SaleFinanceProjectionIssue[] = [];
  const saleId = input.sale.id?.trim() || null;
  const customerId = input.sale.customerId?.trim() || null;
  const scopeValidation = validateErpScope(input.scope || {});
  const currency = input.currency?.trim().toUpperCase();
  const projectionTime = new Date(input.projectionAt);

  if (!saleId) {
    issues.push(issue("MISSING_SALE_ID", "Satış kimliği zorunludur.", null));
  }
  if (!customerId) {
    issues.push(
      issue("MISSING_CUSTOMER_ID", "Cari kimliği zorunludur.", saleId),
    );
  }
  if (!scopeValidation.valid) {
    issues.push(
      issue(
        "MISSING_SCOPE",
        `ERP kapsamı eksik: ${scopeValidation.missingFields.join(", ")}`,
        saleId,
        null,
        "tenantId,companyId,branchId,accountingPeriodId",
        scopeValidation.missingFields.join(","),
      ),
    );
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    issues.push(
      issue("INVALID_CURRENCY", "Para birimi üç harfli ISO kodu olmalıdır.", saleId),
    );
  }
  if (Number.isNaN(projectionTime.getTime())) {
    issues.push(
      issue("INVALID_PROJECTION_TIME", "Projection zamanı geçersizdir.", saleId),
    );
  }
  if (issues.length > 0) {
    return emptyResult(input, issues);
  }

  const normalizedInput = { ...input, currency };
  const transactions: FinanceTransaction[] = [];
  const saleNetTotal = getSaleNetTotal(input.sale);
  const rawPayments = [...(input.sale.payments || [])];
  const paymentTotal = roundMoney(
    rawPayments.reduce((total, payment) => total + Number(payment.amount || 0), 0),
  );
  const effectivePaidTotal = getSalePaidTotal(input.sale);
  const legacyDownPaymentDifference = roundMoney(
    Math.max(0, Number(input.sale.downPayment || 0) - paymentTotal),
  );

  if (saleNetTotal > 0) {
    const id = `finance:sale:${sourceKey(input.sale.id)}:charge`;
    transactions.push({
      ...transactionBase(
        normalizedInput,
        input.sale.id,
        "SALE_CHARGE",
        input.sale.createdAt.slice(0, 10),
      ),
      id,
      transactionId: id,
      idempotencyKey: id,
      transactionType: "SALE_CHARGE",
      direction: "DEBIT",
      paymentMethod: null,
      sourceDocumentType: "SALE",
      grossAmount: saleNetTotal,
      netAmount: saleNetTotal,
      description: `Satış borcu: ${input.sale.saleNo}`,
    });
  } else {
    issues.push(
      issue(
        "INVALID_SALE_TOTAL",
        "Net satış tutarı sıfırdan büyük olmalıdır.",
        saleId,
        null,
        "> 0",
        saleNetTotal,
      ),
    );
  }

  const seenPayments = new Map<string, SalePayment>();
  const sortedPayments = rawPayments.sort(
    (left, right) =>
      left.paidAt.localeCompare(right.paidAt) || left.id.localeCompare(right.id),
  );

  for (const payment of sortedPayments) {
    if (!payment.id?.trim()) {
      issues.push(
        issue(
          "MISSING_PAYMENT_ID",
          "Tahsilat kaynak kimliği zorunludur.",
          saleId,
        ),
      );
      continue;
    }
    const previous = seenPayments.get(payment.id);
    if (previous) {
      const samePayload =
        roundMoney(previous.amount) === roundMoney(payment.amount) &&
        previous.paidAt === payment.paidAt &&
        previous.method === payment.method &&
        previous.installmentId === payment.installmentId &&
        previous.note === payment.note &&
        previous.receivedBy === payment.receivedBy;
      issues.push(
        issue(
          samePayload ? "DUPLICATE_PAYMENT_ID" : "PAYMENT_ID_CONFLICT",
          samePayload
            ? "Aynı payment id birden fazla kez bulundu; tekrar projection'a alınmadı."
            : "Aynı payment id farklı payload ile bulundu.",
          saleId,
          payment.id,
        ),
      );
      continue;
    }
    seenPayments.set(payment.id, payment);

    const amount = roundMoney(Number(payment.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      issues.push(
        issue(
          "INVALID_PAYMENT_AMOUNT",
          "Tahsilat tutarı sıfırdan büyük olmalıdır.",
          saleId,
          payment.id,
          "> 0",
          Number.isFinite(amount) ? amount : String(payment.amount),
        ),
      );
      continue;
    }

    const id =
      `finance:sale:${sourceKey(input.sale.id)}:payment:${sourceKey(payment.id)}`;
    transactions.push({
      ...transactionBase(
        normalizedInput,
        payment.id,
        "SALE_PAYMENT",
        payment.paidAt.slice(0, 10),
      ),
      id,
      transactionId: id,
      idempotencyKey: id,
      transactionType: "COLLECTION",
      direction: "CREDIT",
      paymentMethod: paymentMethod(payment.method),
      sourceDocumentType: "SALE_PAYMENT",
      grossAmount: amount,
      netAmount: amount,
      description: payment.note || `Satış tahsilatı: ${input.sale.saleNo}`,
    });
  }

  if (legacyDownPaymentDifference > 0) {
    const id =
      `finance:sale:${sourceKey(input.sale.id)}:legacy-down-payment`;
    transactions.push({
      ...transactionBase(
        normalizedInput,
        input.sale.id,
        "LEGACY_DOWN_PAYMENT",
        input.sale.createdAt.slice(0, 10),
      ),
      id,
      transactionId: id,
      idempotencyKey: id,
      transactionType: "COLLECTION",
      direction: "CREDIT",
      paymentMethod: input.sale.downPaymentMethod
        ? paymentMethod(input.sale.downPaymentMethod)
        : "GENERIC",
      sourceDocumentType: "LEGACY_DOWN_PAYMENT",
      grossAmount: legacyDownPaymentDifference,
      netAmount: legacyDownPaymentDifference,
      description: "Legacy peşinat uyumluluk farkı",
    });
  }

  const projectedDebit = roundMoney(
    transactions
      .filter((transaction) => transaction.direction === "DEBIT")
      .reduce((total, transaction) => total + transaction.netAmount, 0),
  );
  const projectedCredit = roundMoney(
    transactions
      .filter((transaction) => transaction.direction === "CREDIT")
      .reduce((total, transaction) => total + transaction.netAmount, 0),
  );
  const projectedBalance = roundMoney(projectedDebit - projectedCredit);
  const expectedRemainingBalance = getSaleRemainingBalance(input.sale);

  if (projectedDebit !== saleNetTotal) {
    issues.push(
      issue(
        "DEBIT_RECONCILIATION_MISMATCH",
        "Projection borç toplamı net satışla eşleşmiyor.",
        saleId,
        null,
        saleNetTotal,
        projectedDebit,
      ),
    );
  }
  if (projectedCredit !== effectivePaidTotal) {
    issues.push(
      issue(
        "CREDIT_RECONCILIATION_MISMATCH",
        "Projection alacak toplamı tahsil edilen toplamla eşleşmiyor.",
        saleId,
        null,
        effectivePaidTotal,
        projectedCredit,
      ),
    );
  }
  if (projectedBalance !== expectedRemainingBalance) {
    issues.push(
      issue(
        "BALANCE_RECONCILIATION_MISMATCH",
        "Projection bakiyesi hesaplanan satış bakiyesiyle eşleşmiyor.",
        saleId,
        null,
        expectedRemainingBalance,
        projectedBalance,
      ),
    );
  }
  if (roundMoney(input.sale.remainingBalance) !== expectedRemainingBalance) {
    issues.push(
      issue(
        "SALE_REMAINING_BALANCE_DRIFT",
        "Sale.remainingBalance authoritative hesapla eşleşmiyor.",
        saleId,
        null,
        expectedRemainingBalance,
        roundMoney(input.sale.remainingBalance),
        "WARNING",
      ),
    );
  }

  return {
    saleId: input.sale.id,
    customerId: input.sale.customerId,
    scope: { ...input.scope },
    currency,
    projectedAt: input.projectionAt,
    transactions,
    summary: {
      saleNetTotal,
      paymentTotal,
      effectivePaidTotal,
      legacyDownPaymentDifference,
      projectedDebit,
      projectedCredit,
      projectedBalance,
      expectedPaidTotal: effectivePaidTotal,
      expectedRemainingBalance,
      reconciled: !issues.some(
        (entry) =>
          entry.code.endsWith("_RECONCILIATION_MISMATCH") ||
          entry.code === "INVALID_SALE_TOTAL" ||
          entry.code === "MISSING_PAYMENT_ID" ||
          entry.code === "INVALID_PAYMENT_AMOUNT" ||
          entry.code === "PAYMENT_ID_CONFLICT" ||
          entry.code === "DUPLICATE_PAYMENT_ID",
      ),
    },
    issues,
  };
}
