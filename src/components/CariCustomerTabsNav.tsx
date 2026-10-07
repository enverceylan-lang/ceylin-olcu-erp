export type CariCustomerTab = "rooms" | "timeline" | "financial";

interface CariCustomerTabsNavProps {
  activeTab: CariCustomerTab;
  showWorkflowTab: boolean;
  onTabChange: (tab: CariCustomerTab) => void;
}

function tabClassName(active: boolean): string {
  return `pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
    active
      ? "border-blue-500 text-blue-600 dark:text-blue-400"
      : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
  }`;
}

export function CariCustomerTabsNav({
  activeTab,
  showWorkflowTab,
  onTabChange,
}: CariCustomerTabsNavProps) {
  return (
    <div className="flex border-b border-gray-200 dark:border-gray-800 mb-4 gap-6">
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