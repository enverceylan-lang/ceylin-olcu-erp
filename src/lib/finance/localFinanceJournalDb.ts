import type { CustomerFinanceAllocationRecord } from "@/lib/finance/cashFinancePersistenceContracts";
import type { CashMovement } from "@/lib/finance/cashFinanceContracts";
import Dexie, { type Table } from "dexie";
import type {
  BankMovement
} from "@/lib/finance/bankingContracts";

import type { ErpScope } from "@/lib/erpScope";
import {
  validateErpScope
} from "@/lib/erpScope";
import type {
  FinanceAccount
} from "@/lib/finance/financeContracts";
import type {
  FinanceJournalEntry,
  FinanceJournalLine,
  FinanceJournalPosting,
  FinanceJournalWriteResult
} from "@/lib/finance/financeJournalContracts";

const MONEY_EPSILON = 0.000001;

class LocalFinanceJournalDatabase extends Dexie {
  accounts!: Table<FinanceAccount, string>;
  entries!: Table<FinanceJournalEntry, string>;
  lines!: Table<FinanceJournalLine, string>;
  bankMovements!: Table<BankMovement, string>;

    cashMovements!: Table<CashMovement, string>;
  cashAllocations!: Table<CustomerFinanceAllocationRecord, string>;
constructor() {
    super("CeylinLocalFinanceJournalDb");

    this.version(1).stores({
      accounts:
        "id, code, type, currency, isActive, " +
        "[tenantId+companyId+branchId+accountingPeriodId], " +
        "&[tenantId+companyId+branchId+accountingPeriodId+code]",
      entries:
        "id, journalNo, transactionId, sourceDocumentId, status, " +
        "[tenantId+companyId+branchId+accountingPeriodId], " +
        "&[tenantId+companyId+branchId+accountingPeriodId+idempotencyKey]",
      lines:
        "id, journalEntryId, accountId, customerId, supplierId, chequeNoteId, " +
        "[tenantId+companyId+branchId+accountingPeriodId]"
    });

    this.version(2).stores({
      accounts:
        "id, code, type, currency, isActive, " +
        "[tenantId+companyId+branchId+accountingPeriodId], " +
        "&[tenantId+companyId+branchId+accountingPeriodId+code]",
      entries:
        "id, journalNo, transactionId, sourceDocumentId, status, " +
        "[tenantId+companyId+branchId+accountingPeriodId], " +
        "&[tenantId+companyId+branchId+accountingPeriodId+idempotencyKey]",
      lines:
        "id, journalEntryId, accountId, customerId, supplierId, chequeNoteId, " +
        "[tenantId+companyId+branchId+accountingPeriodId]",
      bankMovements:
        "id, movementNumber, bankAccountId, movementType, direction, status, " +
        "sourceDocumentId, transactionDate, currency, reversalOfMovementId, " +
        "[tenantId+companyId+branchId+accountingPeriodId], " +
        "&[tenantId+companyId+branchId+accountingPeriodId+movementNumber], " +
        "[tenantId+companyId+branchId+accountingPeriodId+bankAccountId+transactionDate]"
    });
    this.version(3).stores({
      accounts:
        "id, code, type, currency, isActive, " +
        "[tenantId+companyId+branchId+accountingPeriodId], " +
        "&[tenantId+companyId+branchId+accountingPeriodId+code]",
      entries:
        "id, journalNo, transactionId, sourceDocumentId, status, " +
        "[tenantId+companyId+branchId+accountingPeriodId], " +
        "&[tenantId+companyId+branchId+accountingPeriodId+idempotencyKey]",
      lines:
        "id, journalEntryId, accountId, customerId, supplierId, chequeNoteId, " +
        "[tenantId+companyId+branchId+accountingPeriodId]",
      bankMovements:
        "id, movementNumber, bankAccountId, movementType, direction, status, " +
        "sourceDocumentId, transactionDate, currency, reversalOfMovementId, " +
        "[tenantId+companyId+branchId+accountingPeriodId], " +
        "&[tenantId+companyId+branchId+accountingPeriodId+movementNumber], " +
        "[tenantId+companyId+branchId+accountingPeriodId+bankAccountId+transactionDate]",
      cashMovements:
        "&id,&[tenantId+companyId+branchId+accountingPeriodId+idempotencyKey],[tenantId+companyId+branchId+accountingPeriodId],cashAccountId,transactionId,sourceDocumentId,customerId,supplierId,saleId,installmentId,transactionDate,status,currency",
      cashAllocations:
        "&id,[tenantId+companyId+branchId+accountingPeriodId],cashMovementId,journalEntryId,customerId,openItemId,saleId,installmentId,currency,createdAt"
    });
  }
}

