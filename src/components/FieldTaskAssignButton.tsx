"use client";

import { useMeasurementStore } from "@/store/measurementStore";

import {
  BellRing,
  CalendarClock,
  MapPin,
  Ruler,
  X
} from "lucide-react";
import {
  useMemo,
  useState
} from "react";
import {
  createFieldTask,
  putFieldTask
} from "@/lib/localFieldTaskDb";
import {
  createRemoteFieldTask
} from "@/lib/fieldTaskSyncClient";
import {
  useAuthStore
} from "@/store/useAuthStore";
import {
  normalizeRole,
  type MockUser
} from "@/store/useAuthStore";

interface FieldTaskAssignButtonProps {
  customer: any;
  currentUser: MockUser | null;
  users: MockUser[];
  onAssigned?: (
    message: string
  ) => void;
}

function defaultDateTime(): string {
  const date =
    new Date(
      Date.now() +
        30 * 60 * 1000
    );

  const offset =
    date.getTimezoneOffset();

  return new Date(
    date.getTime() -
      offset * 60 * 1000
  )
    .toISOString()
    .slice(0, 16);
}

function cleanTaskSnapshot(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(cleanTaskSnapshot);
  }

  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(
      value as Record<string, unknown>
    )) {
      if (
        key === "photos" ||
        key === "videos" ||
        key === "addressPhotos"
      ) {
        result[key] = [];
        continue;
      }

      result[key] = cleanTaskSnapshot(item);
    }

    return result;
  }

  if (
    typeof value === "string" &&
    (
      value.startsWith("data:") ||
      value.includes(";base64,") ||
      value.length > 5000
    )
  ) {
    return "";
  }

  return value;
}

function buildTaskCustomerSnapshot(
  customer: any
): Record<string, unknown> {
  const measurements =
    useMeasurementStore
      .getState()
      .measurements
      .filter(
        measurement =>
          measurement.customerId === customer.id &&
          !measurement.isDeleted &&
          !measurement.isArchived
      )
      .map(measurement =>
        cleanTaskSnapshot(measurement)
      );

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    customer: cleanTaskSnapshot(customer),
    measurements
  };
}
export function FieldTaskAssignButton({
  customer,
  currentUser,
  users,
  onAssigned
}: FieldTaskAssignButtonProps) {
  const sessionToken =
    useAuthStore(
      state => state.sessionToken
    );

  const [open, setOpen] =
    useState(false);

  const [assignedUserId,
    setAssignedUserId] =
    useState("");

  const [scheduledAt,
    setScheduledAt] =
    useState(
      defaultDateTime()
    );

  const [note, setNote] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const fieldUsers =
    useMemo(
      () =>
        users.filter(
          user =>
            user.isActive !== false &&
            normalizeRole(
              user.role
            ) === "FIELD"
        ),
      [users]
    );

  const canAssign =
    currentUser &&
    [
      "ADMIN",
      "MODERATOR",
      "OFFICE"
    ].includes(
      normalizeRole(
        currentUser.role
      )
    );

  if (!canAssign) return null;

  const handleOpen =
    () => {
      setAssignedUserId(
        fieldUsers[0]?.id || ""
      );

      setScheduledAt(
        defaultDateTime()
      );

      setNote("");
      setOpen(true);
    };

  const handleSave =
    async () => {
      if (
        !currentUser ||
        !assignedUserId
      ) {
        alert(
          "Ölçü personeli seçilmelidir."
        );
        return;
      }

      const fieldUser =
        fieldUsers.find(
          user =>
            user.id ===
            assignedUserId
        );

      if (!fieldUser) {
        alert(
          "Seçilen saha personeli bulunamadı."
        );
        return;
      }

      setSaving(true);

      try {
        const localTask =
          await createFieldTask({
            customerId:
              customer.id,
            customerName:
              customer.name ||
              "İsimsiz Cari",
            customerPhone:
              customer.phone || "",
            customerAddress:
              customer.address || "",
            mapLocation:
              customer.mapLocation || "",

            customerSnapshot:
              buildTaskCustomerSnapshot(
                customer
              ),

            assignedUserId:
              fieldUser.id,
            assignedUserName:
              fieldUser.name,

            assignedById:
              currentUser.id,
            assignedByName:
              currentUser.name,

            scheduledAt:
              scheduledAt
                ? new Date(
                    scheduledAt
                  ).toISOString()
                : undefined,

            note:
              note.trim()
          });

        if (!sessionToken) {
          throw new Error(
            "Oturum anahtarı bulunamadı."
          );
        }

        const remoteTask =
          await createRemoteFieldTask(
            localTask,
            sessionToken
          );

        await putFieldTask(
          remoteTask
        );

        setOpen(false);

        onAssigned?.(
          `Ölçü görevi ${fieldUser.name} personeline gönderildi.`
        );
      } catch (error) {
        console.error(
          "Field task create error:",
          error
        );

        alert(
          "Ölçü görevi kaydedilemedi."
        );
      } finally {
        setSaving(false);
      }
    };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-bold shadow-sm transition-colors"
        title="Cariyi saha personeline ölçü görevi olarak ata"
      >
        <Ruler className="w-4 h-4" />
        Ölçü Görevi Ata
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
              <div>
                <h2 className="font-bold text-lg text-gray-900 dark:text-white">
                  Ölçü Görevi Ata
                </h2>
                <p className="text-sm text-gray-500">
                  {customer.name}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setOpen(false)
                }
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">
                  Saha Personeli
                </label>

                <select
                  value={
                    assignedUserId
                  }
                  onChange={event =>
                    setAssignedUserId(
                      event.target.value
                    )
                  }
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 p-3"
                >
                  {fieldUsers.length ===
                    0 && (
                    <option value="">
                      Aktif FIELD personeli bulunamadı
                    </option>
                  )}

                  {fieldUsers.map(
                    user => (
                      <option
                        key={user.id}
                        value={user.id}
                      >
                        {user.name}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">
                  <CalendarClock className="w-4 h-4" />
                  Tarih ve Saat
                </label>

                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={event =>
                    setScheduledAt(
                      event.target.value
                    )
                  }
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 p-3"
                />
              </div>

              <div className="rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-3 text-sm">
                <div className="font-semibold">
                  {customer.phone ||
                    "Telefon yok"}
                </div>

                <div className="flex items-start gap-2 mt-2 text-gray-600 dark:text-gray-400">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    {customer.address ||
                      customer.mapLocation ||
                      "Adres/konum girilmemiş"}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">
                  Görev Notu
                </label>

                <textarea
                  value={note}
                  onChange={event =>
                    setNote(
                      event.target.value
                    )
                  }
                  rows={3}
                  placeholder="Trinity B Blok, müşteri saat 14.00'te evde..."
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 p-3 resize-y"
                />
              </div>

              <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 p-3 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
                <BellRing className="w-4 h-4 shrink-0 mt-0.5" />
                Uygulama açıkken saha personeline sesli ve titreşimli yeni görev uyarısı verilir.
              </div>
            </div>

            <div className="flex gap-3 justify-end p-4 border-t border-gray-200 dark:border-gray-800">
              <button
                type="button"
                onClick={() =>
                  setOpen(false)
                }
                className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 font-semibold"
              >
                Vazgeç
              </button>

              <button
                type="button"
                onClick={
                  handleSave
                }
                disabled={
                  saving ||
                  !assignedUserId
                }
                className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold disabled:opacity-50"
              >
                {saving
                  ? "Atanıyor..."
                  : "Görevi Ata"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}




