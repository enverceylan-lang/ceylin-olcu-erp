"use client";

import { useRouter } from "next/navigation";
import {
  BellRing,
  CalendarClock,
  CheckCircle2,
  MapPin,
  Navigation,
  Phone,
  Ruler
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  type FieldTask,
  type FieldTaskStatus,
  listAllFieldTasks,
  listFieldTasksForUser,
  markFieldTaskSeen,
  putFieldTask,
  updateFieldTaskStatus,
  upsertRemoteFieldTasks
} from "@/lib/localFieldTaskDb";
import {
  fetchRemoteFieldTasks,
  updateRemoteFieldTask
} from "@/lib/fieldTaskSyncClient";
import {
  normalizeRole,
  useAuthStore
} from "@/store/useAuthStore";
import {
  ensureFieldTaskCustomer
} from "@/lib/fieldTaskCustomerBridge";

import {
  pushDeltaSyncEvents
} from "@/lib/deltaSyncClient";

import {
  useMeasurementStore
} from "@/store/measurementStore";

import {
  saveLocalMeasurementWithSync
} from "@/lib/localMeasurementDb";

const STATUS_LABELS:
Record<FieldTaskStatus, string> = {
  ASSIGNED: "Atandı",
  ON_THE_WAY: "Yolda",
  MEASUREMENT_STARTED:
    "Ölçü Başladı",
  MEASUREMENT_TAKEN:
    "Ölçü Alındı",
  COMPLETED: "Tamamlandı",
  CANCELLED: "İptal"
};

interface FieldTaskSnapshotOpening {
  id?: string;
  name?: string;
}

interface FieldTaskSnapshotRoom {
  id?: string;
  name?: string;
  windows?: FieldTaskSnapshotOpening[];
  openings?: FieldTaskSnapshotOpening[];
}

interface FieldTaskSnapshot {
  customer?: {
    rooms?: FieldTaskSnapshotRoom[];
  };
  rooms?: FieldTaskSnapshotRoom[];
}

function formatDate(
  value?: string
): string {
  if (!value) return "Tarih belirtilmedi";

  return new Intl.DateTimeFormat(
    "tr-TR",
    {
      dateStyle: "medium",
      timeStyle: "short"
    }
  ).format(new Date(value));
}

