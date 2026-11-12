export type CariCustomerTab = "rooms" | "timeline" | "financial";

interface CariCustomerTabsNavProps {
  activeTab: CariCustomerTab;
  showWorkflowTab: boolean;
  onTabChange: (tab: CariCustomerTab) => void;
}

function tabClassName(active: boolean): string {
  return `min-h-11 shrink-0 whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-500 ${
    active
      ? "bg-sky-100 text-sky-900 dark:bg-[#89ceff] dark:text-[#00344d]"
      : "text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-[#222a3d]"
  }`;
}

export function CariCustomerTabsNav({
  activeTab,
  showWorkflowTab,
  onTabChange,
}: CariCustomerTabsNavProps) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-[#3e4850] dark:bg-[#131b2e]">
      <button
        onClick={() => onTabChange("rooms")}
        className={tabClassName(activeTab === "rooms")}
      >
        Odalar ve Ölçüler
      </button>

      {showWorkflowTab && (
        <button
          onClick={() => onTabChange("timeline")}
          className={tabClassName(activeTab === "timeline")}
        >
          Cari İş Akışı
        </button>
      )}

      <button
        onClick={() => onTabChange("financial")}
        className={tabClassName(activeTab === "financial")}
      >
        Finans
      </button>
    </div>
  );
}