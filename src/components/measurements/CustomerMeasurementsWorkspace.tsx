"use client";

import type { ReactNode } from "react";

export type MeasurementWorkspaceTab =
  | "CAPTURE"
  | "EXPLORER";

interface CustomerMeasurementsWorkspaceProps {
  tab: MeasurementWorkspaceTab;
  onCapture: () => void;
  onExplorer: () => void;
  capture: ReactNode;
  explorer: ReactNode;
}

export function CustomerMeasurementsWorkspace({
  tab,
  onCapture,
  onExplorer,
  capture,
  explorer,
}: CustomerMeasurementsWorkspaceProps) {
  return (
    <section
      data-enverp-measurement-workspace="stitch-v2"
      className="mb-6 space-y-3"
    >
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-black tracking-wide text-gray-900 dark:text-white">
            Ölçüler
          </h2>
          <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
            Ölçüleri kaydedin; cihaz çevrimdışıyken yerelde korunur ve bağlantı gelince otomatik eşitlenir.
          </p>
        </div>
        <div className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
          Oda · Ölçü · Açıklık isteğe bağlı
        </div>
      </div>

      <div
        className="grid grid-cols-2 gap-2 rounded-xl border border-gray-200 bg-white p-2 shadow-sm dark:border-gray-800 dark:bg-gray-900"
        aria-label="Ölçü çalışma alanı görünümü"
      >
        <button
          type="button"
          onClick={onCapture}
          aria-pressed={tab === "CAPTURE"}
          className={`rounded-lg px-4 py-2.5 text-sm font-bold transition-colors ${
            tab === "CAPTURE"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          }`}
        >
          Yeni Ölçü
        </button>
        <button
          type="button"
          onClick={onExplorer}
          aria-pressed={tab === "EXPLORER"}
          className={`rounded-lg px-4 py-2.5 text-sm font-bold transition-colors ${
            tab === "EXPLORER"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          }`}
        >
          Odalar ve Ölçüler
        </button>
      </div>

      <div
        data-workspace-pane={tab === "CAPTURE" ? "capture" : "explorer"}
        className="min-w-0"
      >
        {tab === "CAPTURE" ? capture : explorer}
      </div>
    </section>
  );
}