export default function FieldTasksPage() {
  const router =
    useRouter();

  const currentUser =
    useAuthStore(
      state => state.currentUser
    );

  const sessionToken =
    useAuthStore(
      state => state.sessionToken
    );

  const [tasks, setTasks] =
    useState<FieldTask[]>([]);

  const [loading, setLoading] =
    useState(true);

  const isAdminView =
    currentUser
      ? [
          "ADMIN",
          "MODERATOR",
          "OFFICE"
        ].includes(
          normalizeRole(
            currentUser.role
          )
        )
      : false;

  const loadTasks =
    useCallback(async () => {
      if (!currentUser) {
        setTasks([]);
        setLoading(false);
        return;
      }

      if (sessionToken) {
        try {
          const remote =
            await fetchRemoteFieldTasks(
              sessionToken
            );

          await upsertRemoteFieldTasks(
            remote.tasks
          );
        } catch (error) {
          console.warn(
            "[Field Tasks Page] Remote load skipped:",
            error instanceof Error
              ? error.message
              : "Unknown error"
          );
        }
      }

      const rows =
        isAdminView
          ? await listAllFieldTasks()
          : await listFieldTasksForUser(
              currentUser.id
            );

      setTasks(rows);
      setLoading(false);
    }, [
      currentUser,
      isAdminView,
      sessionToken
    ]);

  useEffect(() => {
    const loadTimer = window.setTimeout(
      () => void loadTasks(),
      0
    );

    const handleUpdate =
      () => {
        void loadTasks();
      };

    window.addEventListener(
      "field-tasks-updated",
      handleUpdate
    );

    return () => {
      window.clearTimeout(loadTimer);
      window.removeEventListener(
        "field-tasks-updated",
        handleUpdate
      );
    };
  }, [loadTasks]);

  const activeTasks =
    useMemo(
      () =>
        tasks.filter(
          task =>
            task.status !==
              "COMPLETED" &&
            task.status !==
              "CANCELLED"
        ),
      [tasks]
    );

  const handleOpenCustomer =
    async (
      task: FieldTask,
    ) => {
      try {
        await markFieldTaskSeen(
          task.id,
        );

        if (!sessionToken) {
          throw new Error(
            "Oturum anahtarı bulunamadı."
          );
        }

        await ensureFieldTaskCustomer(
          task,
          sessionToken,
        );

        router.push(
          `/cariler/${task.customerId}?fieldTaskId=${task.id}&mode=measurement`,
        );
      } catch (error) {
        console.error(
          "[Field Tasks] Customer preparation failed:",
          error,
        );

        alert(
          error instanceof Error
            ? `Görev carisi hazırlanamadı: ${error.message}`
            : "Görev carisi saha cihazında hazırlanamadı."
        );
      }
    };
  const handleStatus =
    async (
      task: FieldTask,
      status: FieldTaskStatus
    ) => {
      await updateFieldTaskStatus(
        task.id,
        status
      );

      await markFieldTaskSeen(
        task.id
      );

      if (sessionToken) {
        try {
          const remoteTask =
            await updateRemoteFieldTask(
              task.id,
              status,
              sessionToken,
              true
            );

          await putFieldTask(
            remoteTask
          );
        } catch (error) {
          console.warn(
            "[Field Tasks Page] Remote status update failed:",
            error instanceof Error
              ? error.message
              : "Unknown error"
          );

          alert(
            "Durum telefona kaydedildi fakat sunucuya henüz gönderilemedi."
          );
        }
      }

      await loadTasks();
    };

  const handleSendMeasurement =
    async (
      task: FieldTask
    ) => {
      try {
        const taskMeasurements =
          useMeasurementStore
            .getState()
            .measurements
            .filter(
              measurement =>
                measurement.customerId ===
                  task.customerId &&
                !measurement.isDeleted &&
                !measurement.isArchived
            );

        if (
          taskMeasurements.length === 0
        ) {
          alert(
            "Bu görev için kayıtlı ölçü bulunamadı. Önce ölçüyü kaydedin."
          );
          return;
        }

        /*
         * Görev ölçüleri snapshot veya eski cari ağacından gelmiş olsa bile
         * gönderim öncesinde bağımsız MEASUREMENT olayına dönüştürülür.
         */
        for (const measurement of taskMeasurements) {
          const taskSnapshot =
            task.customerSnapshot as FieldTaskSnapshot;

          const snapshotCustomer =
            taskSnapshot?.customer ||
            taskSnapshot;

          const snapshotRooms =
            Array.isArray(snapshotCustomer?.rooms)
              ? snapshotCustomer.rooms
              : [];

          const snapshotRoom =
            snapshotRooms.find(
              candidate =>
                candidate?.id === measurement.roomId
            );

          const snapshotOpenings =
            Array.isArray(snapshotRoom?.windows)
              ? snapshotRoom.windows
              : Array.isArray(snapshotRoom?.openings)
                ? snapshotRoom.openings
                : [];

          const measurementOpeningId =
            measurement.openingId ||
            measurement.windowId ||
            "";

          const snapshotOpening =
            snapshotOpenings.find(
              candidate =>
                candidate?.id === measurementOpeningId
            );
          await saveLocalMeasurementWithSync(
            {
              ...measurement,
              customerId: task.customerId,
              openingId:
                measurement.openingId ||
                measurement.windowId ||
                "",
              windowId:
                measurement.windowId ||
                measurement.openingId ||
                "",

              roomName:
                snapshotRoom?.name ||
                measurement.roomName ||
                measurement.roomLabel ||
                "İsimsiz Oda",

              roomLabel:
                snapshotRoom?.name ||
                measurement.roomLabel ||
                measurement.roomName ||
                "İsimsiz Oda",

              openingName:
                snapshotOpening?.name ||
                measurement.openingName ||
                measurement.windowName ||
                measurement.openingLabel ||
                "İsimsiz Açıklık",

              openingLabel:
                snapshotOpening?.name ||
                measurement.openingLabel ||
                measurement.openingName ||
                measurement.windowName ||
                "İsimsiz Açıklık",

              windowName:
                snapshotOpening?.name ||
                measurement.windowName ||
                measurement.openingName ||
                measurement.openingLabel ||
                "İsimsiz Açıklık",

              updatedAt:
                new Date().toISOString()
            },
            currentUser?.name ||
              currentUser?.username ||
              "FIELD"
          );
        }

        const result =
          await pushDeltaSyncEvents();

        if (!result.success) {
          const message =
            result.errors?.length
              ? result.errors.join(", ")
              : "Ölçüler sunucuya gönderilemedi.";

          alert(
            `Gönderme başarısız: ${message}`
          );
          return;
        }

        if (
          result.pushedCount === 0
        ) {
          /*
           * Ölçü daha önce başarıyla gönderilmiş olabilir.
           * Yerel ölçü bulunduğu için görev durumuna devam edilir.
           */
          console.info(
            "[Field Task] Bekleyen yeni ölçü kuyruğu bulunmadı."
          );
        }

        await handleStatus(
          task,
          "MEASUREMENT_TAKEN"
        );

        alert(
          result.pushedCount > 0
            ? `${result.pushedCount} kayıt mağazaya gönderildi.`
            : "Ölçü daha önce gönderilmiş. Görev güncellendi."
        );
      } catch (error) {
        console.error(
          "[Field Task] Measurement send failed:",
          error
        );

        alert(
          error instanceof Error
            ? `Ölçü gönderilemedi: ${error.message}`
            : "Ölçü gönderilemedi."
        );
      }
    };
  const handleStartMeasurement =
    async (
      task: FieldTask,
    ) => {
      await handleStatus(
        task,
        "MEASUREMENT_STARTED",
      );

      if (!sessionToken) {
        throw new Error(
          "Oturum anahtarı bulunamadı."
        );
      }

      await ensureFieldTaskCustomer(
        task,
        sessionToken,
      );

      router.push(
        `/cariler/${task.customerId}?fieldTaskId=${task.id}&mode=measurement`,
      );
    };

  if (!currentUser) {
    return (
      <div className="p-8">
        Oturum bulunamadı.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-1 pb-24 sm:px-2">
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">
            <Ruler className="w-6 h-6 text-cyan-600" />
            {isAdminView
              ? "Saha Görevleri"
              : "Görevlerim"}
          </h1>

          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
            Aktif görev:
            {" "}
            {activeTasks.length}
          </p>
        </div>

        <button
          type="button"
          onClick={async () => {
            if (
              "Notification" in window &&
              Notification.permission ===
                "default"
            ) {
              await Notification.requestPermission();
            }
          }}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-sm font-bold text-cyan-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-cyan-100 dark:border-cyan-900/70 dark:bg-cyan-950/30 dark:text-cyan-300"
        >
          <BellRing className="w-4 h-4" />
          Bildirime İzin Ver
        </button>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-sm font-medium text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          Görevler yükleniyor...
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/70 p-12 text-center text-sm font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
          Henüz saha görevi yok.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {tasks.map(task => (
            <article
              key={task.id}
              className={`group rounded-3xl border p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                task.status ===
                  "COMPLETED"
                  ? "border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/10"
                  : "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black tracking-tight text-slate-950 dark:text-white">
                    {task.customerName}
                  </h2>

                  <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                    Atanan:
                    {" "}
                    {task.assignedUserName}
                  </p>
                </div>

                <span className="inline-flex min-h-7 shrink-0 items-center rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-800 dark:border-cyan-900/70 dark:bg-cyan-950/30 dark:text-cyan-300">
                  {STATUS_LABELS[
                    task.status
                  ]}
                </span>
              </div>

              <div className="mt-5 space-y-2.5 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-sm dark:border-slate-800 dark:bg-slate-950/40">
                <div className="flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-gray-500" />
                  {formatDate(
                    task.scheduledAt
                  )}
                </div>

                {task.customerPhone && (
                  <a
                    href={`tel:${task.customerPhone}`}
                    className="flex items-center gap-2 text-blue-600"
                  >
                    <Phone className="w-4 h-4" />
                    {task.customerPhone}
                  </a>
                )}

                <div className="flex items-start gap-2 text-gray-600 dark:text-gray-300">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                  {task.customerAddress ||
                    task.mapLocation ||
                    "Adres yok"}
                </div>

                {task.note && (
                  <div className="rounded-xl border border-slate-200 bg-white p-3 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                    {task.note}
                  </div>
                )}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2.5 border-t border-slate-100 pt-4 sm:grid-cols-3 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() =>
                    void handleOpenCustomer(
                      task
                    )
                  }
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-3 py-2.5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-cyan-700"
                >
                  <Ruler className="w-4 h-4" />
                  Cariyi Aç
                </button>

                {task.mapLocation && (
                  <a
                    href={
                      task.mapLocation
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Navigation className="w-4 h-4" />
                    Yol Tarifi
                  </a>
                )}

                {!isAdminView &&
                  task.status ===
                    "ASSIGNED" && (
                    <button
                      type="button"
                      onClick={() =>
                        void handleStatus(
                          task,
                          "ON_THE_WAY"
                        )
                      }
                      className="min-h-11 rounded-xl bg-amber-500 px-3 py-2.5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-amber-600"
                    >
                      Yola Çıktım
                    </button>
                  )}

                {!isAdminView &&
                  (
                    task.status ===
                      "ASSIGNED" ||
                    task.status ===
                      "ON_THE_WAY"
                  ) && (
                    <button
                      type="button"
                      onClick={() =>
                        void handleStartMeasurement(
                          task
                        )
                      }
                      className="min-h-11 rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-700"
                    >
                      Ölçüye Başla
                    </button>
                  )}

                {!isAdminView &&
                  task.status ===
                    "MEASUREMENT_STARTED" && (
                    <button
                      type="button"
                      onClick={() =>
                        void handleSendMeasurement(
                          task
                        )
                      }
                      className="min-h-11 rounded-xl bg-purple-600 px-3 py-2.5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-purple-700"
                    >
                      Ölçü Alındı
                    </button>
                  )}

                {!isAdminView &&
                  task.status ===
                    "MEASUREMENT_TAKEN" && (
                    <button
                      type="button"
                      onClick={() =>
                        void handleStatus(
                          task,
                          "COMPLETED"
                        )
                      }
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-green-600 px-3 py-2.5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-green-700"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Tamamla
                    </button>
                  )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}







