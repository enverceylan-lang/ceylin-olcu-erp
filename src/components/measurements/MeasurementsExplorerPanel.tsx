"use client";


export interface MeasurementExplorerItem {
  id: string;
  title?: string;
  measurementLabel?: string;
  fallbackIndex?: number;
  templateLabel: string;
  summary: string;
  measuredAt?: string;
  measuredBy?: string;
  statusLabel?: string;
  canMutate: boolean;
  highlighted: boolean;
}

export interface MeasurementExplorerOpeningGroup {
  id: string;
  name: string;
  measurements: readonly MeasurementExplorerItem[];
}

export interface MeasurementExplorerRoom {
  id: string;
  name: string;
  directMeasurements: readonly MeasurementExplorerItem[];
  openings: readonly MeasurementExplorerOpeningGroup[];
}

interface MeasurementsExplorerPanelProps {
  rooms?: readonly MeasurementExplorerRoom[];
  items?: readonly MeasurementExplorerItem[];
  onAdd?: () => void;
  onEdit?: (measurementId: string) => void;
  onDelete?: (measurementId: string) => void;
  onAddMeasurement?: (
    roomId: string,
    openingId?: string,
  ) => void;
  onEditMeasurement?: (measurementId: string) => void;
  onDeleteMeasurement?: (measurementId: string) => void;
  onOpenSalesPreparation?: (roomId: string) => void;
  onOpenVisualReport?: () => void;
  onShareWhatsApp?: () => void;
  onTransferToSale?: () => void;
  onRecoverMeasurements?: () => void;
  isRecovering?: boolean;
  selectedMeasurementId?: string | null;
  onSelectMeasurement?: (measurementId: string) => void;
}

interface MeasurementExplorerSelection {
  roomId: string;
  roomName: string;
  openingId?: string;
  openingName?: string;
  item: MeasurementExplorerItem;
}

export function resolveMeasurementExplorerLabel(
  measurementLabel: string | undefined,
  fallbackIndex: number,
): string {
  const explicit = String(measurementLabel || "").trim();
  if (explicit) return explicit;

  const safeIndex =
    Number.isInteger(fallbackIndex) && fallbackIndex > 0
      ? fallbackIndex
      : 1;

  return `Ölçü ${safeIndex}`;
}

