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
      className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 shadow-sm dark:border-yellow-900/60 dark:bg-yellow-950/30"
      aria-label="Satışa bağlanmamış ölçüler"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-bold text-yellow-900 dark:text-yellow-100">
            Bu müşterinin satışa bağlanmamış{" "}
            {openMeasurements.length} ölçüsü var.
          </p>

          <p className="mt-1 text-sm text-yellow-800 dark:text-yellow-200">
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
          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-yellow-300 bg-white px-4 py-2 text-sm font-bold text-yellow-900 shadow-sm transition-colors hover:bg-yellow-100 dark:border-yellow-800 dark:bg-gray-900 dark:text-yellow-100 dark:hover:bg-yellow-950"
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
                    "flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-3 transition-colors dark:bg-gray-900",
                    isSelected
                      ? "border-blue-400 ring-2 ring-blue-100 dark:border-blue-500 dark:ring-blue-950"
                      : "border-yellow-200 hover:border-yellow-300 dark:border-yellow-900"
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
                    className="mt-1 h-4 w-4 rounded border-gray-300"
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

                    <span className="mt-1 block break-all text-xs text-gray-500 dark:text-gray-400">
                      Kayıt: {measurement.id}
                    </span>
                  </span>
                </label>
              );
            }
          )}

          <div className="flex flex-col gap-2 border-t border-yellow-200 pt-3 sm:flex-row sm:items-center sm:justify-between dark:border-yellow-900">
            <span className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
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
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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