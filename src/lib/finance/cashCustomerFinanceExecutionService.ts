import type {
  CashMovement,
  CashOperationCommand,
  CustomerFinanceAllocationCommand
} from "@/lib/finance/cashFinanceContracts";
import type {
  CustomerFinanceAllocationRecord
} from "@/lib/finance/cashFinancePersistenceContracts";
import {
  createCashOperationPlan
} from "@/lib/finance/cashOperationService";
import {
  createCustomerFinanceAllocationPlan
} from "@/lib/finance/customerFinanceAllocationService";
import type {
  FinanceJournalPosting
} from "@/lib/finance/financeJournalContracts";
import {
  localFinanceJournalDb
} from "@/lib/finance/localFinanceJournalDb";

export type CashFinanceExecutionStatus =
  | "CREATED"
  | "REPLAY";

export interface ExecuteCashCustomerFinanceCommand {
  cashOperation: CashOperationCommand;

  customerAllocation?:
    CustomerFinanceAllocationCommand | null;
}

export interface CashFinanceExecutionResult {
  status: CashFinanceExecutionStatus;

  cashMovementId: string;
  journalEntryId: string;

  allocationRecordIds: string[];
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
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
  movement: CashMovement,
  posting: FinanceJournalPosting
): void {
  if (
    !sameScope(
      movement,
      posting.entry
    )
  ) {
    throw new Error(
      "CASH_FINANCE_SCOPE_MISMATCH"
    );
  }

  if (
    movement.currency !==
    posting.entry.currency
  ) {
    throw new Error(
      "CASH_FINANCE_CURRENCY_MISMATCH"
    );
  }

  if (
    movement.transactionId !==
    posting.entry.transactionId
  ) {
    throw new Error(
      "CASH_FINANCE_TRANSACTION_MISMATCH"
    );
  }

  if (
    movement.idempotencyKey !==
    posting.entry.idempotencyKey
  ) {
    throw new Error(
      "CASH_FINANCE_IDEMPOTENCY_MISMATCH"
    );
  }

  if (
    movement.sourceDocumentId !==
    posting.entry.sourceDocumentId
  ) {
    throw new Error(
      "CASH_FINANCE_SOURCE_DOCUMENT_MISMATCH"
    );
  }

  if (posting.lines.length !== 2) {
    throw new Error(
      "CASH_FINANCE_JOURNAL_LINE_COUNT_INVALID"
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
      "CASH_FINANCE_JOURNAL_LINE_ID_DUPLICATE"
    );
  }

  let totalDebit = 0;
  let totalCredit = 0;

  for (const line of posting.lines) {
    if (
      line.journalEntryId !==
      posting.entry.id
    ) {
      throw new Error(
        "CASH_FINANCE_JOURNAL_LINK_MISMATCH"
      );
    }

    if (
      !sameScope(
        line,
        posting.entry
      )
    ) {
      throw new Error(
        "CASH_FINANCE_JOURNAL_SCOPE_MISMATCH"
      );
    }

    if (
      line.currency !==
      posting.entry.currency
    ) {
      throw new Error(
        "CASH_FINANCE_JOURNAL_CURRENCY_MISMATCH"
      );
    }

    if (
      line.debitAmount < 0 ||
      line.creditAmount < 0
    ) {
      throw new Error(
        "CASH_FINANCE_NEGATIVE_JOURNAL_AMOUNT"
      );
    }

    if (
      line.debitAmount > 0 &&
      line.creditAmount > 0
    ) {
      throw new Error(
        "CASH_FINANCE_DOUBLE_SIDED_LINE"
      );
    }

    totalDebit += line.debitAmount;
    totalCredit += line.creditAmount;
  }

  if (
    roundMoney(totalDebit) !==
    roundMoney(totalCredit)
  ) {
    throw new Error(
      "CASH_FINANCE_JOURNAL_UNBALANCED"
    );
  }
}

function createAllocationRecords(
  movement: CashMovement,
  posting: FinanceJournalPosting,
  allocationCommand:
    CustomerFinanceAllocationCommand | null | undefined
): CustomerFinanceAllocationRecord[] {
  if (!allocationCommand) {
    return [];
  }

  if (
    movement.sourceDocumentType !==
    "CUSTOMER_COLLECTION"
  ) {
    throw new Error(
      "CASH_FINANCE_ALLOCATION_ONLY_FOR_COLLECTION"
    );
  }

  if (
    !sameScope(
      movement,
      allocationCommand
    )
  ) {
    throw new Error(
      "CASH_FINANCE_ALLOCATION_SCOPE_MISMATCH"
    );
  }

  if (
    movement.customerId !==
    allocationCommand.customerId
  ) {
    throw new Error(
      "CASH_FINANCE_ALLOCATION_CUSTOMER_MISMATCH"
    );
  }

  if (
    movement.currency !==
    allocationCommand.currency
  ) {
    throw new Error(
      "CASH_FINANCE_ALLOCATION_CURRENCY_MISMATCH"
    );
  }

  if (
    roundMoney(movement.amount) !==
    roundMoney(allocationCommand.amount)
  ) {
    throw new Error(
      "CASH_FINANCE_ALLOCATION_AMOUNT_MISMATCH"
    );
  }

  const plan =
    createCustomerFinanceAllocationPlan(
      allocationCommand
    );

  if (plan.unappliedAmount !== 0) {
    throw new Error(
      "CASH_FINANCE_UNAPPLIED_AMOUNT_NOT_ALLOWED"
    );
  }

  if (
    plan.allocatedAmount !==
    roundMoney(movement.amount)
  ) {
    throw new Error(
      "CASH_FINANCE_ALLOCATION_TOTAL_MISMATCH"
    );
  }

  return plan.lines.map(
    line => ({
      tenantId: movement.tenantId,
      companyId: movement.companyId,
      branchId: movement.branchId,
      accountingPeriodId:
        movement.accountingPeriodId,

      id:
        movement.id +
        ":allocation:" +
        line.openItemId,

      cashMovementId:
        movement.id,

      journalEntryId:
        posting.entry.id,

      customerId:
        allocationCommand.customerId,

      openItemId:
        line.openItemId,

      saleId:
        line.saleId,

      installmentId:
        line.installmentId,

      documentNumber:
        line.documentNumber,

      dueDate:
        line.dueDate,

      allocatedAmount:
        line.allocatedAmount,

      currency:
        allocationCommand.currency,

      createdBy:
        movement.createdBy,

      createdAt:
        movement.createdAt
    })
  );
}