function MeasurementRow({
  item,
  index,
  selected,
  onSelect,
  onEdit,
  onDelete,
}: {
  item: MeasurementExplorerItem;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onEdit?: (measurementId: string) => void;
  onDelete?: (measurementId: string) => void;
}) {
  const label =
    String(item.title || "").trim() ||
    resolveMeasurementExplorerLabel(
      item.measurementLabel,
      item.fallbackIndex || index + 1,
    );

  return (
    <div
      data-measurement-id={item.id}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={`cursor-pointer rounded-lg border bg-white px-3 py-2.5 transition-colors dark:border-gray-700 dark:bg-gray-900 ${
        item.highlighted
          ? "border-emerald-400 ring-2 ring-emerald-400/40"
          : selected
            ? "border-blue-400 ring-2 ring-blue-400/30"
            : "hover:border-blue-300 dark:hover:border-blue-800"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-bold text-gray-900 dark:text-white">
              {label}
            </span>
            {item.highlighted && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                Yeni
              </span>
            )}
            <span className="text-[11px] font-semibold text-gray-500">
              {item.templateLabel}
            </span>
            {item.statusLabel && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                {item.statusLabel}
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
            {item.summary}
          </div>
          {(item.measuredAt || item.measuredBy) && (
            <div className="mt-1 text-[10px] text-gray-500">
              {item.measuredAt || ""}
              {item.measuredAt && item.measuredBy
                ? " · "
                : ""}
              {item.measuredBy || ""}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {item.canMutate ? (
            <>
              {onEdit && (
                <button
                  type="button"
                  onClick={event => {
                    event.stopPropagation();
                    onEdit(item.id);
                  }}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-700"
                >
                  Düzenle
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={event => {
                    event.stopPropagation();
                    onDelete(item.id);
                  }}
                  className="text-[11px] font-bold text-red-500 hover:text-red-700"
                >
                  Sil
                </button>
              )}
            </>
          ) : (
            <span className="text-[10px] font-semibold text-gray-400">
              Senkronlandı · Salt okunur
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function LegacyMeasurementList({
  items,
  onAdd,
  onEdit,
  onDelete,
}: {
  items: readonly MeasurementExplorerItem[];
  onAdd?: () => void;
  onEdit?: (measurementId: string) => void;
  onDelete?: (measurementId: string) => void;
}) {
  return (
    <section className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 dark:border-blue-900/50 dark:bg-blue-950/10">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-gray-900 dark:text-white">
            Odaya Bağlı Ölçüler
          </h4>
          <p className="text-[10px] text-gray-500">
            Açıklık oluşturmadan doğrudan bu odaya kaydedilen ölçüler.
          </p>
        </div>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
          >
            + Yeni Ölçü
          </button>
        )}
      </div>

      <div className="space-y-2">
        {items.map((item, index) => (
          <MeasurementRow
            key={item.id}
            item={item}
            index={index}
            selected={false}
            onSelect={() => undefined}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </section>
  );
}

export function MeasurementsExplorerPanel({
  rooms,
  items,
  onAdd,
  onEdit,
  onDelete,
  onAddMeasurement,
  onEditMeasurement,
  onDeleteMeasurement,
  onOpenSalesPreparation,
  onOpenVisualReport,
  onShareWhatsApp,
  onTransferToSale,
  onRecoverMeasurements,
  isRecovering = false,
  selectedMeasurementId = null,
  onSelectMeasurement,
}: MeasurementsExplorerPanelProps) {

  const selections: MeasurementExplorerSelection[] =
    rooms
      ? rooms.flatMap(room => [
          ...room.directMeasurements.map(item => ({
            roomId: room.id,
            roomName: room.name,
            item,
          })),
          ...room.openings.flatMap(opening =>
            opening.measurements.map(item => ({
              roomId: room.id,
              roomName: room.name,
              openingId: opening.id,
              openingName: opening.name,
              item,
            })),
          ),
        ])
      : [];

  const highlightedSelection =
    selections.find(selection => selection.item.highlighted);

  const selectedSelection =
    selections.find(
      selection =>
        selection.item.id === selectedMeasurementId,
    ) ||
    highlightedSelection ||
    selections[0];

  if (!rooms) {
    return (
      <LegacyMeasurementList
        items={items || []}
        onAdd={onAdd}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );
  }

  return (
    <section
      data-measurement-explorer="central"
      className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900"
    >
      <div className="mb-3 border-b border-gray-100 pb-3 dark:border-gray-800">
        <h3 className="text-base font-black text-gray-900 dark:text-white">
          Odalar ve Ölçüler
        </h3>
        <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
          Kaydedilen ölçü aynı oda altında görünür. Opening / grup yalnız gerçekten varsa listelenir.
        </p>
      </div>

      {rooms.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700">
          Henüz oda yok. Sayfanın üstündeki Yeni Oda Ekle aksiyonuyla oda oluşturun.
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <div className="max-h-[72vh] space-y-3 overflow-y-auto pr-1">
            {rooms.map(room => {
              const roomMeasurementCount =
                room.directMeasurements.length +
                room.openings.reduce(
                  (total, opening) =>
                    total + opening.measurements.length,
                  0,
                );

              return (
                <section
                  key={room.id}
                  data-room-id={room.id}
                  className="rounded-xl border border-gray-200 bg-gray-50/60 p-3 dark:border-gray-800 dark:bg-gray-950/40"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="font-black text-gray-900 dark:text-white">
                        {room.name}
                      </h4>
                      <p className="text-[10px] font-semibold text-gray-500">
                        {roomMeasurementCount} ölçü
                        {room.openings.length > 0
                          ? ` · ${room.openings.length} açıklık/grup`
                          : ""}
                      </p>
                    </div>
                    {onAddMeasurement && (
                      <button
                        type="button"
                        onClick={() =>
                          onAddMeasurement(room.id)
                        }
                        className="rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-black text-white shadow-sm hover:bg-blue-700"
                      >
                        Bu Odanın Ölçüsünü Al
                      </button>
                    )}
                  </div>

                  {room.directMeasurements.length > 0 && (
                    <div className="mb-3">
                      <div className="mb-1.5 text-[10px] font-black uppercase tracking-wide text-gray-500">
                        Doğrudan Oda Ölçüleri
                      </div>
                      <div className="space-y-1.5">
                        {room.directMeasurements.map(
                          (item, index) => (
                            <MeasurementRow
                              key={item.id}
                              item={item}
                              index={index}
                              selected={
                                selectedSelection?.item.id ===
                                item.id
                              }
                              onSelect={() =>
                                onSelectMeasurement?.(
                                  item.id,
                                )
                              }
                              onEdit={onEditMeasurement}
                              onDelete={onDeleteMeasurement}
                            />
                          ),
                        )}
                      </div>
                    </div>
                  )}

                  {room.openings.length > 0 && (
                    <div className="space-y-2">
                      {room.openings.map(opening => (
                        <section
                          key={opening.id}
                          className="rounded-lg border border-gray-200 bg-white/80 p-2.5 dark:border-gray-800 dark:bg-gray-900/60"
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <div>
                              <div className="text-xs font-black text-gray-800 dark:text-gray-200">
                                Açıklık / Grup: {opening.name}
                              </div>
                              <div className="text-[9px] text-gray-500">
                                {opening.measurements.length} ölçü
                              </div>
                            </div>
                            {onAddMeasurement && (
                              <button
                                type="button"
                                onClick={() =>
                                  onAddMeasurement(
                                    room.id,
                                    opening.id,
                                  )
                                }
                                className="text-[10px] font-bold text-blue-600 hover:text-blue-700"
                              >
                                + Bu Açıklığa Ölçü
                              </button>
                            )}
                          </div>

                          {opening.measurements.length > 0 ? (
                            <div className="space-y-1.5">
                              {opening.measurements.map(
                                (item, index) => (
                                  <MeasurementRow
                                    key={item.id}
                                    item={item}
                                    index={index}
                                    selected={
                                      selectedSelection?.item.id ===
                                      item.id
                                    }
                                    onSelect={() =>
                                      onSelectMeasurement?.(
                                        item.id,
                                      )
                                    }
                                    onEdit={
                                      onEditMeasurement
                                    }
                                    onDelete={
                                      onDeleteMeasurement
                                    }
                                  />
                                ),
                              )}
                            </div>
                          ) : (
                            <div className="rounded-lg border border-dashed border-gray-200 px-3 py-3 text-center text-[10px] text-gray-400 dark:border-gray-800">
                              Bu açıklık / grupta ölçü yok.
                            </div>
                          )}
                        </section>
                      ))}
                    </div>
                  )}

                  {roomMeasurementCount === 0 &&
                    room.openings.length === 0 && (
                      <div className="rounded-lg border border-dashed border-gray-300 px-3 py-4 text-center text-xs text-gray-400 dark:border-gray-700">
                        Bu odada henüz ölçü yok.
                      </div>
                    )}
                </section>
              );
            })}
          </div>

          <aside className="xl:sticky xl:top-4 xl:self-start">
            {selectedSelection ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/50">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">
                  Seçili Ölçü
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h4 className="text-lg font-black text-gray-900 dark:text-white">
                    {resolveMeasurementExplorerLabel(
                      selectedSelection.item.measurementLabel,
                      selectedSelection.item.fallbackIndex || 1,
                    )}
                  </h4>
                  {selectedSelection.item.highlighted && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                      Yeni
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs font-semibold text-gray-600 dark:text-gray-300">
                  {selectedSelection.roomName}
                  {selectedSelection.openingName
                    ? ` → ${selectedSelection.openingName}`
                    : " → Doğrudan oda ölçüsü"}
                </p>
                <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
                  <div className="text-sm font-bold text-gray-900 dark:text-white">
                    {selectedSelection.item.summary}
                  </div>
                  <div className="mt-1 text-[11px] text-gray-500">
                    {selectedSelection.item.templateLabel}
                  </div>
                  {(selectedSelection.item.measuredAt ||
                    selectedSelection.item.measuredBy) && (
                    <div className="mt-2 text-[10px] text-gray-500">
                      {selectedSelection.item.measuredAt || ""}
                      {selectedSelection.item.measuredAt &&
                      selectedSelection.item.measuredBy
                        ? " · "
                        : ""}
                      {selectedSelection.item.measuredBy || ""}
                    </div>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">
                  {onOpenVisualReport && (
                    <button
                      type="button"
                      onClick={onOpenVisualReport}
                      className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-2 text-[11px] font-black text-blue-700 hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300"
                    >
                      Görsel Rapor
                    </button>
                  )}
                  {onOpenSalesPreparation && (
                    <button
                      type="button"
                      onClick={() =>
                        onOpenSalesPreparation(
                          selectedSelection.roomId,
                        )
                      }
                      className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] font-black text-amber-800 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300"
                    >
                      Satışa Hazırlık
                    </button>
                  )}
                  {onTransferToSale && (
                    <button
                      type="button"
                      onClick={onTransferToSale}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-[11px] font-black text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
                    >
                      Satışa Aktar
                    </button>
                  )}
                  {onShareWhatsApp && (
                    <button
                      type="button"
                      onClick={onShareWhatsApp}
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-[11px] font-black text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"
                    >
                      WhatsApp Kısa Rapor
                    </button>
                  )}
                </div>

                {onRecoverMeasurements && (
                  <details className="mt-3 rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-gray-800 dark:bg-gray-900">
                    <summary className="cursor-pointer text-[11px] font-bold text-gray-500">
                      Diğer işlemler
                    </summary>
                    <button
                      type="button"
                      onClick={onRecoverMeasurements}
                      disabled={isRecovering}
                      className="mt-2 w-full rounded-lg bg-gray-100 px-3 py-2 text-left text-[11px] font-bold text-gray-600 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      {isRecovering
                        ? "Ölçü Kurtar çalışıyor..."
                        : "Ölçü Kurtar"}
                    </button>
                  </details>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700">
                Bir ölçü seçildiğinde hızlı rapor ve satış aksiyonları burada görünür.
              </div>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
