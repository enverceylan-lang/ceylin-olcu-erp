import type {
  BankMovement
} from "@/lib/finance/bankingContracts";
import type {
  FinanceJournalPosting
} from "@/lib/finance/financeJournalContracts";
import {
  createInterBankTransferPlan
} from "@/lib/finance/interBankTransferService";
import {
  localFinanceJournalDb
} from "@/lib/finance/localFinanceJournalDb";
import type {
  InterBankTransferCommand,
  ManualBankOperationCommand
} from "@/lib/finance/manualBankOperationContracts";
import {
  createManualBankOperationPlan
} from "@/lib/finance/manualBankOperationService";

export type BankOperationExecutionStatus =
  | "CREATED"
  | "REPLAY";

export interface BankOperationExecutionResult {
  status: BankOperationExecutionStatus;
  bankMovementIds: string[];
  journalEntryId: string;
}

function sameScope(
  left: {
    tenantId: string;
    companyId: string;
    branchId: string;
    accountingPeriodId: string;
  },
  right: {
    tenantId: string;
    companyId: string;
    branchId: string;
    accountingPeriodId: string;
  }
): boolean {
  return (
    left.tenantId === right.tenantId &&
    left.companyId === right.companyId &&
    left.branchId === right.branchId &&
    left.accountingPeriodId ===
      right.accountingPeriodId
  );
}

function assertPostingIntegrity(
  movements: readonly BankMovement[],
  posting: FinanceJournalPosting
): void {
  if (movements.length === 0) {
    throw new Error(
      "BANK_OPERATION_MOVEMENT_REQUIRED"
    );
  }

  if (posting.lines.length === 0) {
    throw new Error(
      "BANK_OPERATION_JOURNAL_LINES_REQUIRED"
    );
  }

  const movementIds =
    new Set(
      movements.map(
        movement => movement.id
      )
    );

  if (movementIds.size !== movements.length) {
    throw new Error(
      "BANK_OPERATION_MOVEMENT_ID_DUPLICATE"
    );
  }

  const lineIds =
    new Set(
      posting.lines.map(
        line => line.id
      )
    );

  if (lineIds.size !== posting.lines.length) {
    throw new Error(
      "BANK_OPERATION_JOURNAL_LINE_ID_DUPLICATE"
    );
  }

  let totalDebit = 0;
  let totalCredit = 0;

  for (const movement of movements) {
    if (
      !sameScope(
        movement,
        posting.entry
      )
    ) {
      throw new Error(
        "BANK_OPERATION_SCOPE_MISMATCH"
      );
    }

    if (
      movement.currency !==
      posting.entry.currency
    ) {
      throw new Error(
        "BANK_OPERATION_CURRENCY_MISMATCH"
      );
    }

    if (
      movement.sourceDocumentId !==
      posting.entry.sourceDocumentId
    ) {
      throw new Error(
        "BANK_OPERATION_SOURCE_DOCUMENT_MISMATCH"
      );
    }
  }

  for (const line of posting.lines) {
    if (
      line.journalEntryId !==
      posting.entry.id
    ) {
      throw new Error(
        "BANK_OPERATION_JOURNAL_ENTRY_LINK_MISMATCH"
      );
    }

    if (
      !sameScope(
        line,
        posting.entry
      )
    ) {
      throw new Error(
        "BANK_OPERATION_JOURNAL_SCOPE_MISMATCH"
      );
    }

    if (
      line.currency !==
      posting.entry.currency
    ) {
      throw new Error(
        "BANK_OPERATION_JOURNAL_CURRENCY_MISMATCH"
      );
    }

    if (
      line.debitAmount < 0 ||
      line.creditAmount < 0
    ) {
      throw new Error(
        "BANK_OPERATION_NEGATIVE_JOURNAL_AMOUNT"
      );
    }

    if (
      line.debitAmount > 0 &&
      line.creditAmount > 0
    ) {
      throw new Error(
        "BANK_OPERATION_LINE_DOUBLE_SIDED"
      );
    }

    totalDebit += line.debitAmount;
    totalCredit += line.creditAmount;
  }

  const roundedDebit =
    Math.round(totalDebit * 100) / 100;

  const roundedCredit =
    Math.round(totalCredit * 100) / 100;

  if (roundedDebit !== roundedCredit) {
    throw new Error(
      "BANK_OPERATION_JOURNAL_UNBALANCED"
    );
  }
}

export async function postLocalBankOperationAtomically(
  movements: readonly BankMovement[],
  posting: FinanceJournalPosting
): Promise<BankOperationExecutionResult> {
  assertPostingIntegrity(
    movements,
    posting
  );

  return localFinanceJournalDb.transaction(
    "rw",
    localFinanceJournalDb.bankMovements,
    localFinanceJournalDb.entries,
    localFinanceJournalDb.lines,
    async () => {
      const existingByIdempotency =
        await localFinanceJournalDb
          .entries
          .filter(
            entry =>
              entry.idempotencyKey ===
              posting.entry.idempotencyKey
          )
          .first();

      const existingEntryById =
        await localFinanceJournalDb
          .entries
          .get(posting.entry.id);

      const existingMovements =
        await Promise.all(
          movements.map(
            movement =>
              localFinanceJournalDb
                .bankMovements
                .get(movement.id)
          )
        );

      const existingMovementCount =
        existingMovements.filter(
          movement =>
            movement !== undefined
        ).length;

      if (existingByIdempotency) {
        if (
          existingByIdempotency.id !==
          posting.entry.id
        ) {
          throw new Error(
            "BANK_OPERATION_IDEMPOTENCY_CONFLICT"
          );
        }

        if (
          existingMovementCount !==
          movements.length
        ) {
          throw new Error(
            "BANK_OPERATION_PARTIAL_STATE_CONFLICT"
          );
        }

        const existingLines =
          await localFinanceJournalDb
            .lines
            .filter(
              line =>
                line.journalEntryId ===
                posting.entry.id
            )
            .toArray();

        if (
          existingLines.length !==
          posting.lines.length
        ) {
          throw new Error(
            "BANK_OPERATION_REPLAY_LINE_CONFLICT"
          );
        }

        return {
          status: "REPLAY",
          bankMovementIds:
            movements.map(
              movement => movement.id
            ),
          journalEntryId:
            posting.entry.id
        };
      }

      if (existingEntryById) {
        throw new Error(
          "BANK_OPERATION_JOURNAL_ENTRY_CONFLICT"
        );
      }

      if (existingMovementCount > 0) {
        throw new Error(
          "BANK_OPERATION_MOVEMENT_CONFLICT"
        );
      }

      await localFinanceJournalDb
        .entries
        .add(posting.entry);

      await localFinanceJournalDb
        .lines
        .bulkAdd(posting.lines);

      await localFinanceJournalDb
        .bankMovements
        .bulkAdd(
          Array.from(movements)
        );

      return {
        status: "CREATED",
        bankMovementIds:
          movements.map(
            movement => movement.id
          ),
        journalEntryId:
          posting.entry.id
      };
    }
  );
}

export async function executeManualBankOperation(
  command: ManualBankOperationCommand
): Promise<BankOperationExecutionResult> {
  const plan =
    createManualBankOperationPlan(
      command
    );

  return postLocalBankOperationAtomically(
    [plan.bankMovement],
    plan.journalPosting
  );
}

export async function executeInterBankTransfer(
  command: InterBankTransferCommand
): Promise<BankOperationExecutionResult> {
  const plan =
    createInterBankTransferPlan(
      command
    );

  return postLocalBankOperationAtomically(
    [
      plan.sourceMovement,
      plan.destinationMovement
    ],
    plan.journalPosting
  );
}
