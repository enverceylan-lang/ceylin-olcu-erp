export type CariCustomerMode = "MEASUREMENT" | "OFFICE";

interface CariCustomerModeToggleProps {
  mode: CariCustomerMode;
  canAccessOfficeMode: boolean;
  onModeChange: (mode: CariCustomerMode) => void;
}

export function CariCustomerModeToggle({
  mode,
  canAccessOfficeMode,
  onModeChange,
}: CariCustomerModeToggleProps) {
  return (
    <div className="flex bg-gray-200 dark:bg-gray-800 rounded-xl p-1 shadow-inner">
      <button
        onClick={() => onModeChange("MEASUREMENT")}
        className={`px-6 py-2 text-sm font-bold rounded-lg transition-colors ${
          mode === "MEASUREMENT"
            ? "bg-white dark:bg-[#435269] text-[#527eae] dark:text-[#9fc1e8] shadow"
            : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
        }`}
      >
        Sahadan Ölçü Modu
      </button>

      {canAccessOfficeMode ? (
        <button
          onClick={() => onModeChange("OFFICE")}
          className={`px-6 py-2 text-sm font-bold rounded-lg transition-colors ${
            mode === "OFFICE"
              ? "bg-white dark:bg-[#594b47] text-[#ad5f3d] dark:text-[#e1a486] shadow"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
          }`}
        >
          Ofis / Satış Modu
        </button>
      ) : (
        <button
          disabled
          className="px-6 py-2 text-sm font-bold rounded-lg text-gray-400 dark:text-gray-600 cursor-not-allowed"
          title="Bu mod için yetkiniz yok"
        >
          Ofis / Satış Modu
        </button>
      )}
    </div>
  );
}