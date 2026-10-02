"use client";

import { useMemo, useState } from "react";
import {
  buildOperationWhatsAppUrl,
  getOperationStatusLabel,
  openOperationPrintWindow,
} from "@/lib/operationOutputService";
import { fetchActiveCompanyDisplayName } from "@/lib/activeCompanyDisplayNameClient";
import { listChildOperations } from "@/lib/operationProgressService";
import type {
  OperationKind,
  OperationRecord,
} from "@/lib/operationsWorkflow";

type SaleSnapshot = {
  id: string;
  saleNo?: string;
  createdAt: string;
};

type OperationsManagementV2Props = {
  operations: OperationRecord[];
  sales: SaleSnapshot[];
  onCut: (operation: OperationRecord) => void;
  onRoute: (operation: OperationRecord) => void;
};

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("tr-TR");
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function isOverdue(
  operation: OperationRecord,
): boolean {
  return (
    operation.status !== "COMPLETED" &&
    new Date(operation.dueAt).getTime() <
      Date.now()
  );
}

function stageLabel(
  children: OperationRecord[],
  kind: Exclude<OperationKind, "GENERAL">,
): string {
  const active = children.filter(
    operation =>
      operation.kind === kind &&
      operation.status !== "CANCELLED",
  );

  if (active.length === 0) {
    return "Bekliyor";
  }

  const unfinished =
    active.find(
      operation =>
        operation.status !== "COMPLETED",
    ) ?? active[0];

  if (active.length === 1) {
    return getOperationStatusLabel(
      unfinished.status,
    );
  }

  const completed = active.filter(
    operation =>
      operation.status === "COMPLETED",
  ).length;

  return `${completed}/${active.length} tamam`;
}

function stageTone(label: string): string {
  if (
    label === "Tamamlandı" ||
    label.includes("tamam")
  ) {
    return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
  }

  if (
    label === "Sorun Var" ||
    label === "İptal Edildi"
  ) {
    return "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300";
  }

  if (label === "Bekliyor") {
    return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
  }

  return "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300";
}

