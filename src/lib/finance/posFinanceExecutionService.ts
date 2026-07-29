import type {
  CreatePosMonthlyFeeFinanceCommand,
  CreatePosRefundFinanceCommand,
  CreatePosSettlementFinanceCommand,
  PosFinanceBridgeState
} from "@/lib/finance/posFinanceBridgeContracts";
import {
  createPosMonthlyFeeFinance,
  createPosRefundFinance,
  createPosSettlementFinance
} from "@/lib/finance/posFinanceBridgeService";
import {
  postLocalBankMovementAndJournal
} from "@/lib/finance/localFinanceJournalDb";

export async function executePosSettlementFinance(
  command: CreatePosSettlementFinanceCommand,
  state: PosFinanceBridgeState
) {
  const bridgeResult =
    createPosSettlementFinance(
      command,
      state
    );

  const persistenceResult =
    await postLocalBankMovementAndJournal(
      bridgeResult.value.bankMovement,
      bridgeResult.value.journalPosting
    );

  return {
    bridgeResult,
    persistenceResult
  };
}

export async function executePosMonthlyFeeFinance(
  command: CreatePosMonthlyFeeFinanceCommand,
  state: PosFinanceBridgeState
) {
  const bridgeResult =
    createPosMonthlyFeeFinance(
      command,
      state
    );

  const persistenceResult =
    await postLocalBankMovementAndJournal(
      bridgeResult.value.bankMovement,
      bridgeResult.value.journalPosting
    );

  return {
    bridgeResult,
    persistenceResult
  };
}

export async function executePosRefundFinance(
  command: CreatePosRefundFinanceCommand,
  state: PosFinanceBridgeState
) {
  const bridgeResult =
    createPosRefundFinance(
      command,
      state
    );

  const persistenceResult =
    await postLocalBankMovementAndJournal(
      bridgeResult.value.bankMovement,
      bridgeResult.value.journalPosting
    );

  return {
    bridgeResult,
    persistenceResult
  };
}
