"use client";

import {
  useMemo,
  useState
} from "react";
import {
  canViewAgendaEvent
} from "@/lib/operationAccessPolicy";
import {
  getPackageDisplayLabel,
  packageInputHasFeature
} from "@/lib/packageFeatures";
import {
  getOperationStatusLabel
} from "@/lib/operationOutputService";
import {
  useErpRuntimeContext
} from "@/lib/useErpRuntimeContext";
import type {
  AgendaEvent,
  OperationKind
} from "@/lib/operationsWorkflow";
import {
  useAuthStore
} from "@/store/useAuthStore";
import {
  useOperationsStore
} from "@/store/useOperationsStore";

type AgendaFilter =
  | "ALL"
  | OperationKind;

function dayKey(value: string): string {
  return new Date(value)
    .toISOString()
    .slice(0, 10);
}

export default function AgendaPage() {
  const {
    scope,
    packageName,
    loading,
    error,
    reload
  } = useErpRuntimeContext();

  const currentUser =
    useAuthStore(
      state => state.currentUser
    );

  const operations =
    useOperationsStore(
      state => state.operations
    );

  const agendaEvents =
    useOperationsStore(
      state => state.agendaEvents
    );

  const [filter, setFilter] =
    useState<AgendaFilter>("ALL");

  const [showCompleted, setShowCompleted] =
    useState(false);

  const groups = useMemo(() => {
    if (!scope || !currentUser) {
      return [];
    }

    const filtered = agendaEvents
      .filter(event => {
        const operation =
          operations.find(
            item =>
              item.id ===
              event.operationId
          );

        return canViewAgendaEvent(
          event,
          operation,
          scope,
          {
            userId: currentUser.id,
            role: currentUser.role
          }
        );
      })
      .filter(event =>
        filter === "ALL"
          ? true
          : event.kind === filter
      )
      .filter(event =>
        showCompleted
          ? true
          : event.status !== "COMPLETED"
      )
      .sort((left, right) =>
        left.startsAt.localeCompare(
          right.startsAt
        )
      );

    const result =
      new Map<string, AgendaEvent[]>();

    for (const event of filtered) {
      const key = dayKey(event.startsAt);
      const current =
        result.get(key) ?? [];

      result.set(
        key,
        [...current, event]
      );
    }

    return Array.from(result.entries());
  }, [
    agendaEvents,
    operations,
    scope,
    currentUser,
    filter,
    showCompleted
  ]);

  const agendaPackageAllowed =
    packageInputHasFeature(
      packageName,
      "agenda"
    );

  if (
    !loading &&
    scope &&
    !agendaPackageAllowed
  ) {
    return (
      <main className="mx-auto max-w-5xl p-4 md:p-6">
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-6">
          <h1 className="text-xl font-bold text-amber-900">
            Ajanda paketinize dahil değil
          </h1>

          <p className="mt-2 text-sm text-amber-800">
            Aktif paket:{" "}
            {getPackageDisplayLabel(packageName)}
          </p>

          <p className="mt-2 text-sm text-amber-800">
            Ajanda modülü için STANDARD veya
            PLUS paket gerekir.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl p-4 pb-24 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Ajanda
        </h1>

        <p className="mt-1 text-sm text-slate-600">
          Terzi çıkış, tedarikçi termin ve
          montaj tarihlerini takip edin.
        </p>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Şirket, şube ve dönem kapsamı yükleniyor…
        </div>
      ) : null}

      {!loading && error ? (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm text-red-700">
            Ajanda gösterilemiyor: {error}
          </p>

          <button
            type="button"
            onClick={() => void reload()}
            className="mt-3 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700"
          >
            Kapsamı Yeniden Yükle
          </button>
        </div>
      ) : null}

      {!loading && scope && currentUser ? (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <select
              value={filter}
              onChange={event =>
                setFilter(
                  event.target.value as
                    AgendaFilter
                )
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="ALL">
                Tüm İşler
              </option>

              <option value="TAILOR">
                Terzi
              </option>

              <option value="SUPPLIER">
                Tedarikçi
              </option>

              <option value="INSTALLATION">
                Montaj
              </option>
            </select>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={event =>
                  setShowCompleted(
                    event.target.checked
                  )
                }
              />

              Tamamlananları göster
            </label>
          </div>

          {groups.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
              Yetkinize ve aktif kapsamınıza uygun Ajanda kaydı bulunmuyor.
            </div>
          ) : (
            <div className="space-y-6">
              {groups.map(
                ([date, events]) => (
                  <section key={date}>
                    <h2 className="mb-3 text-lg font-semibold text-slate-900">
                      {new Date(
                        `${date}T00:00:00`
                      ).toLocaleDateString(
                        "tr-TR",
                        {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric"
                        }
                      )}
                    </h2>

                    <div className="space-y-3">
                      {events.map(event => {
                        const late =
                          event.status !==
                            "COMPLETED" &&
                          event.status !==
                            "CANCELLED" &&
                          new Date(
                            event.dueAt
                          ).getTime() <
                            Date.now();

                        return (
                          <article
                            key={event.id}
                            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                          >
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-semibold text-slate-900">
                                    {new Date(
                                      event.startsAt
                                    ).toLocaleTimeString(
                                      "tr-TR",
                                      {
                                        hour: "2-digit",
                                        minute: "2-digit"
                                      }
                                    )}
                                  </span>

                                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                                    {getOperationStatusLabel(
                                      event.status
                                    )}
                                  </span>

                                  {late ? (
                                    <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                                      Gecikmiş
                                    </span>
                                  ) : null}
                                </div>

                                <h3 className="mt-2 font-semibold text-slate-900">
                                  {event.title}
                                </h3>

                                <p className="mt-1 text-sm text-slate-600">
                                  {event.customerName}
                                </p>

                                {event.partyName ? (
                                  <p className="mt-1 text-sm text-slate-500">
                                    Atanan:{" "}
                                    {event.partyName}
                                  </p>
                                ) : null}
                              </div>

                              <div className="text-sm text-slate-600">
                                <div>
                                  Termin:{" "}
                                  {new Date(
                                    event.dueAt
                                  ).toLocaleString(
                                    "tr-TR"
                                  )}
                                </div>

                                {event.address ? (
                                  <div className="mt-1 max-w-md">
                                    {event.address}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                )
              )}
            </div>
          )}
        </>
      ) : null}
    </main>
  );
}