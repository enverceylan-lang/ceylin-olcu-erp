"use client";

import { useEffect, useState } from "react";
import { Activity, LockKeyhole } from "lucide-react";
import { liveQuery } from "dexie";
import {
  useAuthStore,
  normalizeRole
} from "@/store/useAuthStore";
import {
  localSalesSyncQueueDb
} from "@/lib/localSalesSyncQueueDb";
import {
  summarizeSalesSyncQueue,
  type SalesSyncQueueSummary
} from "@/lib/salesSyncDiagnostics";
import {
  isSalesSyncQueueCaptureEnabled
} from "@/lib/salesSyncQueueBridge";

const emptySummary: SalesSyncQueueSummary = {
  total: 0,
  pending: 0,
  error: 0,
  synced: 0,
  totalRetryCount: 0
};

export default function SalesSyncDiagnosticsCard() {
  const currentUser = useAuthStore(
    state => state.currentUser
  );
  const [summary, setSummary] =
    useState<SalesSyncQueueSummary>(emptySummary);
  const [loaded, setLoaded] = useState(false);

  const isAdmin =
    currentUser &&
    normalizeRole(currentUser.role) === "ADMIN";

  useEffect(() => {
    if (!isAdmin) return;

    const subscription = liveQuery(async () => {
      const events =
        await localSalesSyncQueueDb.events.toArray();

      return summarizeSalesSyncQueue(events);
    }).subscribe({
      next: nextSummary => {
        setSummary(nextSummary);
        setLoaded(true);
      },
      error: () => {
        setSummary(emptySummary);
        setLoaded(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [isAdmin]);

  if (!isAdmin) return null;

  const captureEnabled =
    isSalesSyncQueueCaptureEnabled();

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-3 border-b border-gray-200 p-5 dark:border-gray-800">
        <Activity className="h-5 w-5 text-cyan-600" />
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white">
            Satış Senkronizasyon Teşhisi
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Yalnız teknik kuyruk sayıları gösterilir; satış ve müşteri bilgileri gösterilmez.
          </p>
        </div>
      </div>

      <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Bekleyen", summary.pending],
          ["Hatalı", summary.error],
          ["Senkronize", summary.synced],
          ["Toplam Deneme", summary.totalRetryCount]
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-950/40"
          >
            <div className="text-xs text-gray-500">
              {label}
            </div>
            <div className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
              {loaded ? value : "—"}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 border-t border-gray-200 px-5 py-4 text-xs dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
          <LockKeyhole className="h-4 w-4" />
          API gönderimi kapalı; veritabanı yazma yolu etkin değil.
        </div>
        <div
          className={
            captureEnabled
              ? "font-semibold text-amber-700 dark:text-amber-300"
              : "font-semibold text-emerald-700 dark:text-emerald-300"
          }
        >
          Yerel olay yakalama:{" "}
          {captureEnabled ? "Pilot açık" : "Kapalı"}
        </div>
      </div>
    </section>
  );
}
