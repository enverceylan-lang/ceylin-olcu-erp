"use client";

import { useEffect } from "react";
import {
  listFieldTasksForUser
} from "@/lib/localFieldTaskDb";
import {
  normalizeRole,
  useAuthStore
} from "@/store/useAuthStore";

const STORAGE_PREFIX =
  "ceylin-field-task-notified:";

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
    // Cihaz ses üretimini desteklemiyorsa sessiz devam et.
  }
}

function notifyTask(
  customerName: string,
  note?: string
): void {
  playTaskSound();

  if (
    "vibrate" in navigator
  ) {
    navigator.vibrate([
      180,
      100,
      180
    ]);
  }

  if (
    "Notification" in window &&
    Notification.permission ===
      "granted"
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

  useEffect(() => {
    if (
      !currentUser ||
      normalizeRole(
        currentUser.role
      ) !== "FIELD"
    ) {
      return;
    }

    let cancelled = false;

    const checkTasks =
      async () => {
        const tasks =
          await listFieldTasksForUser(
            currentUser.id
          );

        if (cancelled) return;

        const pending =
          tasks.filter(
            task =>
              task.status !==
                "COMPLETED" &&
              task.status !==
                "CANCELLED"
          );

        for (
          const task of pending
        ) {
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
      };

    void checkTasks();

    const intervalId =
      window.setInterval(
        () => {
          void checkTasks();
        },
        5000
      );

    const handleUpdate =
      () => {
        void checkTasks();
      };

    window.addEventListener(
      "field-tasks-updated",
      handleUpdate
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
    };
  }, [currentUser]);

  return null;
}