export default function OperationsManagementV2({
  operations,
  sales,
  onCut,
  onRoute,
}: OperationsManagementV2Props) {
  const [searchQuery, setSearchQuery] =
    useState("");
  const [showCompleted, setShowCompleted] =
    useState(false);
  const [managedOperationId, setManagedOperationId] =
    useState<string | null>(null);

  const saleById = useMemo(
    () =>
      new Map(
        sales.map(sale => [
          sale.id,
          sale,
        ]),
      ),
    [sales],
  );

  const mainOperations = useMemo(() => {
    const normalizedSearch =
      searchQuery.trim().toLocaleLowerCase(
        "tr-TR",
      );

    return operations
      .filter(
        operation =>
          operation.kind === "GENERAL",
      )
      .filter(operation =>
        showCompleted
          ? true
          : operation.status !== "COMPLETED",
      )
      .filter(operation => {
        if (!normalizedSearch) {
          return true;
        }

        const sale =
          saleById.get(operation.saleId);

        return [
          sale?.saleNo,
          operation.customerName,
          operation.title,
          operation.address,
        ]
          .filter(Boolean)
          .some(value =>
            String(value)
              .toLocaleLowerCase("tr-TR")
              .includes(normalizedSearch),
          );
      })
      .sort((left, right) =>
        right.updatedAt.localeCompare(
          left.updatedAt,
        ),
      );
  }, [
    operations,
    saleById,
    searchQuery,
    showCompleted,
  ]);

  const managedOperation =
    managedOperationId
      ? mainOperations.find(
          operation =>
            operation.id ===
            managedOperationId,
        ) ?? null
      : null;

  async function printOperation(
    operation: OperationRecord,
  ): Promise<void> {
    try {
      const companyName =
        await fetchActiveCompanyDisplayName();

      openOperationPrintWindow(
        operation,
        companyName,
      );
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Çıktı oluşturulamadı.",
      );
    }
  }

  async function shareOperation(
    operation: OperationRecord,
  ): Promise<void> {
    try {
      const companyName =
        await fetchActiveCompanyDisplayName();

      window.open(
        buildOperationWhatsAppUrl(
          operation,
          companyName,
        ),
        "_blank",
        "noopener,noreferrer",
      );
    } catch {
      window.alert(
        "Aktif şirket adı okunamadı. WhatsApp çıktısı oluşturulmadı.",
      );
    }
  }

  function rowView(
    operation: OperationRecord,
  ) {
    const sale =
      saleById.get(operation.saleId);
    const children =
      listChildOperations(
        operation,
        operations,
      );

    const tailor =
      stageLabel(children, "TAILOR");
    const supplier =
      stageLabel(children, "SUPPLIER");
    const installation =
      stageLabel(
        children,
        "INSTALLATION",
      );

    return {
      sale,
      children,
      tailor,
      supplier,
      installation,
    };
  }

  return (
    <main className="min-h-screen bg-slate-100/70 px-3 py-3 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-4 md:px-5">
      <div className="mx-auto w-full max-w-[1600px] space-y-3">
        <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
                Operasyonlar
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Bir satış bir satır. Kesim, atölye, tedarik ve montaj aynı işin altında.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
              <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
                <div className="text-lg font-black">
                  {mainOperations.length}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  Görünen
                </div>
              </div>
              <div className="rounded-lg bg-blue-50 px-3 py-2 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                <div className="text-lg font-black">
                  {
                    mainOperations.filter(
                      operation =>
                        operation.status !==
                        "COMPLETED",
                    ).length
                  }
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wide">
                  Aktif
                </div>
              </div>
              <div className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                <div className="text-lg font-black">
                  {
                    mainOperations.filter(
                      isOverdue,
                    ).length
                  }
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wide">
                  Geciken
                </div>
              </div>
              <div className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                <div className="text-lg font-black">
                  {
                    operations.filter(
                      operation =>
                        operation.kind !==
                          "GENERAL" &&
                        operation.status ===
                          "COMPLETED",
                    ).length
                  }
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wide">
                  Alt İş Tamam
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-2 border-b border-slate-200 p-3 dark:border-slate-800 sm:flex-row sm:items-center">
            <input
              value={searchQuery}
              onChange={event =>
                setSearchQuery(
                  event.target.value,
                )
              }
              placeholder="Satış no veya cari ara..."
              className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950 sm:max-w-[430px]"
            />

            <label className="flex min-h-10 items-center gap-2 text-sm text-slate-600 dark:text-slate-300 sm:ml-auto">
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={event =>
                  setShowCompleted(
                    event.target.checked,
                  )
                }
              />
              Tamamlananları göster
            </label>
          </div>

          {mainOperations.length === 0 ? (
            <div className="p-10 text-center">
              <div className="text-base font-bold">
                Gösterilecek ana operasyon yok
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Arama kriterini veya tamamlananlar filtresini kontrol edebilirsiniz.
              </p>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                    <tr>
                      <th className="px-3 py-3">Satış No</th>
                      <th className="px-3 py-3">Cari</th>
                      <th className="px-3 py-3">Satış Tarihi</th>
                      <th className="px-3 py-3">Operasyon</th>
                      <th className="px-3 py-3">Atölye</th>
                      <th className="px-3 py-3">Tedarik</th>
                      <th className="px-3 py-3">Montaj</th>
                      <th className="px-3 py-3">Termin</th>
                      <th className="px-3 py-3">Son İşlem</th>
                      <th className="px-3 py-3 text-right">İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mainOperations.map(
                      operation => {
                        const view =
                          rowView(operation);

                        return (
                          <tr
                            key={
                              operation.id
                            }
                            className="border-t border-slate-200 align-middle hover:bg-slate-50/70 dark:border-slate-800 dark:hover:bg-slate-800/40"
                          >
                            <td className="px-3 py-3 font-bold text-slate-950 dark:text-white">
                              {view.sale
                                ?.saleNo ??
                                operation.saleId}
                            </td>
                            <td className="px-3 py-3">
                              <div className="font-semibold">
                                {
                                  operation.customerName
                                }
                              </div>
                              {operation.address ? (
                                <div className="mt-0.5 max-w-[230px] truncate text-xs text-slate-500">
                                  {
                                    operation.address
                                  }
                                </div>
                              ) : null}
                            </td>
                            <td className="px-3 py-3 tabular-nums text-slate-600 dark:text-slate-300">
                              {view.sale
                                ? formatDate(
                                    view.sale
                                      .createdAt,
                                  )
                                : "-"}
                            </td>
                            <td className="px-3 py-3">
                              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                                {getOperationStatusLabel(
                                  operation.status,
                                )}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-bold ${stageTone(
                                  view.tailor,
                                )}`}
                              >
                                {
                                  view.tailor
                                }
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-bold ${stageTone(
                                  view.supplier,
                                )}`}
                              >
                                {
                                  view.supplier
                                }
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-bold ${stageTone(
                                  view.installation,
                                )}`}
                              >
                                {
                                  view.installation
                                }
                              </span>
                            </td>
                            <td className="px-3 py-3 tabular-nums text-slate-600 dark:text-slate-300">
                              {formatDate(
                                operation.dueAt,
                              )}
                            </td>
                            <td className="px-3 py-3 tabular-nums text-xs text-slate-500">
                              {formatDateTime(
                                operation.updatedAt,
                              )}
                            </td>
                            <td className="px-3 py-3 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  setManagedOperationId(
                                    operation.id,
                                  )
                                }
                                className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                              >
                                Operasyon Yönet
                              </button>
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-slate-200 dark:divide-slate-800 md:hidden">
                {mainOperations.map(
                  operation => {
                    const view =
                      rowView(operation);

                    return (
                      <article
                        key={operation.id}
                        className="p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-blue-700 dark:text-blue-300">
                              {view.sale
                                ?.saleNo ??
                                operation.saleId}
                            </div>
                            <h2 className="mt-1 truncate text-base font-black">
                              {
                                operation.customerName
                              }
                            </h2>
                            <p className="mt-1 text-xs text-slate-500">
                              Termin:{" "}
                              {formatDate(
                                operation.dueAt,
                              )}
                            </p>
                          </div>
                          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                            {getOperationStatusLabel(
                              operation.status,
                            )}
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                          {[
                            [
                              "Atölye",
                              view.tailor,
                            ],
                            [
                              "Tedarik",
                              view.supplier,
                            ],
                            [
                              "Montaj",
                              view.installation,
                            ],
                          ].map(
                            ([
                              title,
                              label,
                            ]) => (
                              <div
                                key={title}
                                className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/70"
                              >
                                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                                  {
                                    title
                                  }
                                </div>
                                <div className="mt-1 truncate text-[11px] font-bold">
                                  {
                                    label
                                  }
                                </div>
                              </div>
                            ),
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setManagedOperationId(
                              operation.id,
                            )
                          }
                          className="mt-3 min-h-11 w-full rounded-lg bg-slate-950 px-4 text-sm font-bold text-white dark:bg-blue-600"
                        >
                          Operasyon Yönet
                        </button>
                      </article>
                    );
                  },
                )}
              </div>
            </>
          )}
        </section>
      </div>

      {managedOperation ? (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/35 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-label="Operasyon yönet"
          onMouseDown={event => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setManagedOperationId(null);
            }
          }}
        >
          <section className="h-full w-full max-w-3xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            {(() => {
              const view =
                rowView(managedOperation);

              return (
                <>
                  <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 p-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-blue-700 dark:text-blue-300">
                          {view.sale
                            ?.saleNo ??
                            managedOperation.saleId}
                        </div>
                        <h2 className="mt-1 text-xl font-black">
                          {
                            managedOperation.customerName
                          }
                        </h2>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {
                            managedOperation.address ??
                            "Adres bulunmuyor"
                          }
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setManagedOperationId(
                            null,
                          )
                        }
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold dark:border-slate-700"
                      >
                        Kapat
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void printOperation(
                            managedOperation,
                          )
                        }
                        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold dark:border-slate-700"
                      >
                        PDF / Yazdır
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void shareOperation(
                            managedOperation,
                          )
                        }
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white"
                      >
                        WhatsApp
                      </button>
                    </div>
                  </header>

                  <div className="space-y-3 p-4">
                    <section className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/25">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-black">
                            Kesim & Malzeme
                          </h3>
                          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                            Stok optimizasyonu, eksik malzeme, lot seçimi ve kesim tamamlama.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            onCut(
                              managedOperation,
                            )
                          }
                          className="min-h-11 rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white"
                        >
                          Kesimi Yönet
                        </button>
                      </div>
                    </section>

                    {[
                      {
                        title: "Atölye / Terzi",
                        kind: "TAILOR" as const,
                        empty:
                          "Henüz terzi işi oluşturulmadı.",
                      },
                      {
                        title: "Montaj",
                        kind:
                          "INSTALLATION" as const,
                        empty:
                          "Henüz montaj işi oluşturulmadı.",
                      },
                    ].map(item => {
                      const children =
                        view.children.filter(
                          child =>
                            child.kind ===
                              item.kind &&
                            child.status !==
                              "CANCELLED",
                        );

                      return (
                        <section
                          key={item.kind}
                          className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <div className="min-w-0 flex-1">
                              <h3 className="font-black">
                                {item.title}
                              </h3>

                              {children.length ? (
                                <div className="mt-2 space-y-2">
                                  {children.map(
                                    child => (
                                      <div
                                        key={
                                          child.id
                                        }
                                        className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/70"
                                      >
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="font-bold">
                                            {child
                                              .party
                                              ?.name ??
                                              "Atama bekliyor"}
                                          </span>
                                          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                                            {getOperationStatusLabel(
                                              child.status,
                                            )}
                                          </span>
                                        </div>
                                        <div className="mt-1 text-xs text-slate-500">
                                          Termin:{" "}
                                          {formatDateTime(
                                            child.dueAt,
                                          )}
                                        </div>
                                      </div>
                                    ),
                                  )}
                                </div>
                              ) : (
                                <p className="mt-1 text-sm text-slate-500">
                                  {item.empty}
                                </p>
                              )}
                            </div>

                            {children.length ===
                            0 ? (
                              <button
                                type="button"
                                onClick={() =>
                                  onRoute(
                                    managedOperation,
                                  )
                                }
                                className="min-h-11 rounded-lg bg-slate-950 px-4 text-sm font-bold text-white dark:bg-blue-600"
                              >
                                Yönlendirme Aç
                              </button>
                            ) : null}
                          </div>
                        </section>
                      );
                    })}

                    <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/60 dark:bg-amber-950/25">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-black">
                            Tedarik
                          </h3>
                          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                            Eksik ürün siparişi ve mal kabulü Kesim & Malzeme akışındaki merkezi procurement authority üzerinden yürür.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            onCut(
                              managedOperation,
                            )
                          }
                          className="min-h-11 rounded-lg bg-amber-500 px-4 text-sm font-black text-slate-950"
                        >
                          Tedariki Yönet
                        </button>
                      </div>
                    </section>
                  </div>
                </>
              );
            })()}
          </section>
        </div>
      ) : null}
    </main>
  );
}
