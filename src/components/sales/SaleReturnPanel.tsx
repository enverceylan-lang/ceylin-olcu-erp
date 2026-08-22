"use client";

import {
  useCallback,
  useEffect,
  useState
} from "react";

import type {
  ErpScope
} from "@/lib/erpScope";

import type {
  SaleStatus
} from "@/store/salesStore";

import {
  calculateSaleReturnEligibility,
  startFinanceValidatedSaleReturn,
  type SaleReturnFinanceEligibility
} from "@/lib/saleReturnFinanceEligibilityService";

import {
  approveSaleReturnWorkflow
} from "@/lib/saleReturnWorkflowService";

import {
  completeSaleReturnWorkflow,
  rejectSaleReturnWorkflow
} from "@/lib/saleReturnLifecycleWorkflowService";

import {
  loadLocalSaleReturns
} from "@/lib/localSaleReturnsDb";

import {
  listLocalFinanceTransactions
} from "@/lib/localFinanceDb";

import type {
  SaleReturnDocument
} from "@/lib/saleReturnService";

import {
  persistSaleReturnServerAuthority,
} from "@/lib/salesAuthorityRuntimeClient";

interface SaleReturnPanelProps {
  scope: ErpScope;
  saleId: string;
  customerId: string;
  saleStatus: SaleStatus;
  currency: string;
  actorUserId: string;
}

const RETURNABLE_SALE_STATUSES:
  readonly SaleStatus[] = [
    "ONAYLANDI",
    "SİPARİŞ",
    "ÜRETİME_GÖNDERİLDİ",
    "MONTAJA_GÖNDERİLDİ",
    "TAMAMLANDI"
  ];

function money(
  amount: number,
  currency: string
): string {
  return amount.toLocaleString(
    "tr-TR",
    {
      style: "currency",
      currency
    }
  );
}

function errorMessage(
  error: unknown
): string {
  return error instanceof Error
    ? error.message
    : "İade işlemi tamamlanamadı.";
}

