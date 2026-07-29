"use client";

import {
  useEffect,
  useMemo,
  useState
} from "react";
import { useMeasurementStore } from "@/store/measurementStore";
import { useSalesStore } from "@/store/salesStore";
import {
  getUnboundMeasurementsForCustomer
} from "@/lib/saleMeasurementBindingService";

interface OpenMeasurementsNoticeProps {
  customerId: string;
  excludedMeasurementIds?: string[];
  onApplyMeasurements: (
    measurementIds: string[]
  ) => Promise<void>;
}

function formatDate(
  value: string | undefined
): string {
  if (!value) {
    return "Tarih bilgisi yok";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Tarih bilgisi yok";
  }

  return new Intl.DateTimeFormat(
    "tr-TR",
    {
      dateStyle: "medium",
      timeStyle: "short"
    }
  ).format(date);
}

export default function OpenMeasurementsNotice({
  customerId,
  excludedMeasurementIds = [],
  onApplyMeasurements
}: OpenMeasurementsNoticeProps) {
  const measurements =
    useMeasurementStore(
      state => state.measurements
    );

  const loadMeasurements =
    useMeasurementStore(
      state => state.loadMeasurements
    );

  const sales =
    useSalesStore(
      state => state.sales
    );

  const [isExpanded, setIsExpanded] =
    useState(false);

  const [
    selectedMeasurementIds,
    setSelectedMeasurementIds
  ] = useState<string[]>([]);

  const [isApplying, setIsApplying] =
    useState(false);

  useEffect(() => {
    void loadMeasurements();
  }, [loadMeasurements]);

  const openMeasurements =
    useMemo(() => {
      const excludedIds =
        new Set(
          excludedMeasurementIds
        );

      return getUnboundMeasurementsForCustomer(
        customerId,
        measurements,
        sales
      ).filter(
        measurement =>
          !excludedIds.has(
            measurement.id
          )
      );
    }, [
      customerId,
      excludedMeasurementIds,
      measurements,
      sales
    ]);

  if (openMeasurements.length === 0) {
    return null;
  }

  const toggleMeasurement = (
    measurementId: string
  ) => {
    setSelectedMeasurementIds(
      previous =>
        previous.includes(measurementId)
          ? previous.filter(
              id => id !== measurementId
            )
          : [...previous, measurementId]
    );
  };

  const applySelectedMeasurements =
    async () => {
      if (
        selectedMeasurementIds.length ===
        0
      ) {
        return;
      }

      setIsApplying(true);

      try {
        await onApplyMeasurements(
          selectedMeasurementIds
        );

        setSelectedMeasurementIds([]);
        setIsExpanded(false);
      } finally {
        setIsApplying(false);
      }
    };

  return (
    <section
      className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/25"
      aria-label="Satışa bağlanmamış ölçüler"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="break-words font-bold text-amber-950 dark:text-amber-100">
            Bu müşterinin satışa bağlanmamış{" "}
            {openMeasurements.length} ölçüsü var.
          </p>

          <p className="mt-1 break-words text-sm leading-relaxed text-amber-800 dark:text-amber-200">
            Satışa eklenecek ölçüleri seçin.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setIsExpanded(
              previous => !previous
            )
          }
          className="inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-bold text-amber-950 shadow-sm transition-colors hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500/25 dark:border-amber-800 dark:bg-gray-900 dark:text-amber-100 dark:hover:bg-amber-950 sm:w-auto"
        >
          {isExpanded
            ? "Ölçüleri Gizle"
            : "Ölçüleri Gör"}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-3">
          {openMeasurements.map(
            measurement => {
              const isSelected =
                selectedMeasurementIds.includes(
                  measurement.id
                );

              return (
                <label
                  key={measurement.id}
                  className={[
                    "flex min-w-0 cursor-pointer items-start gap-3 rounded-xl border bg-white p-3 transition-colors hover:bg-amber-50/60 dark:bg-gray-900 dark:hover:bg-amber-950/20",
                    isSelected
                      ? "border-blue-400 bg-blue-50/50 ring-2 ring-blue-100 dark:border-blue-500 dark:bg-blue-950/20 dark:ring-blue-950"
                      : "border-amber-200 hover:border-amber-300 dark:border-amber-900 dark:hover:border-amber-800"
                  ].join(" ")}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() =>
                      toggleMeasurement(
                        measurement.id
                      )
                    }
                    className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 accent-blue-600 focus:ring-2 focus:ring-blue-500/30 dark:border-gray-600"
                  />

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        Ölçü kaydı
                      </span>

                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(
                          measurement.updatedAt ??
                          measurement.createdAt
                        )}
                      </span>
                    </span>

                    <span className="mt-1 block break-words text-xs text-gray-500 dark:text-gray-400">
                      Kayıt: {measurement.id}
                    </span>
                  </span>
                </label>
              );
            }
          )}

          <div className="flex flex-col gap-3 border-t border-amber-200 pt-3 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900">
            <span className="break-words text-sm font-medium text-amber-950 dark:text-amber-100">
              {selectedMeasurementIds.length} ölçü seçildi
            </span>

            <button
              type="button"
              disabled={
                selectedMeasurementIds.length ===
                  0 ||
                isApplying
              }
              onClick={() =>
                void applySelectedMeasurements()
              }
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:bg-gray-400 disabled:text-gray-100 dark:bg-blue-700 dark:hover:bg-blue-600 dark:disabled:bg-gray-700 dark:disabled:text-gray-400 sm:w-auto"
            >
              {isApplying
                ? "Satışa Ekleniyor..."
                : "Seçilenleri Satışa Ekle"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
