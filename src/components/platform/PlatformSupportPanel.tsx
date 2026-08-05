"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Headphones,
  MessageSquareText,
  RefreshCw,
} from "lucide-react";

import { useAuthStore } from "@/store/useAuthStore";

type SupportTicket = {
  ticket_id: string;
  tenant_id: string;
  company_id: string;
  category: string;
  module_code: string;
  subject: string;
  description: string;
  status: string;
  created_by_user_id: string;
  created_by_role: string;
  created_at: string;
};

type SupportMessage = {
  message_id: string;
  ticket_id: string;
  sender_side: "COMPANY" | "PLATFORM";
  body: string;
  created_at: string;
};

type SupportAudit = {
  audit_id: string;
  ticket_id: string;
  from_status: string | null;
  to_status: string;
  actor_side: "COMPANY" | "PLATFORM";
  note?: string | null;
  created_at: string;
};

type SupportCompany = {
  company_id: string;
  tenant_id: string;
  company_code: string;
  name: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  TECHNICAL: "Teknik Sorun",
  USAGE_SUPPORT: "Kullanım Desteği",
  DEVELOPMENT_SUGGESTION: "Geliştirme Önerisi",
  SECURITY: "Güvenlik",
  BILLING_LICENSE: "Faturalama / Lisans",
};

const STATUS_OPTIONS = [
  ["NEW", "Yeni"],
  ["IN_REVIEW", "İncelemede"],
  ["NEEDS_EXPLANATION", "Açıklama Bekleniyor"],
  ["SUPPORT_IN_PROGRESS", "Destek Veriliyor"],
  ["ARCHITECTURE_REJECTED", "Uygunsuz / Mimari Dışı"],
  ["ACCEPTED", "Kabul Edildi"],
  ["IN_DEVELOPMENT", "Geliştirmede"],
  ["RESOLVED", "Çözüldü"],
  ["CLOSED", "Kapalı"],
] as const;

const STATUS_LABELS: Record<string, string> =
  Object.fromEntries(STATUS_OPTIONS);

