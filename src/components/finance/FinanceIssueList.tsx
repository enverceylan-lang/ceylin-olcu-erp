import { AlertTriangle } from "lucide-react";
import type { FinanceReadIssue } from "@/lib/finance/financeReadSelector";

interface FinanceIssueListProps {
  issues: readonly FinanceReadIssue[];
}

export function FinanceIssueList({ issues }: FinanceIssueListProps) {
  if (issues.length === 0) return null;

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
      <h3 className="flex items-center gap-2 font-semibold text-amber-950 dark:text-amber-100">
        <AlertTriangle className="h-4 w-4" />
        Finans uyarıları
      </h3>
      <ul className="mt-3 space-y-2 text-sm text-amber-800 dark:text-amber-300">
        {issues.map((issue, index) => (
          <li key={`${issue.code}-${index}`}>
            <span className="font-semibold">{issue.code}</span>
            {" — "}
            {issue.message}
          </li>
        ))}
      </ul>
    </section>
  );
}
