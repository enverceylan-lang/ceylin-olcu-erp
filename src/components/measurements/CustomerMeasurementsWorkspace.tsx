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
            Ölçüleri cihazda kaydedin. Gönderme ve alma işlemlerini ilgili düğmelerden başlatın.
          </p>
        </div>
        <div className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
          Oda · Ölçü · Açıklık isteğe bağlı
        </div>
      </div>

      <div
        className="grid grid-cols-2 gap-1.5 rounded-xl border border-slate-200 bg-slate-100 p-1.5 dark:border-[#3e4850] dark:bg-[#0b1326]"
        aria-label="Ölçü çalışma alanı görünümü"
      >
        <button
          type="button"
          onClick={onCapture}
          aria-pressed={tab === "CAPTURE"}
          className={`min-h-11 rounded-md px-2.5 py-2 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 sm:px-4 ${
            tab === "CAPTURE"
              ? "bg-sky-700 text-white shadow-sm dark:bg-[#89ceff] dark:text-[#00344d]"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          }`}
        >
          Yeni Ölçü
        </button>
        <button
          type="button"
          onClick={onExplorer}
          aria-pressed={tab === "EXPLORER"}
          className={`min-h-11 rounded-md px-2.5 py-2 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 sm:px-4 ${
            tab === "EXPLORER"
              ? "bg-sky-700 text-white shadow-sm dark:bg-[#89ceff] dark:text-[#00344d]"
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
