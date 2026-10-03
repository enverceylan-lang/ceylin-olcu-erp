"use client";

import type { ReactNode } from "react";

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
  onRoomChange,
  onOpeningChange,
  onStart,
  renderForm,
}: MeasurementCapturePanelProps) {
  if (rooms.length === 0) {
    return (
      <div className="mb-6 rounded-2xl border border-blue-200 bg-white p-4 shadow-sm dark:border-blue-900/50 dark:bg-gray-900">
        <div className="py-8 text-center text-sm text-gray-500">
          Önce bir oda oluşturun.
        </div>
      </div>
    );
  }

  const room =
    rooms.find(candidate => candidate.id === selectedRoomId) ||
    rooms[0];
  const opening = selectedOpeningId
    ? room.openings.find(
        candidate => candidate.id === selectedOpeningId,
      )
    : undefined;
  const parentId = opening?.id || directParentId;
  const selection = {
    roomId: room.id,
    ...(opening ? { openingId: opening.id } : {}),
    parentId,
  };

  return (
    <div className="mb-6 rounded-2xl border border-blue-200 bg-white p-4 shadow-sm dark:border-blue-900/50 dark:bg-gray-900">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
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
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-gray-600 dark:text-gray-400">
              Bağlantı
            </label>
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
                  Açıklık: {candidate.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {activeParentId === parentId ? (
          renderForm(selection)
        ) : (
          <button
            type="button"
            onClick={() => onStart(selection)}
            className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700"
          >
            {opening
              ? "Bu Açıklığa Ölçü Al"
              : "Bu Odanın Ölçüsünü Al"}
          </button>
        )}
      </div>
    </div>
  );
}
