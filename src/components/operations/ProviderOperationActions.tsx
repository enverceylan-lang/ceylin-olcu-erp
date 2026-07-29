"use client";

import {
  useState
} from "react";
import type {
  OperationRecord
} from "@/lib/operationsWorkflow";
import type {
  ProviderWorkActor,
  ProviderWorkLinkSnapshot
} from "@/lib/providerAccountContracts";
import {
  getProviderStatusActionLabel,
  listProviderStatusActions,
  type ProviderStatusAction
} from "@/lib/providerOperationStatusService";
import {
  useOperationsStore
} from "@/store/useOperationsStore";

interface ProviderOperationActionsProps {
  operation:
    OperationRecord;

  actor:
    ProviderWorkActor;

  link:
    ProviderWorkLinkSnapshot;
}

function createAuditId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID ===
      "function"
  ) {
    return crypto.randomUUID();
  }

  return [
    "provider-status-audit",
    Date.now(),
    Math.random()
      .toString(36)
      .slice(2)
  ].join("-");
}

function resultMessage(
  outcome:
    | "UPDATED"
    | "REPLAY"
    | "NOT_FOUND"
    | "REJECTED",
  action:
    ProviderStatusAction
): string {
  if (outcome === "REPLAY") {
    return "Bu işlem daha önce uygulanmış. Mükerrer değişiklik yapılmadı.";
  }

  if (outcome === "NOT_FOUND") {
    return "İş kaydı bulunamadı.";
  }

  if (outcome === "REJECTED") {
    return "İşlem yetki veya durum kuralı nedeniyle reddedildi.";
  }

  if (action === "ACCEPT") {
    return "İş kabul edildi.";
  }

  if (action === "START") {
    return "İşe başlandı.";
  }

  if (
    action === "REPORT_PROBLEM"
  ) {
    return "Sorun bildirildi.";
  }

  if (action === "RESUME") {
    return "İşe devam edildi.";
  }

  return "Tamamlanma bildirildi. Hakediş tutarı yönetici tarafından girilmek üzere beklemeye alındı.";
}

export default function ProviderOperationActions({
  operation,
  actor,
  link
}: ProviderOperationActionsProps) {
  const updateProviderStatus =
    useOperationsStore(
      state =>
        state.updateProviderStatus
    );

  const [busy, setBusy] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [
    problemMode,
    setProblemMode
  ] = useState(false);

  const [
    problemDescription,
    setProblemDescription
  ] = useState("");

  const actions =
    listProviderStatusActions(
      operation.status
    );

  async function runAction(
    action:
      ProviderStatusAction
  ): Promise<void> {
    if (busy) {
      return;
    }

    const normalizedProblem =
      problemDescription.trim();

    if (
      action ===
        "REPORT_PROBLEM" &&
      !normalizedProblem
    ) {
      setMessage(
        "Sorun açıklaması zorunludur."
      );
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const result =
        updateProviderStatus({
          actor,
          link,
          operationId:
            operation.id,
          action,
          occurredAt:
            new Date().toISOString(),
          auditId:
            createAuditId(),

          ...(action ===
          "REPORT_COMPLETED"
            ? {
                earningsCurrency:
                  "TRY" as const
              }
            : {}),

          ...(action ===
          "REPORT_PROBLEM"
            ? {
                problemDescription:
                  normalizedProblem
              }
            : {})
        });

      setMessage(
        resultMessage(
          result.outcome,
          action
        )
      );

      if (
        result.outcome ===
          "UPDATED" &&
        action ===
          "REPORT_PROBLEM"
      ) {
        setProblemMode(false);
        setProblemDescription("");
      }
    } catch {
      setMessage(
        "İşlem sırasında beklenmeyen bir hata oluştu."
      );
    } finally {
      setBusy(false);
    }
  }

  if (
    operation.status ===
    "COMPLETED"
  ) {
    return (
      <div
        data-provider-operation-completed
        className="w-full rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800"
      >
        <p className="font-semibold">
          Tamamlandı
        </p>

        <p className="mt-1 text-xs">
          Finansal kesinleştirme yönetici onayından sonra yapılacaktır.
        </p>
      </div>
    );
  }

  if (
    operation.status ===
    "CANCELLED"
  ) {
    return (
      <div className="w-full rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
        İptal Edildi
      </div>
    );
  }

  return (
    <div
      data-provider-operation-actions
      className="w-full space-y-3"
    >
      {problemMode ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <label className="block text-sm font-semibold text-amber-950">
            Sorun Açıklaması
          </label>

          <textarea
            value={
              problemDescription
            }
            onChange={event =>
              setProblemDescription(
                event.target.value
              )
            }
            disabled={busy}
            rows={3}
            maxLength={1000}
            placeholder="Sorunu kısa ve açık şekilde yazın."
            className="mt-2 w-full rounded-lg border border-amber-300 bg-white p-3 text-sm text-slate-900 outline-none disabled:opacity-60"
          />

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={
                busy ||
                !problemDescription.trim()
              }
              onClick={() =>
                void runAction(
                  "REPORT_PROBLEM"
                )
              }
              className="min-h-11 w-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {busy
                ? "İşleniyor..."
                : "Sorunu Kaydet"}
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setProblemMode(false);
                setProblemDescription("");
                setMessage("");
              }}
              className="min-h-11 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50 sm:w-auto"
            >
              Vazgeç
            </button>
          </div>
        </div>
      ) : null}

      {!problemMode ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {actions.map(action => {
            if (
              action ===
              "REPORT_PROBLEM"
            ) {
              return (
                <button
                  key={action}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setProblemMode(true);
                    setMessage("");
                  }}
                  className="min-h-11 w-full rounded-lg border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  Sorun Bildir
                </button>
              );
            }

            return (
              <button
                key={action}
                type="button"
                disabled={busy}
                onClick={() =>
                  void runAction(
                    action
                  )
                }
                className={`min-h-11 w-full rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${
                  action ===
                  "REPORT_COMPLETED"
                    ? "bg-green-600"
                    : "bg-blue-600"
                }`}
              >
                {busy
                  ? "İşleniyor..."
                  : getProviderStatusActionLabel(
                      action
                    )}
              </button>
            );
          })}
        </div>
      ) : null}

      {message ? (
        <p
          role="status"
          className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}