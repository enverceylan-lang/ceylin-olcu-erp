"use client";

import {
  useMemo,
  useState
} from "react";
import type {
  OperationKind,
  OperationRecord
} from "@/lib/operationsWorkflow";
import type {
  RouteChildOperationInput,
  RouteChildOperationResult
} from "@/lib/operationRoutingService";

type ChildOperationKind = Exclude<
  OperationKind,
  "GENERAL"
>;

interface RoutingUser {
  id: string;
  name: string;
  phone?: string;
  role: string;
  isActive: boolean;
}

interface OperationRoutingModalProps {
  parent: OperationRecord;
  users: RoutingUser[];
  currentUserId: string;
  onClose(): void;
  onRoute(
    input: RouteChildOperationInput
  ): RouteChildOperationResult;
}

function localDateTimeValue(
  offsetHours = 0
): string {
  const date =
    new Date(
      Date.now() +
      offsetHours * 60 * 60 * 1000
    );

  const localTime =
    new Date(
      date.getTime() -
      date.getTimezoneOffset() *
        60 *
        1000
    );

  return localTime
    .toISOString()
    .slice(0, 16);
}

function normalizeRole(
  value: string
): string {
  return value
    .trim()
    .toUpperCase();
}

export default function OperationRoutingModal({
  parent,
  users,
  currentUserId,
  onClose,
  onRoute
}: OperationRoutingModalProps) {
  const [kind, setKind] =
    useState<ChildOperationKind>(
      "TAILOR"
    );

  const [selectedPartyId, setSelectedPartyId] =
    useState("");

  const [supplierName, setSupplierName] =
    useState("");

  const [supplierPhone, setSupplierPhone] =
    useState("");

  const [scheduledAt, setScheduledAt] =
    useState(
      localDateTimeValue()
    );

  const [dueAt, setDueAt] =
    useState(
      localDateTimeValue(24)
    );

  const [notes, setNotes] =
    useState("");

  const [isSaving, setIsSaving] =
    useState(false);

  const availableUsers =
    useMemo(() => {
      return users.filter(user => {
        if (!user.isActive) {
          return false;
        }

        const role =
          normalizeRole(user.role);

        if (kind === "TAILOR") {
          return (
            role === "TAILOR" ||
            role === "PRODUCTION"
          );
        }

        if (kind === "INSTALLATION") {
          return (
            role === "INSTALLER" ||
            role === "INSTALLATION"
          );
        }

        return false;
      });
    }, [kind, users]);

  const handleKindChange = (
    nextKind: ChildOperationKind
  ) => {
    setKind(nextKind);
    setSelectedPartyId("");
    setSupplierName("");
    setSupplierPhone("");
  };

  const handleSubmit = () => {
    if (!currentUserId.trim()) {
      window.alert(
        "Aktif kullanıcı bilgisi bulunamadı."
      );
      return;
    }

    const scheduledDate =
      new Date(scheduledAt);

    const dueDate =
      new Date(dueAt);

    if (
      Number.isNaN(
        scheduledDate.getTime()
      ) ||
      Number.isNaN(
        dueDate.getTime()
      )
    ) {
      window.alert(
        "Başlangıç ve termin tarihlerini kontrol edin."
      );
      return;
    }

    if (
      dueDate.getTime() <
      scheduledDate.getTime()
    ) {
      window.alert(
        "Termin tarihi başlangıç tarihinden önce olamaz."
      );
      return;
    }

    const selectedParty =
      users.find(
        user =>
          user.id === selectedPartyId
      );

    if (
      kind !== "SUPPLIER" &&
      !selectedParty
    ) {
      window.alert(
        kind === "TAILOR"
          ? "Terzi seçiniz."
          : "Montaj personeli seçiniz."
      );
      return;
    }

    if (
      kind === "SUPPLIER" &&
      !supplierName.trim()
    ) {
      window.alert(
        "Tedarikçi adını yazınız."
      );
      return;
    }

    setIsSaving(true);

    try {
      const result =
        onRoute({
          parent,
          kind,

          party: selectedParty
            ? {
                id: selectedParty.id,
                name: selectedParty.name,
                phone:
                  selectedParty.phone
              }
            : undefined,

          supplierName:
            supplierName.trim() ||
            undefined,

          supplierPhone:
            supplierPhone.trim() ||
            undefined,

          scheduledAt:
            scheduledDate.toISOString(),

          dueAt:
            dueDate.toISOString(),

          notes:
            notes.trim() ||
            undefined,

          createdByUserId:
            currentUserId,

          now:
            new Date().toISOString()
        });

      if (
        result.outcome === "CREATED"
      ) {
        window.alert(
          "Alt iş ve Ajanda kaydı oluşturuldu."
        );

        onClose();
        return;
      }

      if (
        result.outcome === "REPLAY"
      ) {
        window.alert(
          "Bu ana iş, görev türü ve görevli için aktif yönlendirme zaten mevcut."
        );

        return;
      }

      const reasonLabels: Record<
        string,
        string
      > = {
        PARENT_MUST_BE_GENERAL:
          "Yalnız genel ana işler yönlendirilebilir.",

        PARTY_REQUIRED:
          "Görevli personel seçilmelidir.",

        SUPPLIER_REQUIRED:
          "Tedarikçi bilgisi zorunludur.",

        INVALID_DATE_RANGE:
          "Başlangıç ve termin tarihleri geçersizdir.",

        ACTOR_REQUIRED:
          "İşlemi yapan kullanıcı bulunamadı."
      };

      window.alert(
        reasonLabels[result.reason] ||
        `Yönlendirme reddedildi: ${result.reason}`
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Operasyonu yönlendir"
      onClick={onClose}
    >
      <section
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
        onClick={event =>
          event.stopPropagation()
        }
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Operasyonu Yönlendir
            </h2>

            <p className="mt-1 text-sm text-slate-600">
              {parent.customerName}
              {" — "}
              {parent.title}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Kapat
          </button>
        </header>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Yönlendirme Türü

            <select
              value={kind}
              onChange={event =>
                handleKindChange(
                  event.target
                    .value as ChildOperationKind
                )
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"
            >
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
          </label>

          {kind !== "SUPPLIER" ? (
            <label className="text-sm font-medium text-slate-700">
              {kind === "TAILOR"
                ? "Terzi"
                : "Montaj Personeli"}

              <select
                value={selectedPartyId}
                onChange={event =>
                  setSelectedPartyId(
                    event.target.value
                  )
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"
              >
                <option value="">
                  Görevli seçin
                </option>

                {availableUsers.map(user => (
                  <option
                    key={user.id}
                    value={user.id}
                  >
                    {user.name}
                  </option>
                ))}
              </select>

              {availableUsers.length === 0 ? (
                <span className="mt-1 block text-xs text-amber-700">
                  Bu görev türüne uygun aktif personel bulunamadı.
                </span>
              ) : null}
            </label>
          ) : (
            <label className="text-sm font-medium text-slate-700">
              Tedarikçi Adı

              <input
                type="text"
                value={supplierName}
                onChange={event =>
                  setSupplierName(
                    event.target.value
                  )
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"
                placeholder="Tedarikçi adı"
              />
            </label>
          )}

          {kind === "SUPPLIER" ? (
            <label className="text-sm font-medium text-slate-700">
              Tedarikçi Telefonu

              <input
                type="tel"
                value={supplierPhone}
                onChange={event =>
                  setSupplierPhone(
                    event.target.value
                  )
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"
                placeholder="Telefon"
              />
            </label>
          ) : null}

          <label className="text-sm font-medium text-slate-700">
            Başlangıç

            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={event =>
                setScheduledAt(
                  event.target.value
                )
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Termin

            <input
              type="datetime-local"
              value={dueAt}
              onChange={event =>
                setDueAt(
                  event.target.value
                )
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"
            />
          </label>
        </div>

        <label className="mt-4 block text-sm font-medium text-slate-700">
          Not

          <textarea
            value={notes}
            onChange={event =>
              setNotes(
                event.target.value
              )
            }
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"
            placeholder="İş emri veya yönlendirme notu"
          />
        </label>

        <section className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <h3 className="text-sm font-bold text-blue-900">
            Ana İş Detayları
          </h3>

          <ul className="mt-2 space-y-1 text-sm text-blue-800">
            {parent.details.map(
              (detail, index) => (
                <li key={`${detail}-${index}`}>
                  • {detail}
                </li>
              )
            )}
          </ul>
        </section>

        <footer className="mt-5 flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Vazgeç
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving
              ? "Yönlendiriliyor..."
              : "Alt İşi Oluştur"}
          </button>
        </footer>
      </section>
    </div>
  );
}