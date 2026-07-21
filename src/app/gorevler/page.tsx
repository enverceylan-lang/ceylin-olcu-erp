"use client";

import Link from "next/link";
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
    void loadTasks();

    const handleUpdate =
      () => {
        void loadTasks();
      };

    window.addEventListener(
      "field-tasks-updated",
      handleUpdate
    );

    return () => {
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
            task.customerSnapshot as any;

          const snapshotCustomer =
            taskSnapshot?.customer ||
            taskSnapshot;

          const snapshotRooms =
            Array.isArray(snapshotCustomer?.rooms)
              ? snapshotCustomer.rooms
              : [];

          const snapshotRoom =
            snapshotRooms.find(
              (candidate: any) =>
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
              (candidate: any) =>
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
    <div className="max-w-6xl mx-auto space-y-6 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Ruler className="w-6 h-6 text-cyan-600" />
            {isAdminView
              ? "Saha Görevleri"
              : "Görevlerim"}
          </h1>

          <p className="text-sm text-gray-500">
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
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-cyan-200 text-cyan-700 dark:text-cyan-300"
        >
          <BellRing className="w-4 h-4" />
          Bildirime İzin Ver
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center">
          Görevler yükleniyor...
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-10 text-center">
          Henüz saha görevi yok.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {tasks.map(task => (
            <article
              key={task.id}
              className={`rounded-2xl border p-5 shadow-sm ${
                task.status ===
                  "COMPLETED"
                  ? "border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/10"
                  : "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">
                    {task.customerName}
                  </h2>

                  <p className="text-xs text-gray-500 mt-1">
                    Atanan:
                    {" "}
                    {task.assignedUserName}
                  </p>
                </div>

                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300">
                  {STATUS_LABELS[
                    task.status
                  ]}
                </span>
              </div>

              <div className="space-y-2 mt-4 text-sm">
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
                  <div className="rounded-xl bg-gray-50 dark:bg-gray-950 p-3">
                    {task.note}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-5">
                <button
                  type="button"
                  onClick={() =>
                    void handleOpenCustomer(
                      task
                    )
                  }
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-bold"
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
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 text-sm font-bold"
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
                      className="px-3 py-2 rounded-xl bg-amber-500 text-white text-sm font-bold"
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
                      className="px-3 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold"
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
                      className="px-3 py-2 rounded-xl bg-purple-600 text-white text-sm font-bold"
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
                      className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-green-600 text-white text-sm font-bold"
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







