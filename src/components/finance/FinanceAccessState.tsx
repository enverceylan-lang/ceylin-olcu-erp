import { ShieldAlert } from "lucide-react";
import type { FinanceAccessReasonCode } from "@/lib/finance/financeAccessPolicy";

interface FinanceAccessStateProps {
  reason: FinanceAccessReasonCode | string;
  title?: string;
}

const REASON_LABELS: Partial<Record<FinanceAccessReasonCode, string>> = {
  MISSING_SCOPE: "Aktif şirket, şube ve muhasebe dönemi doğrulanamadı.",
  SCOPE_DENIED: "Seçili kapsam için finans erişimi bulunmuyor.",
  PERMISSION_DENIED: "Bu finans görünümü için gerekli izniniz bulunmuyor.",
  PACKAGE_FEATURE_DENIED: "Bu finans görünümü mevcut pakette bulunmuyor.",
};

export function FinanceAccessState({
  reason,
  title = "Finans görünümü kullanılamıyor",
}: FinanceAccessStateProps) {
  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900/50 dark:bg-amber-950/20">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <h2 className="font-semibold text-amber-950 dark:text-amber-100">
            {title}
          </h2>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
            {REASON_LABELS[reason as FinanceAccessReasonCode] ||
              "Finans kapsamı güvenli biçimde doğrulanamadı."}
          </p>
          <p className="mt-2 text-xs text-amber-700/80 dark:text-amber-400/80">
            Erişim kodu: {reason}
          </p>
        </div>
      </div>
    </section>
  );
}