export default function SaleReturnPanel({
  scope,
  saleId,
  customerId,
  saleStatus,
  currency,
  actorUserId
}: SaleReturnPanelProps) {
  const [returns, setReturns] =
    useState<SaleReturnDocument[]>([]);

  const [eligibility, setEligibility] =
    useState<
      SaleReturnFinanceEligibility |
      null
    >(null);

  const [amount, setAmount] =
    useState(0);

  const [reason, setReason] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [processingId, setProcessingId] =
    useState<string | null>(null);

  const [message, setMessage] =
    useState<string | null>(null);

  const canStartReturn =
    RETURNABLE_SALE_STATUSES.includes(
      saleStatus
    );

  const applyLoadedData = useCallback(
    (
      loadedReturns:
        SaleReturnDocument[],
      calculatedEligibility:
        SaleReturnFinanceEligibility
    ) => {
      setReturns(loadedReturns);

      setEligibility(
        calculatedEligibility
      );

      setAmount(currentAmount => {
        if (
          currentAmount > 0 &&
          currentAmount <=
            calculatedEligibility
              .returnableAmount
        ) {
          return currentAmount;
        }

        return calculatedEligibility
          .returnableAmount;
      });
    },
    []
  );

  const refresh = useCallback(
    async () => {
      const [
        loadedReturns,
        transactions
      ] = await Promise.all([
        loadLocalSaleReturns(
          scope,
          saleId
        ),

        listLocalFinanceTransactions(
          scope,
          customerId,
          saleId
        )
      ]);

      const calculatedEligibility =
        calculateSaleReturnEligibility(
          transactions,
          scope,
          customerId,
          saleId,
          currency
        );

      applyLoadedData(
        loadedReturns,
        calculatedEligibility
      );
    },
    [
      scope,
      saleId,
      customerId,
      currency,
      applyLoadedData
    ]
  );

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      loadLocalSaleReturns(
        scope,
        saleId
      ),

      listLocalFinanceTransactions(
        scope,
        customerId,
        saleId
      )
    ])
      .then(
        ([
          loadedReturns,
          transactions
        ]) => {
          if (cancelled) {
            return;
          }

          const calculatedEligibility =
            calculateSaleReturnEligibility(
              transactions,
              scope,
              customerId,
              saleId,
              currency
            );

          setReturns(loadedReturns);

          setEligibility(
            calculatedEligibility
          );

          setAmount(
            calculatedEligibility
              .returnableAmount
          );
        }
      )
      .catch(error => {
        if (!cancelled) {
          setMessage(
            errorMessage(error)
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    scope,
    saleId,
    customerId,
    currency
  ]);

  const handleStart = async () => {
    setMessage(null);

    if (!canStartReturn) {
      setMessage(
        "Bu satış durumunda iade başlatılamaz."
      );

      return;
    }

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setMessage(
        "Geçerli bir iade tutarı giriniz."
      );

      return;
    }

    setProcessingId("START");

    try {
      const occurredAt =
        new Date().toISOString();

      const result =
        await startFinanceValidatedSaleReturn({
          ...scope,

          saleId,
          customerId,
          saleStatus,
          actorUserId,

          amount,
          currency,

          reason:
            reason.trim() ||
            undefined,

          occurredAt,

          idempotencyKey: [
            "sale-return-ui",
            saleId,
            occurredAt
          ].join(":")
        });
      // SERVER_RETURN_START_RUNTIME_V1
      if (
        result.outcome === "CREATED" ||
        result.outcome === "REPLAY"
      ) {
        await persistSaleReturnServerAuthority({
          action: "START",
          saleReturn: result.saleReturn,
          scope,
          occurredAt: result.saleReturn.occurredAt,
        });
      }

      if (
        result.outcome ===
        "FINANCE_REJECTED"
      ) {
        setMessage(
          `İade finans kontrolünden geçmedi: ${result.reason}`
        );

        return;
      }

      if (
        result.outcome ===
        "REJECTED"
      ) {
        setMessage(
          `İade başlatılamadı: ${result.reason}`
        );

        return;
      }

      if (
        result.outcome ===
        "CONFLICT"
      ) {
        setMessage(
          "Aynı işlem anahtarı farklı içerikle daha önce kullanılmış."
        );

        return;
      }

      setReason("");

      setMessage(
        result.outcome === "REPLAY"
          ? "İade kaydı daha önce oluşturulmuş."
          : "İade süreci başlatıldı."
      );

      await refresh();
    }
    catch (error) {
      setMessage(
        errorMessage(error)
      );
    }
    finally {
      setProcessingId(null);
    }
  };

  const handleApprove = async (
    saleReturn: SaleReturnDocument
  ) => {
    setProcessingId(saleReturn.id);
    setMessage(null);

    try {
      // SERVER_RETURN_APPROVE_RUNTIME_V1
      await persistSaleReturnServerAuthority({
        action: "APPROVE",
        saleReturn,
        scope,
        occurredAt: new Date().toISOString(),
      });

      const result =
        await approveSaleReturnWorkflow({
          scope,
          saleReturn,
          actorUserId,

          occurredAt:
            new Date().toISOString(),

          reason:
            "Satış detay ekranından iade onayı"
        });

      if (
        result.outcome ===
        "STATUS_REJECTED"
      ) {
        setMessage(
          `İade onaylanamadı: ${result.reason}`
        );

        return;
      }

      if (
        result.outcome ===
        "FINANCE_ERROR"
      ) {
        setMessage(
          `İade durumu kaydedildi ancak finans kuyruğu hata verdi: ${result.reason}`
        );

        await refresh();
        return;
      }

      setMessage(
        result.financeOutcome ===
          "REPLAY"
          ? "İade onayı ve finans kaydı daha önce tamamlanmış."
          : "İade onaylandı ve finans kaydı oluşturuldu."
      );

      await refresh();
    }
    catch (error) {
      setMessage(
        errorMessage(error)
      );
    }
    finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (
    saleReturn: SaleReturnDocument
  ) => {
    setProcessingId(saleReturn.id);
    setMessage(null);

    try {
      // SERVER_RETURN_REJECT_RUNTIME_V1
      await persistSaleReturnServerAuthority({
        action: "REJECT",
        saleReturn,
        scope,
        occurredAt: new Date().toISOString(),
      });

      const result =
        await rejectSaleReturnWorkflow({
          scope,
          saleReturn,
          actorUserId,

          occurredAt:
            new Date().toISOString(),

          reason:
            "Satış detay ekranından reddedildi"
        });

      if (
        result.outcome ===
        "REJECTED"
      ) {
        setMessage(
          `İade reddedilemedi: ${result.reason}`
        );

        return;
      }

      setMessage(
        result.outcome === "REPLAY"
          ? "İade reddi daha önce kaydedilmiş."
          : "İade reddedildi."
      );

      await refresh();
    }
    catch (error) {
      setMessage(
        errorMessage(error)
      );
    }
    finally {
      setProcessingId(null);
    }
  };

  const handleComplete = async (
    saleReturn: SaleReturnDocument
  ) => {
    setProcessingId(saleReturn.id);
    setMessage(null);

    try {
      // SERVER_RETURN_COMPLETE_RUNTIME_V1
      await persistSaleReturnServerAuthority({
        action: "COMPLETE",
        saleReturn,
        scope,
        occurredAt: new Date().toISOString(),
      });

      const result =
        await completeSaleReturnWorkflow({
          scope,
          saleReturn,
          actorUserId,

          occurredAt:
            new Date().toISOString(),

          reason:
            "Satış detay ekranından iade tamamlandı"
        });

      if (
        result.outcome ===
        "REJECTED"
      ) {
        setMessage(
          `İade tamamlanamadı: ${result.reason}`
        );

        return;
      }

      setMessage(
        result.outcome === "REPLAY"
          ? "İade tamamlama kaydı daha önce oluşturulmuş."
          : "İade süreci tamamlandı."
      );

      await refresh();
    }
    catch (error) {
      setMessage(
        errorMessage(error)
      );
    }
    finally {
      setProcessingId(null);
    }
  };

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/20">
      <h2 className="font-semibold text-amber-950 dark:text-amber-100">
        İade Süreci
      </h2>

      <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
        Onaylanan satış silinmez veya iptal edilmez. Müşteri vazgeçerse ayrı iade belgesi ve ters finans hareketi oluşturulur.
      </p>

      {loading ? (
        <p className="mt-4 text-sm text-gray-500">
          İade kayıtları yükleniyor...
        </p>
      ) : (
        <>
          <div className="mt-4 rounded-lg border border-amber-200 bg-white p-3 text-sm dark:border-amber-900 dark:bg-gray-900">
            <div className="flex justify-between gap-3">
              <span className="text-gray-600 dark:text-gray-400">
                Satış borçlandırması
              </span>

              <strong>
                {money(
                  eligibility?.saleChargeTotal ??
                    0,
                  currency
                )}
              </strong>
            </div>

            <div className="mt-2 flex justify-between gap-3">
              <span className="text-gray-600 dark:text-gray-400">
                Mevcut iadeler
              </span>

              <strong>
                {money(
                  eligibility?.refundTotal ??
                    0,
                  currency
                )}
              </strong>
            </div>

            <div className="mt-2 flex justify-between gap-3 border-t border-gray-200 pt-2 font-bold text-amber-800 dark:border-gray-700 dark:text-amber-300">
              <span>
                İade edilebilir
              </span>

              <span>
                {money(
                  eligibility
                    ?.returnableAmount ??
                    0,
                  currency
                )}
              </span>
            </div>
          </div>

          {canStartReturn &&
            (
              eligibility
                ?.returnableAmount ??
              0
            ) > 0 && (
              <div className="mt-4 space-y-3">
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    İade Tutarı
                  </span>

                  <input
                    type="number"
                    min={0.01}
                    step={0.01}
                    max={
                      eligibility
                        ?.returnableAmount ??
                      undefined
                    }
                    value={amount}
                    onChange={event =>
                      setAmount(
                        Math.max(
                          0,
                          Number(
                            event.target.value
                          ) || 0
                        )
                      )
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-right dark:border-gray-700 dark:bg-gray-900"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    İade Nedeni
                  </span>

                  <textarea
                    value={reason}
                    onChange={event =>
                      setReason(
                        event.target.value
                      )
                    }
                    rows={3}
                    className="w-full resize-y rounded-lg border border-gray-300 bg-white p-2.5 dark:border-gray-700 dark:bg-gray-900"
                    placeholder="İade gerekçesini yazınız"
                  />
                </label>

                <button
                  type="button"
                  disabled={
                    processingId !==
                    null
                  }
                  onClick={() =>
                    void handleStart()
                  }
                  className="w-full rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {processingId ===
                  "START"
                    ? "İade Başlatılıyor..."
                    : "İade Sürecini Başlat"}
                </button>
              </div>
            )}

          {!canStartReturn && (
            <p className="mt-4 rounded-lg bg-gray-100 p-3 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              Bu satış henüz iade sürecine uygun durumda değildir.
            </p>
          )}

          <div className="mt-5 space-y-3">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              İade Belgeleri
            </h3>

            {returns.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Bu satışa ait iade belgesi bulunmuyor.
              </p>
            ) : (
              returns.map(
                saleReturn => {
                  const processing =
                    processingId ===
                    saleReturn.id;

                  return (
                    <article
                      key={saleReturn.id}
                      className="rounded-lg border border-gray-200 bg-white p-3 text-sm dark:border-gray-800 dark:bg-gray-900"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <strong className="text-gray-900 dark:text-white">
                            {money(
                              saleReturn.amount,
                              saleReturn.currency
                            )}
                          </strong>

                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {saleReturn.reason ||
                              "İade nedeni girilmedi."}
                          </p>
                        </div>

                        <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                          {saleReturn.status}
                        </span>
                      </div>

                      {saleReturn.status ===
                        "BAŞLATILDI" && (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={processing}
                            onClick={() =>
                              void handleApprove(
                                saleReturn
                              )
                            }
                            className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            Onayla
                          </button>

                          <button
                            type="button"
                            disabled={processing}
                            onClick={() =>
                              void handleReject(
                                saleReturn
                              )
                            }
                            className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            Reddet
                          </button>
                        </div>
                      )}

                      {saleReturn.status ===
                        "ONAYLANDI" && (
                        <button
                          type="button"
                          disabled={processing}
                          onClick={() =>
                            void handleComplete(
                              saleReturn
                            )
                          }
                          className="mt-3 w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          İadeyi Tamamla
                        </button>
                      )}
                    </article>
                  );
                }
              )
            )}
          </div>
        </>
      )}

      {message && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-white p-3 text-xs font-medium text-gray-700 dark:border-amber-900 dark:bg-gray-900 dark:text-gray-200">
          {message}
        </p>
      )}
    </section>
  );
}