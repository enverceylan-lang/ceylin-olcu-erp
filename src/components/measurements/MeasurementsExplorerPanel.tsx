"use client";

export interface MeasurementExplorerItem {
  id: string;
  title: string;
  templateLabel: string;
  summary: string;
  measuredAt?: string;
  measuredBy?: string;
  canMutate: boolean;
  highlighted: boolean;
}

interface MeasurementsExplorerPanelProps {
  items: readonly MeasurementExplorerItem[];
  onAdd: () => void;
  onEdit: (measurementId: string) => void;
  onDelete: (measurementId: string) => void;
}

export function MeasurementsExplorerPanel({
  items,
  onAdd,
  onEdit,
  onDelete,
}: MeasurementsExplorerPanelProps) {
  return (
    <section className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 dark:border-blue-900/50 dark:bg-blue-950/10">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-gray-900 dark:text-white">
            Odaya Bağlı Ölçüler
          </h4>
          <p className="text-[10px] text-gray-500">
            Açıklık oluşturmadan doğrudan bu odaya
            kaydedilen ölçüler.
          </p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
        >
          + Ölçü Al
        </button>
      </div>

      <div className="space-y-2">
        {items.map(item => (
          <div
            key={item.id}
            data-measurement-id={item.id}
            className={`rounded-lg border bg-white p-3 dark:border-gray-700 dark:bg-gray-900 ${
              item.highlighted
                ? "ring-2 ring-blue-500"
                : ""
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-bold text-gray-900 dark:text-white">
                  {item.title}
                  <span className="ml-2 text-xs font-medium text-gray-500">
                    {item.templateLabel}
                  </span>
                </div>
                <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                  {item.summary}
                </div>
                {item.measuredAt && (
                  <div className="mt-1 text-[10px] text-gray-500">
                    {item.measuredAt}
                    {item.measuredBy
                      ? ` · ${item.measuredBy}`
                      : ""}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {item.canMutate ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onEdit(item.id)}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700"
                    >
                      Düzenle
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(item.id)}
                      className="text-xs font-bold text-red-500 hover:text-red-700"
                    >
                      Sil
                    </button>
                  </>
                ) : (
                  <span className="text-[10px] font-semibold text-gray-400">
                    Senkronlandı · Salt okunur
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
