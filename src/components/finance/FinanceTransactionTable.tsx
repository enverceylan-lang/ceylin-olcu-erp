import type { FinanceTransaction } from "@/lib/finance/financeContracts";

interface FinanceTransactionTableProps {
  transactions: readonly FinanceTransaction[];
  currency: string;
  emptyMessage?: string;
}

function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
  }).format(value);
}

export function FinanceTransactionTable({
  transactions,
  currency,
  emptyMessage = "Finans hareketi bulunamadı.",
}: FinanceTransactionTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-400">
          <tr>
            <th className="px-4 py-3">Tarih</th>
            <th className="px-4 py-3">Satış</th>
            <th className="px-4 py-3">Kaynak</th>
            <th className="px-4 py-3">Açıklama</th>
            <th className="px-4 py-3 text-right">Borç</th>
            <th className="px-4 py-3 text-right">Tahsilat</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
          {transactions.length === 0 ? (
            <tr>
              <td
                colSpan={6}
                className="px-4 py-10 text-center text-gray-500 dark:text-gray-400"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            transactions.map((transaction, index) => (
              <tr
                key={`${transaction.id}-${index}`}
                className="text-gray-700 dark:text-gray-300"
              >
                <td className="whitespace-nowrap px-4 py-3">
                  {new Intl.DateTimeFormat("tr-TR").format(
                    new Date(`${transaction.transactionDate}T12:00:00`),
                  )}
                </td>
                <td className="px-4 py-3 font-medium">
                  {transaction.saleId}
                </td>
                <td className="px-4 py-3">
                  {transaction.sourceDocumentType}
                </td>
                <td className="max-w-xs truncate px-4 py-3">
                  {transaction.description || "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-rose-600 dark:text-rose-400">
                  {transaction.direction === "DEBIT"
                    ? formatMoney(transaction.netAmount, currency)
                    : "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
                  {transaction.direction === "CREDIT"
                    ? formatMoney(transaction.netAmount, currency)
                    : "—"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
