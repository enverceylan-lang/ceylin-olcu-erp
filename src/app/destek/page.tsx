"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Headphones,
  Loader2,
  MessageSquareText,
  Plus,
  RefreshCw,
  Send,
} from "lucide-react";

import {
  useAuthStore,
} from "@/store/useAuthStore";

type SupportTicket = {
  ticket_id: string;
  category: string;
  module_code: string;
  subject: string;
  description: string;
  status: string;
  created_by_role: string;
  created_at: string;
  updated_at: string;
};

type SupportMessage = {
  message_id: string;
  ticket_id: string;
  sender_side: "COMPANY" | "PLATFORM";
  sender_role: string;
  body: string;
  created_at: string;
};

const CATEGORY_OPTIONS = [
  ["TECHNICAL", "Teknik Sorun"],
  ["USAGE_SUPPORT", "Kullanım Desteği"],
  ["DEVELOPMENT_SUGGESTION", "Geliştirme Önerisi"],
  ["SECURITY", "Güvenlik"],
  ["BILLING_LICENSE", "Faturalama / Lisans"],
] as const;

const STATUS_LABELS: Record<string, string> = {
  NEW: "Yeni",
  IN_REVIEW: "İnceleniyor",
  NEEDS_EXPLANATION: "Açıklama Bekleniyor",
  SUPPORT_IN_PROGRESS: "Destek Veriliyor",
  ARCHITECTURE_REJECTED: "Mimari Dışı",
  ACCEPTED: "Kabul Edildi",
  IN_DEVELOPMENT: "Geliştirmede",
  RESOLVED: "Çözüldü",
  CLOSED: "Kapalı",
};