export const localFinanceJournalDb =
  new LocalFinanceJournalDatabase();

function sameScope(
  left: ErpScope,
  right: ErpScope
): boolean {
  return (
    left.tenantId === right.tenantId &&
    left.companyId === right.companyId &&
    left.branchId === right.branchId &&
    left.accountingPeriodId === right.accountingPeriodId
  );
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function postingFingerprint(
  posting: FinanceJournalPosting
): string {
  return JSON.stringify({
    entry: posting.entry,
    lines: [...posting.lines].sort(
      (left, right) => left.lineNo - right.lineNo
    )
  });
}

function assertValidAccount(
  account: FinanceAccount
): void {
  const scopeValidation = validateErpScope(account);

  if (!scopeValidation.valid) {
    throw new Error(
      `FINANCE_ACCOUNT_SCOPE_REQUIRED:${scopeValidation.missingFields.join(",")}`
    );
  }

  if (!account.id?.trim()) {
    throw new Error("FINANCE_ACCOUNT_ID_REQUIRED");
  }

  if (!account.code?.trim()) {
    throw new Error("FINANCE_ACCOUNT_CODE_REQUIRED");
  }

  if (!account.name?.trim()) {
    throw new Error("FINANCE_ACCOUNT_NAME_REQUIRED");
  }

  if (!account.currency?.trim()) {
    throw new Error("FINANCE_ACCOUNT_CURRENCY_REQUIRED");
  }
}

function assertValidPosting(
  posting: FinanceJournalPosting
): void {
  const { entry, lines } = posting;
  const scopeValidation = validateErpScope(entry);

  if (!scopeValidation.valid) {
    throw new Error(
      `FINANCE_JOURNAL_SCOPE_REQUIRED:${scopeValidation.missingFields.join(",")}`
    );
  }

  if (!entry.id?.trim()) {
    throw new Error("FINANCE_JOURNAL_ID_REQUIRED");
  }

  if (!entry.transactionId?.trim()) {
    throw new Error("FINANCE_JOURNAL_TRANSACTION_ID_REQUIRED");
  }

  if (!entry.idempotencyKey?.trim()) {
    throw new Error("FINANCE_JOURNAL_IDEMPOTENCY_KEY_REQUIRED");
  }

  if (!entry.currency?.trim()) {
    throw new Error("FINANCE_JOURNAL_CURRENCY_REQUIRED");
  }

  if (entry.status !== "POSTED") {
    throw new Error("FINANCE_JOURNAL_STATUS_MUST_BE_POSTED");
  }

  if (!Array.isArray(lines) || lines.length < 2) {
    throw new Error("FINANCE_JOURNAL_MINIMUM_TWO_LINES_REQUIRED");
  }

  const lineIds = new Set<string>();
  const lineNumbers = new Set<number>();
  let debitTotal = 0;
  let creditTotal = 0;

  for (const line of lines) {
    if (!sameScope(entry, line)) {
      throw new Error("FINANCE_JOURNAL_LINE_SCOPE_MISMATCH");
    }

    if (line.journalEntryId !== entry.id) {
      throw new Error("FINANCE_JOURNAL_ENTRY_ID_MISMATCH");
    }

    if (!line.id?.trim() || lineIds.has(line.id)) {
      throw new Error("FINANCE_JOURNAL_LINE_ID_INVALID");
    }

    lineIds.add(line.id);

    if (
      !Number.isInteger(line.lineNo) ||
      line.lineNo <= 0 ||
      lineNumbers.has(line.lineNo)
    ) {
      throw new Error("FINANCE_JOURNAL_LINE_NUMBER_INVALID");
    }

    lineNumbers.add(line.lineNo);

    if (!line.accountId?.trim()) {
      throw new Error("FINANCE_JOURNAL_ACCOUNT_ID_REQUIRED");
    }

    if (line.currency !== entry.currency) {
      throw new Error("FINANCE_JOURNAL_CURRENCY_MISMATCH");
    }

    if (
      !Number.isFinite(line.debitAmount) ||
      !Number.isFinite(line.creditAmount) ||
      line.debitAmount < 0 ||
      line.creditAmount < 0
    ) {
      throw new Error("FINANCE_JOURNAL_AMOUNT_INVALID");
    }

    const hasDebit = line.debitAmount > 0;
    const hasCredit = line.creditAmount > 0;

    if (hasDebit === hasCredit) {
      throw new Error("FINANCE_JOURNAL_LINE_SIDE_INVALID");
    }

    debitTotal += line.debitAmount;
    creditTotal += line.creditAmount;
  }

  if (
    Math.abs(
      roundMoney(debitTotal) -
      roundMoney(creditTotal)
    ) > MONEY_EPSILON
  ) {
    throw new Error("FINANCE_JOURNAL_UNBALANCED");
  }
}

export async function saveLocalFinanceAccount(
  account: FinanceAccount
): Promise<void> {
  assertValidAccount(account);

  await localFinanceJournalDb.accounts.put(account);
}

export async function postLocalFinanceJournal(
  posting: FinanceJournalPosting
): Promise<FinanceJournalWriteResult> {
  assertValidPosting(posting);

  return localFinanceJournalDb.transaction(
    "rw",
    localFinanceJournalDb.accounts,
    localFinanceJournalDb.entries,
    localFinanceJournalDb.lines,
    async () => {
      const existing =
        await localFinanceJournalDb.entries
          .where(
            "[tenantId+companyId+branchId+accountingPeriodId+idempotencyKey]"
          )
          .equals([
            posting.entry.tenantId,
            posting.entry.companyId,
            posting.entry.branchId,
            posting.entry.accountingPeriodId,
            posting.entry.idempotencyKey
          ])
          .first();

      if (existing) {
        const existingLines =
          await localFinanceJournalDb.lines
            .where("journalEntryId")
            .equals(existing.id)
            .toArray();

        const existingPosting = {
          entry: existing,
          lines: existingLines
        };

        if (
          postingFingerprint(existingPosting) !==
          postingFingerprint(posting)
        ) {
          throw new Error(
            "FINANCE_JOURNAL_IDEMPOTENCY_CONFLICT"
          );
        }

        return {
          outcome: "REPLAY",
          posting: existingPosting
        };
      }

      const accountIds = [
        ...new Set(
          posting.lines.map(line => line.accountId)
        )
      ];

      const accounts =
        await localFinanceJournalDb.accounts
          .bulkGet(accountIds);

      for (let index = 0; index < accounts.length; index++) {
        const account = accounts[index];

        if (!account) {
          throw new Error(
            `FINANCE_JOURNAL_ACCOUNT_NOT_FOUND:${accountIds[index]}`
          );
        }

        if (!sameScope(posting.entry, account)) {
          throw new Error(
            "FINANCE_JOURNAL_ACCOUNT_SCOPE_MISMATCH"
          );
        }

        if (!account.isActive) {
          throw new Error(
            "FINANCE_JOURNAL_ACCOUNT_INACTIVE"
          );
        }

        if (account.currency !== posting.entry.currency) {
          throw new Error(
            "FINANCE_JOURNAL_ACCOUNT_CURRENCY_MISMATCH"
          );
        }
      }

      await localFinanceJournalDb.entries.add(
        posting.entry
      );

      await localFinanceJournalDb.lines.bulkAdd(
        posting.lines
      );

      return {
        outcome: "CREATED",
        posting
      };
    }
  );
}

export type LocalBankMovementJournalWriteResult =
  | {
      outcome: "CREATED";
      bankMovement: BankMovement;
      posting: FinanceJournalPosting;
    }
  | {
      outcome: "REPLAY";
      bankMovement: BankMovement;
      posting: FinanceJournalPosting;
    };

function bankMovementFingerprint(
  movement: BankMovement
): string {
  return JSON.stringify(movement);
}

function assertValidBankMovement(
  movement: BankMovement
): void {
  const scopeValidation =
    validateErpScope(movement);

  if (!scopeValidation.valid) {
    throw new Error(
      `BANK_MOVEMENT_SCOPE_REQUIRED:${scopeValidation.missingFields.join(",")}`
    );
  }

  if (!movement.id?.trim()) {
    throw new Error(
      "BANK_MOVEMENT_ID_REQUIRED"
    );
  }

  if (!movement.movementNumber?.trim()) {
    throw new Error(
      "BANK_MOVEMENT_NUMBER_REQUIRED"
    );
  }

  if (!movement.bankAccountId?.trim()) {
    throw new Error(
      "BANK_MOVEMENT_BANK_ACCOUNT_REQUIRED"
    );
  }

  if (!movement.sourceDocumentType?.trim()) {
    throw new Error(
      "BANK_MOVEMENT_SOURCE_TYPE_REQUIRED"
    );
  }

  if (!movement.sourceDocumentId?.trim()) {
    throw new Error(
      "BANK_MOVEMENT_SOURCE_ID_REQUIRED"
    );
  }

  if (!movement.sourceDocumentNumber?.trim()) {
    throw new Error(
      "BANK_MOVEMENT_SOURCE_NUMBER_REQUIRED"
    );
  }

  if (!movement.currency?.trim()) {
    throw new Error(
      "BANK_MOVEMENT_CURRENCY_REQUIRED"
    );
  }

  if (!movement.createdBy?.trim()) {
    throw new Error(
      "BANK_MOVEMENT_CREATED_BY_REQUIRED"
    );
  }

  if (
    Number.isNaN(
      Date.parse(movement.createdAt)
    )
  ) {
    throw new Error(
      "BANK_MOVEMENT_CREATED_AT_INVALID"
    );
  }

  if (
    Number.isNaN(
      Date.parse(
        `${movement.transactionDate}T00:00:00.000Z`
      )
    )
  ) {
    throw new Error(
      "BANK_MOVEMENT_TRANSACTION_DATE_INVALID"
    );
  }

  const amounts = [
    movement.grossAmount,
    movement.feeAmount,
    movement.netAmount
  ];

  if (
    amounts.some(
      amount =>
        !Number.isFinite(amount) ||
        amount < 0
    )
  ) {
    throw new Error(
      "BANK_MOVEMENT_AMOUNT_INVALID"
    );
  }
}

function assertBankMovementPostingLink(
  movement: BankMovement,
  posting: FinanceJournalPosting
): void {
  if (!sameScope(movement, posting.entry)) {
    throw new Error(
      "BANK_MOVEMENT_JOURNAL_SCOPE_MISMATCH"
    );
  }

  if (
    movement.currency !==
    posting.entry.currency
  ) {
    throw new Error(
      "BANK_MOVEMENT_JOURNAL_CURRENCY_MISMATCH"
    );
  }

  if (
    movement.sourceDocumentId !==
    posting.entry.sourceDocumentId
  ) {
    throw new Error(
      "BANK_MOVEMENT_JOURNAL_SOURCE_MISMATCH"
    );
  }
}

export async function postLocalBankMovementAndJournal(
  bankMovement: BankMovement,
  posting: FinanceJournalPosting
): Promise<LocalBankMovementJournalWriteResult> {
  assertValidBankMovement(bankMovement);
  assertValidPosting(posting);

  assertBankMovementPostingLink(
    bankMovement,
    posting
  );

  return localFinanceJournalDb.transaction(
    "rw",
    localFinanceJournalDb.accounts,
    localFinanceJournalDb.bankMovements,
    localFinanceJournalDb.entries,
    localFinanceJournalDb.lines,
    async () => {
      const existingEntry =
        await localFinanceJournalDb.entries
          .where(
            "[tenantId+companyId+branchId+accountingPeriodId+idempotencyKey]"
          )
          .equals([
            posting.entry.tenantId,
            posting.entry.companyId,
            posting.entry.branchId,
            posting.entry.accountingPeriodId,
            posting.entry.idempotencyKey
          ])
          .first();

      const existingMovementById =
        await localFinanceJournalDb
          .bankMovements
          .get(bankMovement.id);

      const existingMovementByNumber =
        await localFinanceJournalDb
          .bankMovements
          .where(
            "[tenantId+companyId+branchId+accountingPeriodId+movementNumber]"
          )
          .equals([
            bankMovement.tenantId,
            bankMovement.companyId,
            bankMovement.branchId,
            bankMovement.accountingPeriodId,
            bankMovement.movementNumber
          ])
          .first();

      const replayDetected =
        Boolean(existingEntry) ||
        Boolean(existingMovementById) ||
        Boolean(existingMovementByNumber);

      if (replayDetected) {
        if (
          !existingEntry ||
          !existingMovementById ||
          !existingMovementByNumber
        ) {
          throw new Error(
            "BANK_JOURNAL_ATOMIC_PARTIAL_STATE_CONFLICT"
          );
        }

        if (
          existingMovementById.id !==
          existingMovementByNumber.id
        ) {
          throw new Error(
            "BANK_MOVEMENT_ID_NUMBER_CONFLICT"
          );
        }

        const existingLines =
          await localFinanceJournalDb.lines
            .where("journalEntryId")
            .equals(existingEntry.id)
            .toArray();

        const existingPosting = {
          entry: existingEntry,
          lines: existingLines
        };

        if (
          postingFingerprint(existingPosting) !==
          postingFingerprint(posting)
        ) {
          throw new Error(
            "BANK_JOURNAL_ATOMIC_IDEMPOTENCY_CONFLICT"
          );
        }

        if (
          bankMovementFingerprint(
            existingMovementById
          ) !==
          bankMovementFingerprint(
            bankMovement
          )
        ) {
          throw new Error(
            "BANK_MOVEMENT_IDEMPOTENCY_CONFLICT"
          );
        }

        return {
          outcome: "REPLAY",
          bankMovement:
            existingMovementById,
          posting: existingPosting
        };
      }

      const accountIds = [
        ...new Set(
          posting.lines.map(
            line => line.accountId
          )
        )
      ];

      const accounts =
        await localFinanceJournalDb.accounts
          .bulkGet(accountIds);

      for (
        let index = 0;
        index < accounts.length;
        index++
      ) {
        const account = accounts[index];

        if (!account) {
          throw new Error(
            `FINANCE_JOURNAL_ACCOUNT_NOT_FOUND:${accountIds[index]}`
          );
        }

        if (
          !sameScope(
            posting.entry,
            account
          )
        ) {
          throw new Error(
            "FINANCE_JOURNAL_ACCOUNT_SCOPE_MISMATCH"
          );
        }

        if (!account.isActive) {
          throw new Error(
            "FINANCE_JOURNAL_ACCOUNT_INACTIVE"
          );
        }

        if (
          account.currency !==
          posting.entry.currency
        ) {
          throw new Error(
            "FINANCE_JOURNAL_ACCOUNT_CURRENCY_MISMATCH"
          );
        }
      }

      await localFinanceJournalDb
        .bankMovements
        .add(bankMovement);

      await localFinanceJournalDb.entries.add(
        posting.entry
      );

      await localFinanceJournalDb.lines.bulkAdd(
        posting.lines
      );

      return {
        outcome: "CREATED",
        bankMovement,
        posting
      };
    }
  );
}
export async function listLocalFinanceJournalEntries(
  scope: ErpScope
): Promise<FinanceJournalEntry[]> {
  const validation = validateErpScope(scope);

  if (!validation.valid) {
    throw new Error(
      `FINANCE_JOURNAL_SCOPE_REQUIRED:${validation.missingFields.join(",")}`
    );
  }

  return localFinanceJournalDb.entries
    .where(
      "[tenantId+companyId+branchId+accountingPeriodId]"
    )
    .equals([
      scope.tenantId,
      scope.companyId,
      scope.branchId,
      scope.accountingPeriodId
    ])
    .toArray();
}

export async function listLocalFinanceJournalLines(
  scope: ErpScope,
  journalEntryId: string
): Promise<FinanceJournalLine[]> {
  const validation = validateErpScope(scope);

  if (!validation.valid) {
    throw new Error(
      `FINANCE_JOURNAL_SCOPE_REQUIRED:${validation.missingFields.join(",")}`
    );
  }

  const lines =
    await localFinanceJournalDb.lines
      .where("journalEntryId")
      .equals(journalEntryId)
      .toArray();

  return lines.filter(line => sameScope(line, scope));
}
