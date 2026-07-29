import {
  buildCashMovementReport,
  type CashMovementReportQuery,
  type CashMovementReportResult
} from "@/lib/finance/cashMovementReportService";
import {
  localFinanceJournalDb
} from "@/lib/finance/localFinanceJournalDb";

export async function queryLocalCashMovements(
  query: CashMovementReportQuery
): Promise<CashMovementReportResult> {
  const movements =
    await localFinanceJournalDb.cashMovements
      .where(
        "[tenantId+companyId+branchId+accountingPeriodId]"
      )
      .equals([
        query.tenantId,
        query.companyId,
        query.branchId,
        query.accountingPeriodId
      ])
      .toArray();

  return buildCashMovementReport(
    movements,
    query
  );
}