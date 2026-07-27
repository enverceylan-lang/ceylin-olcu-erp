import {
  CircleDollarSign,
  CreditCard,
  FileWarning,
  ReceiptText,
  Scale,
} from "lucide-react";
import type { FinanceReadSummary } from "@/lib/finance/financeReadSelector";

interface FinanceSummaryCardsProps {
  summary: FinanceReadSummary;
  currency: string;
}

function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
  }).format(value);
}

export function FinanceSummaryCards({
  summary,
  currency,
}: FinanceSummaryCardsProps) {
  const cards = [
    {
      label: "Toplam Borç",
      value: formatMoney(summary.debitTotal, currency),
      icon: CircleDollarSign,
      color: "text-rose-600 dark:text-rose-400",
    },
    {
      label: "Toplam Tahsilat",
      value: formatMoney(summary.creditTotal, currency),
      icon: CreditCard,
      color: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Kalan Bakiye",
      value: formatMoney(summary.balance, currency),
      icon: Scale,
      color: "text-blue-600 dark:text-blue-400",
    },
    {
      label: "Hareket Sayısı",
      value: String(summary.transactionCount),
      icon: ReceiptText,
      color: "text-indigo-600 dark:text-indigo-400",
    },
    {
      label: "Uyarı / Issue",
      value: String(summary.issueCount),
      icon: FileWarning,
      color: "text-amber-600 dark:text-amber-400",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => (
        <article
          key={card.label}
          className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {card.label}
            </p>
            <card.icon className={`h-5 w-5 ${card.color}`} />
          </div>
          <p className="mt-3 text-xl font-bold text-gray-950 dark:text-white">
            {card.value}
          </p>
        </article>
      ))}
    </div>
  );
}
