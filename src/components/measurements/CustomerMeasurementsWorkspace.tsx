"use client";

export type MeasurementWorkspaceTab =
  | "CAPTURE"
  | "EXPLORER";

interface CustomerMeasurementsWorkspaceProps {
  tab: MeasurementWorkspaceTab;
  onCapture: () => void;
  onExplorer: () => void;
}

export function CustomerMeasurementsWorkspace({
  tab,
  onCapture,
  onExplorer,
}: CustomerMeasurementsWorkspaceProps) {
  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white p-2 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onCapture}
          className={`rounded-lg px-4 py-2.5 text-sm font-bold transition-colors ${
            tab === "CAPTURE"
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
          }`}
        >
          Ölçü Al
        </button>
        <button
          type="button"
          onClick={onExplorer}
          className={`rounded-lg px-4 py-2.5 text-sm font-bold transition-colors ${
            tab === "EXPLORER"
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
          }`}
        >
          Odalar / Ölçüler
        </button>
      </div>
    </div>
  );
}
