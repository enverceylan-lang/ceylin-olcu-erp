"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeft,
  BarChart3,
  ChevronRight,
  History,
  WalletCards,
} from "lucide-react";
import type { ErpScope } from "@/lib/erpScope";
import type { FinancePermission } from "@/lib/finance/financeAccessPolicy";
import { CollectionWorkspace } from "@/components/finance/CollectionWorkspace";
import {
  visibleFinanceCollectionItems,
  visibleFinancePaymentItems,
  visibleFinanceSections,
} from "@/lib/finance/financeNavigationPolicy";

const SECTION_META = {
  Tahsilat: {
    description: "Müşteriden gelen para ve kıymetli evrak işlemleri",
    icon: ArrowDownToLine,
  },
  Ödeme: {
    description: "Tedarikçi, gider ve diğer borç ödemeleri",
    icon: ArrowUpFromLine,
  },
  Hesaplar: {
    description: "Kasa, banka, POS ve finansal araçlar",
    icon: WalletCards,
  },
  Raporlar: {
    description: "Finans hareketleri ve hesap bazlı raporlar",
    icon: BarChart3,
  },
  "Devir / Açılış": {
    description: "Açılış ve devir bakiyelerinin kontrollü girişi",
    icon: History,
  },
} as const;

export type FinanceSection = keyof typeof SECTION_META;

interface FinanceOperationsPanelProps {
  activeSection: FinanceSection | null;
  onSectionChange: (section: FinanceSection | null) => void;
  scope: ErpScope;
  permissions: readonly FinancePermission[];
  overviewAllowed: boolean;
}

function accountItems(permissions: readonly FinancePermission[]): string[] {
  const manage = permissions.includes("finance.account.manage");
  const items: string[] = [];

  if (manage || permissions.includes("finance.cash.view")) {
    items.push("Kasalar");
  }

  if (manage || permissions.includes("finance.bank.view")) {
    items.push("Banka Hesapları");
  }

  if (manage || permissions.includes("finance.pos.view")) {
    items.push("POS Cihazları ve Sözleşmeleri");
  }

  if (
    manage ||
    permissions.includes("finance.cheque.view") ||
    permissions.includes("finance.note.view")
  ) {
    items.push("Çek / Senet Portföyü");
  }

  return items;
}

function reportItems(permissions: readonly FinancePermission[]): string[] {
  if (!permissions.includes("finance.report.view")) {
    return permissions.includes("finance.reconciliation.view")
      ? ["Mutabakat"]
      : [];
  }

  const items: string[] = [];

  if (permissions.includes("finance.cash.view")) items.push("Kasa Raporları");
  if (permissions.includes("finance.bank.view")) items.push("Banka Raporları");
  if (permissions.includes("finance.pos.view")) items.push("POS Raporları");
  if (permissions.includes("finance.cheque.view")) items.push("Çek Raporları");
  if (permissions.includes("finance.note.view")) items.push("Senet Raporları");

  items.push("Genel Finans Raporu");

  if (permissions.includes("finance.reconciliation.view")) {
    items.push("Mutabakat");
  }

  return items;
}

function sectionItems(
  section: FinanceSection,
  permissions: readonly FinancePermission[],
): string[] {
  if (section === "Tahsilat") {
    return visibleFinanceCollectionItems(permissions);
  }

  if (section === "Ödeme") {
    return visibleFinancePaymentItems(permissions);
  }

  if (section === "Hesaplar") {
    return accountItems(permissions);
  }

  if (section === "Raporlar") {
    return reportItems(permissions);
  }

  if (section === "Devir / Açılış") {
    return permissions.includes("finance.opening_balance.create")
      ? ["Cari Devir / Açılış Bakiyesi"]
      : [];
  }

  return [];
}

export default function FinanceOperationsPanel({
  activeSection,
  onSectionChange,
  scope,
  permissions,
  overviewAllowed,
}: FinanceOperationsPanelProps) {
  const [activeItem, setActiveItem] = useState<string | null>(null);

  const visibleSections = useMemo(
    () =>
      visibleFinanceSections(permissions).filter(
        (section): section is FinanceSection => section !== "Genel Bakış",
      ),
    [permissions],
  );

  const section =
    activeSection && visibleSections.includes(activeSection)
      ? activeSection
      : null;

  const items = section ? sectionItems(section, permissions) : [];

  const openSection = (nextSection: FinanceSection) => {
    if (!visibleSections.includes(nextSection)) return;
    setActiveItem(null);
    onSectionChange(nextSection);
  };

  const returnToOverview = () => {
    setActiveItem(null);

    if (overviewAllowed) {
      onSectionChange(null);
      return;
    }

    const first = visibleSections[0];
    if (first) onSectionChange(first);
  };

  if (!section && visibleSections.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
            Finans işlem merkezi
          </p>
          <h2 className="mt-1 text-lg font-bold text-slate-950 dark:text-white">
            {section
              ? `${section} işlemleri`
              : "Yetkiniz dahilindeki finans işlemleri"}
          </h2>
        </div>

        {section && overviewAllowed ? (
          <button
            type="button"
            onClick={returnToOverview}
            className="mt-2 inline-flex min-h-10 w-fit items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 sm:mt-0"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Genel Bakışa dön
          </button>
        ) : null}
      </div>

      {!section ? (
        <div
          className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
          aria-label="Finans ana bölümleri"
        >
          {visibleSections.map((candidate) => {
            const meta = SECTION_META[candidate];
            const Icon = meta.icon;

            return (
              <button
                key={candidate}
                type="button"
                onClick={() => openSection(candidate)}
                className="group min-h-32 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50/70 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-300 dark:hover:border-blue-800 dark:hover:bg-blue-950/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <ChevronRight
                    className="h-5 w-5 text-slate-400 transition-transform group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </div>

                <span className="mt-3 block text-sm font-bold">
                  {candidate}
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {meta.description}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mt-4">
          <nav
            aria-label="Finans konumu"
            className="text-xs font-semibold text-slate-500 dark:text-slate-400"
          >
            Finans <span aria-hidden="true">›</span> {section}
            {activeItem ? (
              <>
                <span aria-hidden="true"> › </span>
                {activeItem}
              </>
            ) : null}
          </nav>

          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {SECTION_META[section].description}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={activeItem === item}
                onClick={() => setActiveItem(item)}
                className={`flex min-h-14 items-center justify-between rounded-xl border px-4 text-left text-sm font-semibold transition-colors ${
                  activeItem === item
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-300 hover:bg-blue-50/70 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-300 dark:hover:border-blue-800 dark:hover:bg-blue-950/20"
                }`}
              >
                {item}
                <ChevronRight
                  className="h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
              </button>
            ))}
          </div>

          {activeItem && section === "Tahsilat" ? (
            <CollectionWorkspace
              key={activeItem}
              activeItem={activeItem}
              scope={scope}
              permissions={permissions}
            />
          ) : activeItem && section === "Hesaplar" ? (
            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
              {permissions.includes("finance.account.manage")
                ? "Hesap yönetim paneli aşağıda açılır."
                : "Bu alanda yalnız görüntüleme yetkinize uygun hesaplar gösterilecektir."}
            </div>
          ) : activeItem ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              <strong>{activeItem}</strong> için işlem üreticisi henüz canonical
              finans zincirine bağlanmadığından kayıt oluşturulmaz.
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}