export async function executeCashCustomerFinance(
  command: ExecuteCashCustomerFinanceCommand
): Promise<CashFinanceExecutionResult> {
  const operationPlan =
    createCashOperationPlan(
      command.cashOperation
    );

  assertPostingIntegrity(
    operationPlan.cashMovement,
    operationPlan.journalPosting
  );

  const allocationRecords =
    createAllocationRecords(
      operationPlan.cashMovement,
      operationPlan.journalPosting,
      command.customerAllocation
    );

  return localFinanceJournalDb.transaction(
    "rw",
    localFinanceJournalDb.cashMovements,
    localFinanceJournalDb.cashAllocations,
    localFinanceJournalDb.entries,
    localFinanceJournalDb.lines,
    async () => {
      const existingByIdempotency =
        await localFinanceJournalDb
          .cashMovements
          .where(
            "[tenantId+companyId+branchId+accountingPeriodId+idempotencyKey]"
          )
          .equals([
            operationPlan.cashMovement.tenantId,
            operationPlan.cashMovement.companyId,
            operationPlan.cashMovement.branchId,
            operationPlan.cashMovement.accountingPeriodId,
            operationPlan.cashMovement.idempotencyKey
          ])
          .first();

      const existingMovementById =
        await localFinanceJournalDb
          .cashMovements
          .get(
            operationPlan.cashMovement.id
          );

      const existingEntryById =
        await localFinanceJournalDb
          .entries
          .get(
            operationPlan.journalPosting.entry.id
          );

      if (existingByIdempotency) {
        if (
          existingByIdempotency.id !==
          operationPlan.cashMovement.id
        ) {
          throw new Error(
            "CASH_FINANCE_IDEMPOTENCY_CONFLICT"
          );
        }

        if (
          !existingEntryById ||
          existingEntryById.idempotencyKey !==
            operationPlan.journalPosting.entry.idempotencyKey
        ) {
          throw new Error(
            "CASH_FINANCE_PARTIAL_STATE_CONFLICT"
          );
        }

        const existingLines =
          await localFinanceJournalDb
            .lines
            .filter(
              line =>
                line.journalEntryId ===
                operationPlan.journalPosting.entry.id
            )
            .toArray();

        const existingAllocations =
          await localFinanceJournalDb
            .cashAllocations
            .filter(
              allocation =>
                allocation.cashMovementId ===
                operationPlan.cashMovement.id
            )
            .toArray();

        if (
          existingLines.length !==
          operationPlan.journalPosting.lines.length
        ) {
          throw new Error(
            "CASH_FINANCE_REPLAY_LINE_CONFLICT"
          );
        }

        if (
          existingAllocations.length !==
          allocationRecords.length
        ) {
          throw new Error(
            "CASH_FINANCE_REPLAY_ALLOCATION_CONFLICT"
          );
        }

        return {
          status: "REPLAY",
          cashMovementId:
            operationPlan.cashMovement.id,
          journalEntryId:
            operationPlan.journalPosting.entry.id,
          allocationRecordIds:
            allocationRecords.map(
              allocation => allocation.id
            )
        };
      }

      if (existingMovementById) {
        throw new Error(
          "CASH_FINANCE_MOVEMENT_CONFLICT"
        );
      }

      if (existingEntryById) {
        throw new Error(
          "CASH_FINANCE_JOURNAL_ENTRY_CONFLICT"
        );
      }

      for (const allocation of allocationRecords) {
        const existingAllocation =
          await localFinanceJournalDb
            .cashAllocations
            .get(allocation.id);

        if (existingAllocation) {
          throw new Error(
            "CASH_FINANCE_ALLOCATION_RECORD_CONFLICT"
          );
        }
      }

      await localFinanceJournalDb
        .entries
        .add(
          operationPlan.journalPosting.entry
        );

      await localFinanceJournalDb
        .lines
        .bulkAdd(
          operationPlan.journalPosting.lines
        );

      await localFinanceJournalDb
        .cashMovements
        .add(
          operationPlan.cashMovement
        );

      if (allocationRecords.length > 0) {
        await localFinanceJournalDb
          .cashAllocations
          .bulkAdd(allocationRecords);
      }

      return {
        status: "CREATED",
        cashMovementId:
          operationPlan.cashMovement.id,
        journalEntryId:
          operationPlan.journalPosting.entry.id,
        allocationRecordIds:
          allocationRecords.map(
            allocation => allocation.id
          )
      };
    }
  );
}
