"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import type { ErpPackage } from "@/lib/packageFeatures";

type ShadowStatus =
  | { state: "loading" }
  | { state: "missing-session" }
  | {
      state: "ready";
      package: ErpPackage;
      evaluatedFeatureCount: number;
      differenceCount: number;
      measurementPilotMode: string;
    }
  | { state: "not-configured"; reason: string }
  | { state: "error" };

type ShadowApiPayload = {
  success?: boolean;
  configured?: boolean;
  reason?: string;
  context?: {
    package?: ErpPackage;
  };
  accessSummary?: {
    evaluatedFeatureCount?: number;
    differenceCount?: number;
  };
  measurementPilot?: {
    mode?: string;
  };
};

export default function ErpContextShadowCard() {
  const sessionToken = useAuthStore((state) => state.sessionToken);
  const [status, setStatus] = useState<ShadowStatus>({
    state: "loading",
  });

  useEffect(() => {
    if (!sessionToken) {
      return;
    }

    const controller = new AbortController();

    const load = async () => {
      setStatus({ state: "loading" });

      try {
        const response = await fetch("/api/erp-context", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json()) as ShadowApiPayload;

        if (
          response.ok &&
          payload.success === true &&
          payload.configured === true &&
          payload.context?.package
        ) {
          setStatus({
            state: "ready",
            package: payload.context.package,
            evaluatedFeatureCount:
              payload.accessSummary?.evaluatedFeatureCount ?? 0,
            differenceCount:
              payload.accessSummary?.differenceCount ?? 0,
            measurementPilotMode:
              payload.measurementPilot?.mode ?? "shadow",
          });
          return;
        }

        if (
          response.ok &&
          payload.success === true &&
          payload.configured === false
        ) {
          setStatus({
            state: "not-configured",
            reason: payload.reason || "UNKNOWN",
          });
          return;
        }

        setStatus({ state: "error" });
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }
        setStatus({ state: "error" });
      }
    };

    void load();

    return () => {
      controller.abort();
    };
  }, [sessionToken]);

  const displayedStatus: ShadowStatus = sessionToken
    ? status
    : { state: "missing-session" };

  const summary =
    displayedStatus.state === "ready"
      ? `Kapsam hazır • Paket ${displayedStatus.package}`
      : displayedStatus.state === "loading"
        ? "Paket ve kapsam doğrulanıyor…"
        : displayedStatus.state === "not-configured"
          ? `Gölge kapsam hazır değil • ${displayedStatus.reason}`
          : displayedStatus.state === "missing-session"
            ? "Doğrulanmış oturum bulunamadı."
            : "Gölge kapsam okunamadı.";

  const ready = displayedStatus.state === "ready";

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-3 border-b border-gray-200 p-5 dark:border-gray-800">
        <ShieldCheck
          className={`h-5 w-5 ${
            ready ? "text-emerald-600" : "text-amber-600"
          }`}
        />
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white">
            Paket ve Kapsam Gölge Kontrolü
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Yalnız tanı amaçlıdır; ekran ve yetki kararlarını değiştirmez.
          </p>
        </div>
      </div>
      <div className="p-5">
        <div
          className={`rounded-lg border px-4 py-3 text-sm font-semibold ${
            ready
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
              : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300"
          }`}
        >
          {summary}
        </div>
        {displayedStatus.state === "ready" && (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-800">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Karşılaştırılan özellik
              </div>
              <div className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
                {displayedStatus.evaluatedFeatureCount}
              </div>
            </div>
            <div
              className={`rounded-lg border px-4 py-3 ${
                displayedStatus.differenceCount === 0
                  ? "border-emerald-200 dark:border-emerald-900"
                  : "border-amber-200 dark:border-amber-900"
              }`}
            >
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Mevcut erişimle fark
              </div>
              <div className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
                {displayedStatus.differenceCount}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-800">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Ölçü pilot modu
              </div>
              <div className="mt-1 text-lg font-bold uppercase text-gray-900 dark:text-white">
                {displayedStatus.measurementPilotMode}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