export default function SupportPage() {
  const sessionToken = useAuthStore(
    state => state.sessionToken,
  );

  const [tickets, setTickets] =
    useState<SupportTicket[]>([]);
  const [messages, setMessages] =
    useState<SupportMessage[]>([]);
  const [selectedTicketId, setSelectedTicketId] =
    useState<string | null>(null);
  const [loading, setLoading] =
    useState(true);
  const [saving, setSaving] =
    useState(false);
  const [error, setError] =
    useState<string | null>(null);
  const [replyBody, setReplyBody] =
    useState("");
  const [form, setForm] =
    useState({
      category: "TECHNICAL",
      moduleCode: "GENERAL",
      subject: "",
      description: "",
    });

  const authHeaders = useCallback(
    () => ({
      Authorization:
        `Bearer ${sessionToken || ""}`,
    }),
    [sessionToken],
  );

  const loadSupport = useCallback(
    async () => {
      if (!sessionToken) {
        setLoading(false);
        setError("Oturum bilgisi bulunamadı.");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response =
          await fetch(
            "/api/support/tickets",
            {
              headers: authHeaders(),
            },
          );

        const body =
          await response.json();

        if (
          !response.ok ||
          body?.success !== true
        ) {
          throw new Error(
            body?.error ||
              "Destek kayıtları alınamadı.",
          );
        }

        const nextTickets =
          Array.isArray(body.tickets)
            ? body.tickets
            : [];

        const nextMessages =
          Array.isArray(body.messages)
            ? body.messages
            : [];

        setTickets(nextTickets);
        setMessages(nextMessages);

        setSelectedTicketId(current => {
          if (
            current &&
            nextTickets.some(
              (ticket: SupportTicket) =>
                ticket.ticket_id === current,
            )
          ) {
            return current;
          }

          return (
            nextTickets[0]?.ticket_id ||
            null
          );
        });
      }
      catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Destek kayıtları alınamadı.",
        );
      }
      finally {
        setLoading(false);
      }
    },
    [authHeaders, sessionToken],
  );

  useEffect(() => {
    const timer =
      window.setTimeout(() => {
        void loadSupport();
      }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadSupport]);

  const selectedTicket =
    useMemo(
      () =>
        tickets.find(
          ticket =>
            ticket.ticket_id ===
            selectedTicketId,
        ) || null,
      [tickets, selectedTicketId],
    );

  const selectedMessages =
    useMemo(
      () =>
        messages.filter(
          message =>
            message.ticket_id ===
            selectedTicketId,
        ),
      [messages, selectedTicketId],
    );

  async function createTicket(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    if (!sessionToken || saving) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response =
        await fetch(
          "/api/support/tickets",
          {
            method: "POST",
            headers: {
              ...authHeaders(),
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify(form),
          },
        );

      const body =
        await response.json();

      if (
        !response.ok ||
        body?.success !== true
      ) {
        throw new Error(
          body?.error ||
            "Destek talebi oluşturulamadı.",
        );
      }

      setForm({
        category: "TECHNICAL",
        moduleCode: "GENERAL",
        subject: "",
        description: "",
      });

      await loadSupport();

      if (body?.ticket?.ticket_id) {
        setSelectedTicketId(
          body.ticket.ticket_id,
        );
      }
    }
    catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Destek talebi oluşturulamadı.",
      );
    }
    finally {
      setSaving(false);
    }
  }

  async function sendReply(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    if (
      !sessionToken ||
      !selectedTicketId ||
      !replyBody.trim() ||
      saving
    ) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response =
        await fetch(
          `/api/support/tickets/${selectedTicketId}/messages`,
          {
            method: "POST",
            headers: {
              ...authHeaders(),
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              body: replyBody,
            }),
          },
        );

      const body =
        await response.json();

      if (
        !response.ok ||
        body?.success !== true
      ) {
        throw new Error(
          body?.error ||
            "Mesaj gönderilemedi.",
        );
      }

      setReplyBody("");
      await loadSupport();
    }
    catch (replyError) {
      setError(
        replyError instanceof Error
          ? replyError.message
          : "Mesaj gönderilemedi.",
      );
    }
    finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Headphones className="h-5 w-5 text-blue-600" />
              <h1 className="text-xl font-bold text-slate-950 dark:text-white">
                Destek
              </h1>
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Teknik sorun, kullanım desteği, geliştirme önerisi ve güvenlik taleplerinizi Platform ekibine iletin.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadSupport()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
          >
            <RefreshCw className="h-4 w-4" />
            Yenile
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <form
          onSubmit={createTicket}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-blue-600" />
            <h2 className="font-semibold text-slate-950 dark:text-white">
              Yeni Destek Talebi
            </h2>
          </div>

          <div className="mt-4 space-y-3">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Kategori
              <select
                value={form.category}
                onChange={event =>
                  setForm(current => ({
                    ...current,
                    category:
                      event.target.value,
                  }))
                }
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                {CATEGORY_OPTIONS.map(
                  ([value, label]) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {label}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Modül
              <input
                value={form.moduleCode}
                onChange={event =>
                  setForm(current => ({
                    ...current,
                    moduleCode:
                      event.target.value
                        .toUpperCase(),
                  }))
                }
                maxLength={64}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm uppercase dark:border-slate-700 dark:bg-slate-950"
              />
            </label>

            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Konu
              <input
                value={form.subject}
                onChange={event =>
                  setForm(current => ({
                    ...current,
                    subject:
                      event.target.value,
                  }))
                }
                minLength={3}
                maxLength={160}
                required
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </label>

            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Açıklama
              <textarea
                value={form.description}
                onChange={event =>
                  setForm(current => ({
                    ...current,
                    description:
                      event.target.value,
                  }))
                }
                minLength={5}
                maxLength={5000}
                required
                rows={6}
                className="mt-1.5 w-full resize-y rounded-lg border border-slate-300 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </label>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Talep Oluştur
            </button>
          </div>
        </form>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 p-5 dark:border-slate-800">
            <h2 className="font-semibold text-slate-950 dark:text-white">
              Taleplerim
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Şirket kapsamındaki destek geçmişi.
            </p>
          </div>

          <div className="max-h-[32rem] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
            {loading && (
              <div className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Yükleniyor...
              </div>
            )}

            {!loading &&
              tickets.length === 0 && (
                <div className="p-8 text-center text-sm text-slate-500">
                  Henüz destek talebi yok.
                </div>
              )}

            {tickets.map(ticket => (
              <button
                key={ticket.ticket_id}
                type="button"
                onClick={() =>
                  setSelectedTicketId(
                    ticket.ticket_id,
                  )
                }
                className={`w-full px-5 py-4 text-left transition ${
                  ticket.ticket_id ===
                  selectedTicketId
                    ? "bg-blue-50 dark:bg-blue-950/20"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {ticket.subject}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {ticket.module_code} ·{" "}
                      {new Date(
                        ticket.created_at,
                      ).toLocaleString("tr-TR")}
                    </p>
                  </div>

                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {STATUS_LABELS[
                      ticket.status
                    ] || ticket.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {!selectedTicket ? (
          <div className="flex min-h-48 flex-col items-center justify-center text-center">
            <MessageSquareText className="h-7 w-7 text-slate-400" />
            <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
              Görüşme için bir talep seçin
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-semibold text-slate-950 dark:text-white">
                  {selectedTicket.subject}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {selectedTicket.description}
                </p>
              </div>

              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                {STATUS_LABELS[
                  selectedTicket.status
                ] || selectedTicket.status}
              </span>
            </div>

            <div className="mt-4 max-h-96 space-y-3 overflow-y-auto">
              {selectedMessages.length === 0 && (
                <p className="py-6 text-center text-sm text-slate-500">
                  Henüz mesaj yok.
                </p>
              )}

              {selectedMessages.map(message => (
                <div
                  key={message.message_id}
                  className={`max-w-3xl rounded-xl border p-3 ${
                    message.sender_side ===
                    "COMPANY"
                      ? "ml-auto border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/20"
                      : "mr-auto border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      {message.sender_side ===
                      "COMPANY"
                        ? "Şirket"
                        : "Platform"}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(
                        message.created_at,
                      ).toLocaleString("tr-TR")}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">
                    {message.body}
                  </p>
                </div>
              ))}
            </div>

            {selectedTicket.status !==
              "CLOSED" && (
              <form
                onSubmit={sendReply}
                className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-4 dark:border-slate-800 sm:flex-row"
              >
                <textarea
                  value={replyBody}
                  onChange={event =>
                    setReplyBody(
                      event.target.value,
                    )
                  }
                  maxLength={5000}
                  rows={3}
                  placeholder="Mesajınızı yazın..."
                  className="min-h-20 flex-1 resize-y rounded-lg border border-slate-300 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                />

                <button
                  type="submit"
                  disabled={
                    saving ||
                    !replyBody.trim()
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  Gönder
                </button>
              </form>
            )}
          </>
        )}
      </section>
    </div>
  );
}