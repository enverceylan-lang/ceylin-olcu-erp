"use client";

import { useEffect } from "react";
import {
  listFieldTasksForUser,
  upsertRemoteFieldTasks
} from "@/lib/localFieldTaskDb";
import {
  fetchRemoteFieldTasks
} from "@/lib/fieldTaskSyncClient";
import {
  normalizeRole,
  useAuthStore
} from "@/store/useAuthStore";

const STORAGE_PREFIX =
  "ceylin-field-task-notified:";

const LAST_SYNC_PREFIX =
  "ceylin-field-task-last-sync:";

function playTaskSound(): void {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (
        window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext;

    if (!AudioContextClass) return;

    const context =
      new AudioContextClass();

    const oscillator =
      context.createOscillator();

    const gain =
      context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = 880;

    gain.gain.setValueAtTime(
      0.0001,
      context.currentTime
    );

    gain.gain.exponentialRampToValueAtTime(
      0.22,
      context.currentTime + 0.02
    );

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      context.currentTime + 0.42
    );

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start();
    oscillator.stop(
      context.currentTime + 0.45
    );
  } catch {
    // Sessiz devam et.
  }
}

function notifyTask(
  customerName: string,
  note?: string
): void {
  playTaskSound();

  if ("vibrate" in navigator) {
    navigator.vibrate([
      180,
      100,
      180
    ]);
  }

  if (
    "Notification" in window &&
    Notification.permission === "granted"
  ) {
    new Notification(
      "CEYLİN Ölçü – Yeni İş Emri",
      {
        body:
          `${customerName}` +
          (
            note
              ? `\n${note}`
              : ""
          ),
        tag:
          `field-task-${customerName}`,
        requireInteraction: true
      }
    );
  }
}

export function FieldTaskNotifier() {
  const currentUser =
    useAuthStore(
      state => state.currentUser
    );

  const sessionToken =
    useAuthStore(
      state => state.sessionToken
    );

  useEffect(() => {
    if (
      !currentUser ||
      !sessionToken ||
      normalizeRole(
        currentUser.role
      ) !== "FIELD"
    ) {
      return;
    }

    let cancelled = false;
    let syncing = false;

    const syncKey =
      `${LAST_SYNC_PREFIX}${currentUser.id}`;

    const checkTasks =
      async () => {
        if (syncing || cancelled) return;

        syncing = true;

        try {
          const since =
            localStorage.getItem(
              syncKey
            ) || undefined;

          const result =
            await fetchRemoteFieldTasks(
              sessionToken,
              since
            );

          if (cancelled) return;

          if (result.tasks.length > 0) {
            await upsertRemoteFieldTasks(
              result.tasks
            );
          }

          localStorage.setItem(
            syncKey,
            result.serverTime
          );

          const tasks =
            await listFieldTasksForUser(
              currentUser.id
            );

          const pending =
            tasks.filter(
              task =>
                task.status !==
                  "COMPLETED" &&
                task.status !==
                  "CANCELLED"
            );

          for (const task of pending) {
            const storageKey =
              `${STORAGE_PREFIX}${currentUser.id}:${task.id}`;

            if (
              localStorage.getItem(
                storageKey
              )
            ) {
              continue;
            }

            localStorage.setItem(
              storageKey,
              "1"
            );

            notifyTask(
              task.customerName,
              task.note
            );

            window.dispatchEvent(
              new CustomEvent(
                "field-task-alert",
                {
                  detail: task
                }
              )
            );

            break;
          }
        } catch (error) {
          console.warn(
            "[Field Task Sync] Remote sync skipped:",
            error instanceof Error
              ? error.message
              : "Unknown error"
          );
        } finally {
          syncing = false;
        }
      };

    void checkTasks();

    const intervalId =
      window.setInterval(
        () => {
          if (
            document.visibilityState ===
              "visible"
          ) {
            void checkTasks();
          }
        },
        20000
      );

    const handleVisibility =
      () => {
        if (
          document.visibilityState ===
            "visible"
        ) {
          void checkTasks();
        }
      };

    const handleUpdate =
      () => {
        void checkTasks();
      };

    window.addEventListener(
      "field-tasks-updated",
      handleUpdate
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    return () => {
      cancelled = true;

      window.clearInterval(
        intervalId
      );

      window.removeEventListener(
        "field-tasks-updated",
        handleUpdate
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );
    };
  }, [
    currentUser,
    sessionToken
  ]);

  return null;
}