export default function PlatformSupportPanel() {
  const sessionToken = useAuthStore(
    state => state.sessionToken,
  );

  const [tickets, setTickets] =
    useState<SupportTicket[]>([]);
  const [messages, setMessages] =
    useState<SupportMessage[]>([]);
  const [audits, setAudits] =
    useState<SupportAudit[]>([]);
  const [companies, setCompanies] =
    useState<SupportCompany[]>([]);
  const [selectedId, setSelectedId] =
    useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] =
    useState("all");
  const [status, setStatus] =
    useState("all");
  const [reply, setReply] = useState("");
  const [statusNote, setStatusNote] =
    useState("");
  const [loading, setLoading] =
    useState(false);
  const [saving, setSaving] =
    useState(false);
  const [error, setError] =
    useState<string | null>(null);

  const loadSupport = useCallback(
    async () => {
      if (!sessionToken) {
        setError(
          "Platform oturum bilgisi bulunamadı.",
        );
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response =
          await fetch(
            "/api/platform/support/tickets",
            {
              headers: {
                Authorization:
                  `Bearer ${sessionToken}`,
              },
            },
          );

        const body = await response.json();

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

        setTickets(nextTickets);
        setMessages(
          Array.isArray(body.messages)
            ? body.messages
            : [],
        );
        setAudits(
          Array.isArray(body.audits)
            ? body.audits
            : [],
        );
        setCompanies(
          Array.isArray(body.companies)
            ? body.companies
            : [],
        );

        setSelectedId(current => {
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
    [sessionToken],
  );

  useEffect(() => {
    const timer =
      window.setTimeout(() => {
        void loadSupport();
      }, 0);

    return () =>
      window.clearTimeout(timer);
  }, [loadSupport]);

  const selectedTicket =
    useMemo(
      () =>
        tickets.find(
          ticket =>
            ticket.ticket_id === selectedId,
        ) || null,
      [tickets, selectedId],
    );

  const selectedCompany =
    useMemo(
      () =>
        companies.find(
          company =>
            company.company_id ===
              selectedTicket?.company_id &&
            company.tenant_id ===
              selectedTicket?.tenant_id,
        ) || null,
      [companies, selectedTicket],
    );

  const filteredTickets =
    useMemo(
      () => {
        const normalizedSearch =
          search.trim().toLowerCase();

        return tickets.filter(ticket => {
          const company =
            companies.find(
              item =>
                item.company_id ===
                  ticket.company_id &&
                item.tenant_id ===
                  ticket.tenant_id,
            );

          const text = [
            company?.name || "",
            company?.company_code || "",
            ticket.created_by_user_id,
            ticket.module_code,
            ticket.subject,
            ticket.description,
          ]
            .join(" ")
            .toLowerCase();

          return (
            (category === "all" ||
              ticket.category === category) &&
            (status === "all" ||
              ticket.status === status) &&
            (!normalizedSearch ||
              text.includes(normalizedSearch))
          );
        });
      },
      [
        tickets,
        companies,
        search,
        category,
        status,
      ],
    );

  const selectedMessages =
    useMemo(
      () =>
        messages.filter(
          message =>
            message.ticket_id === selectedId,
        ),
      [messages, selectedId],
    );

  const selectedAudits =
    useMemo(
      () =>
        audits.filter(
          audit =>
            audit.ticket_id === selectedId,
        ),
      [audits, selectedId],
    );

  const counts = useMemo(
    () => ({
      NEW:
        tickets.filter(
          ticket => ticket.status === "NEW",
        ).length,
      IN_REVIEW:
        tickets.filter(
          ticket =>
            ticket.status === "IN_REVIEW",
        ).length,
      IN_DEVELOPMENT:
        tickets.filter(
          ticket =>
            ticket.status ===
            "IN_DEVELOPMENT",
        ).length,
      RESOLVED:
        tickets.filter(
          ticket =>
            ticket.status === "RESOLVED",
        ).length,
      CLOSED:
        tickets.filter(
          ticket =>
            ticket.status === "CLOSED",
        ).length,
    }),
    [tickets],
  );

  async function sendReply() {
    if (
      !sessionToken ||
      !selectedId ||
      !reply.trim() ||
      saving
    ) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response =
        await fetch(
          `/api/platform/support/tickets/${selectedId}/messages`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Authorization:
                `Bearer ${sessionToken}`,
            },
            body: JSON.stringify({
              body: reply,
            }),
          },
        );

      const body = await response.json();

      if (
        !response.ok ||
        body?.success !== true
      ) {
        throw new Error(
          body?.error ||
            "Yanıt gönderilemedi.",
        );
      }

      setReply("");
      await loadSupport();
    }
    catch (replyError) {
      setError(
        replyError instanceof Error
          ? replyError.message
          : "Yanıt gönderilemedi.",
      );
    }
    finally {
      setSaving(false);
    }
  }

  async function changeStatus(
    nextStatus: string,
  ) {
    if (
      !sessionToken ||
      !selectedId ||
      saving
    ) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response =
        await fetch(
          `/api/platform/support/tickets/${selectedId}/status`,
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
              Authorization:
                `Bearer ${sessionToken}`,
            },
            body: JSON.stringify({
              status: nextStatus,
              note:
                statusNote.trim() || null,
            }),
          },
        );

      const body = await response.json();

      if (
        !response.ok ||
        body?.success !== true
      ) {
        throw new Error(
          body?.error ||
            "Durum güncellenemedi.",
        );
      }

      setStatusNote("");
      await loadSupport();
    }
    catch (statusError) {
      setError(
        statusError instanceof Error
          ? statusError.message
          : "Durum güncellenemedi.",
      );
    }
    finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Headphones className="h-5 w-5 text-cyan-600 dark:text-cyan-300" />
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                Destek Merkezi
              </h2>
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Şirketlerden açıkça gönderilen destek talepleri ve mesajları.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
              Ticket API bağlı
            </span>
            <button
              type="button"
              onClick={() => void loadSupport()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
            >
              <RefreshCw className="h-4 w-4" />
              Yenile
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Yeni", counts.NEW],
          ["İnceleniyor", counts.IN_REVIEW],
          ["Geliştirmede", counts.IN_DEVELOPMENT],
          ["Çözüldü", counts.RESOLVED],
          ["Arşiv", counts.CLOSED],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {String(label)}
            </p>
            <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
              {loading ? "…" : String(value)}
            </p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.95fr_1.35fr]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 p-5 dark:border-slate-800">
            <h3 className="font-semibold text-slate-950 dark:text-white">
              Destek Talepleri
            </h3>

            <div className="mt-4 space-y-2">
              <input
                value={search}
                onChange={event =>
                  setSearch(event.target.value)
                }
                placeholder="Talep ara"
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />

              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  value={category}
                  onChange={event =>
                    setCategory(event.target.value)
                  }
                  className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="all">
                    Tüm kategoriler
                  </option>
                  {Object.entries(
                    CATEGORY_LABELS,
                  ).map(([value, label]) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {label}
                    </option>
                  ))}
                </select>

                <select
                  value={status}
                  onChange={event =>
                    setStatus(event.target.value)
                  }
                  className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="all">
                    Tüm durumlar
                  </option>
                  {STATUS_OPTIONS.map(
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
              </div>
            </div>
          </div>

          <div className="max-h-[38rem] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
            {!loading &&
              filteredTickets.length === 0 && (
                <div className="p-8 text-center text-sm text-slate-500">
                  Filtreye uygun destek kaydı yok.
                </div>
              )}

            {filteredTickets.map(ticket => {
              const company =
                companies.find(
                  item =>
                    item.company_id ===
                      ticket.company_id &&
                    item.tenant_id ===
                      ticket.tenant_id,
                );

              return (
                <button
                  key={ticket.ticket_id}
                  type="button"
                  onClick={() =>
                    setSelectedId(
                      ticket.ticket_id,
                    )
                  }
                  className={`w-full px-5 py-4 text-left ${
                    selectedId === ticket.ticket_id
                      ? "bg-cyan-50 dark:bg-cyan-950/20"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                        {ticket.subject}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {company?.name ||
                          company?.company_code ||
                          ticket.company_id}
                        {" · "}
                        {ticket.module_code}
                      </p>
                    </div>

                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {STATUS_LABELS[
                        ticket.status
                      ] || ticket.status}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {!selectedTicket ? (
            <div className="flex min-h-72 flex-col items-center justify-center text-center">
              <MessageSquareText className="h-7 w-7 text-slate-400" />
              <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                İncelemek için bir destek talebi seçin
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  [
                    "Şirket",
                    selectedCompany?.name ||
                      selectedCompany?.company_code ||
                      selectedTicket.company_id,
                  ],
                  [
                    "Kullanıcı",
                    selectedTicket.created_by_user_id,
                  ],
                  [
                    "Modül",
                    selectedTicket.module_code,
                  ],
                  [
                    "Talep Türü",
                    CATEGORY_LABELS[
                      selectedTicket.category
                    ] ||
                      selectedTicket.category,
                  ],
                  [
                    "Durum",
                    STATUS_LABELS[
                      selectedTicket.status
                    ] ||
                      selectedTicket.status,
                  ],
                  [
                    "Açılış",
                    new Date(
                      selectedTicket.created_at,
                    ).toLocaleString("tr-TR"),
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"
                  >
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      {label}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {selectedTicket.subject}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {selectedTicket.description}
                </p>
              </div>

              <div className="mt-4 max-h-72 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                {selectedMessages.map(message => (
                  <div
                    key={message.message_id}
                    className={`rounded-lg border p-3 ${
                      message.sender_side ===
                      "PLATFORM"
                        ? "ml-8 border-cyan-200 bg-cyan-50 dark:border-cyan-900/50 dark:bg-cyan-950/20"
                        : "mr-8 border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase text-slate-500">
                        {message.sender_side}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(
                          message.created_at,
                        ).toLocaleString("tr-TR")}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">
                      {message.body}
                    </p>
                  </div>
                ))}
              </div>

              {selectedTicket.status !==
                "CLOSED" && (
                <>
                  <textarea
                    value={reply}
                    onChange={event =>
                      setReply(event.target.value)
                    }
                    maxLength={5000}
                    rows={4}
                    placeholder="Şirkete yanıt yazın..."
                    className="mt-4 w-full resize-y rounded-lg border border-slate-300 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />

                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        void sendReply()
                      }
                      disabled={
                        saving ||
                        !reply.trim()
                      }
                      className="rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                    >
                      Yanıtla
                    </button>
                  </div>

                  <input
                    value={statusNote}
                    onChange={event =>
                      setStatusNote(
                        event.target.value,
                      )
                    }
                    maxLength={2000}
                    placeholder="İsteğe bağlı durum/audit notu"
                    className="mt-5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />

                  <div className="mt-3 flex flex-wrap gap-2">
                    {STATUS_OPTIONS
                      .filter(
                        ([nextStatus]) =>
                          nextStatus !==
                          selectedTicket.status,
                      )
                      .map(
                        ([
                          nextStatus,
                          label,
                        ]) => (
                          <button
                            key={nextStatus}
                            type="button"
                            onClick={() =>
                              void changeStatus(
                                nextStatus,
                              )
                            }
                            disabled={saving}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
                          >
                            {label}
                          </button>
                        ),
                      )}
                  </div>
                </>
              )}

              <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Durum Geçmişi / Audit
                </h4>

                <div className="mt-3 space-y-2">
                  {selectedAudits.map(audit => (
                    <div
                      key={audit.audit_id}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-800"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          {audit.from_status
                            ? `${
                                STATUS_LABELS[
                                  audit.from_status
                                ] ||
                                audit.from_status
                              } → `
                            : ""}
                          {STATUS_LABELS[
                            audit.to_status
                          ] || audit.to_status}
                        </span>
                        <span className="text-slate-400">
                          {new Date(
                            audit.created_at,
                          ).toLocaleString(
                            "tr-TR",
                          )}
                        </span>
                      </div>

                      {audit.note && (
                        <p className="mt-1 text-slate-500 dark:text-slate-400">
                          {audit.note}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}