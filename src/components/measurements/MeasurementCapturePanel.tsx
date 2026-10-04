"use client";

import {
  useState,
  type ReactNode,
} from "react";

export interface MeasurementCaptureOpeningOption {
  id: string;
  name: string;
}

export interface MeasurementCaptureRoomOption {
  id: string;
  name: string;
  openings: MeasurementCaptureOpeningOption[];
}

interface MeasurementCapturePanelProps {
  rooms: readonly MeasurementCaptureRoomOption[];
  selectedRoomId: string;
  selectedOpeningId: string;
  activeParentId: string | null;
  directParentId: string;
  isEditing: boolean;
  onRoomChange: (roomId: string) => void;
  onOpeningChange: (openingId: string) => void;
  onStart: (selection: {
    roomId: string;
    openingId?: string;
    parentId: string;
  }) => void;
  onCreateOpening?: (
    roomId: string,
    openingName: string,
  ) => Promise<string | null | undefined>;
  renderForm: (selection: {
    roomId: string;
    openingId?: string;
    parentId: string;
  }) => ReactNode;
}

export function MeasurementCapturePanel({
  rooms,
  selectedRoomId,
  selectedOpeningId,
  activeParentId,
  directParentId,
  isEditing,
  onRoomChange,
  onOpeningChange,
  onStart,
  onCreateOpening,
  renderForm,
}: MeasurementCapturePanelProps) {
  const [showOpeningCreate, setShowOpeningCreate] =
    useState(false);
  const [openingDraft, setOpeningDraft] = useState("");
  const [createBusy, setCreateBusy] = useState(false);

  const room =
    rooms.find(candidate => candidate.id === selectedRoomId) ||
    rooms[0];
  const opening =
    room && selectedOpeningId
      ? room.openings.find(
          candidate => candidate.id === selectedOpeningId,
        )
      : undefined;

  const createOpening = async () => {
    const name = openingDraft.trim();
    if (!name || !room || !onCreateOpening || createBusy) {
      return;
    }

    setCreateBusy(true);
    try {
      const openingId = await onCreateOpening(
        room.id,
        name,
      );
      if (openingId) {
        onOpeningChange(openingId);
        setOpeningDraft("");
        setShowOpeningCreate(false);
      }
    } finally {
      setCreateBusy(false);
    }
  };

  if (!room) {
    return (
      <section className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm dark:border-blue-900/50 dark:bg-gray-900">
        <h3 className="text-base font-black text-gray-900 dark:text-white">
          Ölçü Al
        </h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Ölçü almadan önce sayfanın üstündeki Yeni Oda Ekle aksiyonuyla bir oda oluşturun.
        </p>
      </section>
    );
  }

  const parentId = opening?.id || directParentId;
  const selection = {
    roomId: room.id,
    ...(opening ? { openingId: opening.id } : {}),
    parentId,
  };

  return (
    <section className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm dark:border-blue-900/50 dark:bg-gray-900 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-3 dark:border-gray-800">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-600 dark:text-blue-300">
            {isEditing ? "Ölçü Düzenleme" : "Yeni Ölçü"}
          </div>
          <h3 className="mt-1 text-lg font-black text-gray-900 dark:text-white">
            {room.name} için {isEditing ? "ölçüyü düzenle" : "yeni ölçü"}
          </h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {opening
              ? `Açıklık / Grup: ${opening.name}`
              : "Doğrudan oda ölçüsü"}
          </p>
        </div>
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          Müşteri ve oda bağlamı korunur
        </span>
      </div>

      <div className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-bold text-gray-600 dark:text-gray-400">
              Oda
            </label>
            <select
              value={room.id}
              onChange={event =>
                onRoomChange(event.target.value)
              }
              className="w-full rounded-lg border bg-white p-2.5 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            >
              {rooms.map(candidate => (
                <option
                  key={candidate.id}
                  value={candidate.id}
                >
                  {candidate.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[10px] text-gray-400">
              Yeni oda ekleme yalnız sayfanın ana Yeni Oda Ekle aksiyonundan yapılır.
            </p>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400">
                Ölçü Bağlantısı
              </label>
              {onCreateOpening && (
                <button
                  type="button"
                  onClick={() =>
                    setShowOpeningCreate(value => !value)
                  }
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-700"
                >
                  + Açıklık / Grup
                </button>
              )}
            </div>

            <select
              value={opening?.id || ""}
              onChange={event =>
                onOpeningChange(event.target.value)
              }
              className="w-full rounded-lg border bg-white p-2.5 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            >
              <option value="">
                Doğrudan odaya ölçü
              </option>
              {room.openings.map(candidate => (
                <option
                  key={candidate.id}
                  value={candidate.id}
                >
                  Açıklık / Grup: {candidate.name}
                </option>
              ))}
            </select>

            {showOpeningCreate && onCreateOpening && (
              <div className="mt-2 flex gap-2">
                <input
                  value={openingDraft}
                  onChange={event =>
                    setOpeningDraft(event.target.value)
                  }
                  placeholder="Açıklık / grup adı"
                  className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => void createOpening()}
                  disabled={
                    !openingDraft.trim() ||
                    createBusy
                  }
                  className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                >
                  Oluştur
                </button>
              </div>
            )}
          </div>
        </div>

        {activeParentId === parentId ? (
          renderForm(selection)
        ) : (
          <button
            type="button"
            onClick={() => onStart(selection)}
            className="w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200"
          >
            Ölçü Formunu Aç
          </button>
        )}
      </div>
    </section>
  );
}
