"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useErpRuntimeContext,
} from "@/lib/useErpRuntimeContext";
import {
  createPurchaseReturnServer,
  loadPurchaseServerSnapshot,
  type PurchaseServerDocument,
  type PurchaseServerSnapshot,
} from "@/lib/purchaseReturnRuntimeClient";

function money(
  value: number,
) {
  return value.toLocaleString(
    "tr-TR",
    {
      style: "currency",
      currency: "TRY",
    },
  );
}

export default function PurchaseReturnPage() {
  const {
    scope,
  } = useErpRuntimeContext();

  const [
    snapshot,
    setSnapshot,
  ] = useState<
    PurchaseServerSnapshot | null
  >(null);
  const [
    selectedId,
    setSelectedId,
  ] = useState("");
  const [
    quantities,
    setQuantities,
  ] = useState<
    Record<string,string>
  >({});
  const [
    reason,
    setReason,
  ] = useState("");
  const [
    message,
    setMessage,
  ] = useState("");
  const [
    busy,
    setBusy,
  ] = useState(false);

  async function refresh() {
    setBusy(true);
    try {
      setSnapshot(
        await loadPurchaseServerSnapshot(),
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Alışlar yüklenemedi.",
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!scope) {
      return;
    }

    let cancelled = false;

    void (async () => {
      setBusy(true);

      try {
        const next =
          await loadPurchaseServerSnapshot();

        if (!cancelled) {
          setSnapshot(next);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Alışlar yüklenemedi.",
          );
        }
      } finally {
        if (!cancelled) {
          setBusy(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [scope]);

  const approved =
    useMemo(
      () =>
        snapshot?.purchases.filter(
          purchase =>
            purchase.status ===
              "APPROVED",
        ) || [],
      [snapshot],
    );

  const selected:
  PurchaseServerDocument | undefined =
    approved.find(
      purchase =>
        purchase.purchaseDocumentId ===
          selectedId,
    );

  function alreadyReturned(
    lineId: string,
  ) {
    return (
      snapshot?.returnLines
        .filter(
          line =>
            line.purchaseDocumentId ===
              selectedId &&
            line.purchaseDocumentLineId ===
              lineId,
        )
        .reduce(
          (sum, line) =>
            sum + line.quantity,
          0,
        ) || 0
    );
  }

  async function submit() {
    if (
      !scope ||
      !selected
    ) {
      setMessage(
        "Onaylı alış seçiniz.",
      );
      return;
    }

    if (!reason.trim()) {
      setMessage(
        "İade nedeni zorunludur.",
      );
      return;
    }

    const lines =
      selected.lines
        .map(
          line => ({
            purchaseDocumentLineId:
              line.id,
            quantity:
              Number(
                (
                  quantities[
                    line.id
                  ] || ""
                ).replace(",","."),
              ),
          }),
        )
        .filter(
          line =>
            Number.isFinite(
              line.quantity,
            ) &&
            line.quantity > 0,
        );

    if (lines.length === 0) {
      setMessage(
        "En az bir iade miktarı giriniz.",
      );
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const purchaseReturnId =
        crypto.randomUUID();

      const result =
        await createPurchaseReturnServer({
          ...scope,
          purchaseReturnId,
          purchaseDocumentId:
            selected.purchaseDocumentId,
          idempotencyKey:
            `PURCHASE_RETURN:${purchaseReturnId}`,
          returnedAt:
            new Date().toISOString(),
          reason:
            reason.trim(),
          lines,
        });

      setMessage(
        `Alış iadesi kaydedildi. ${money(result.grossAmount)} tedarikçi borcundan ters kayıt edildi.`,
      );
      setQuantities({});
      setReason("");
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Alış iadesi kaydedilemedi.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">
          Alış İade
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Yalnız onaylı alıştan iade yapılır. Mal satırı stoktan düşer; tedarikçi borcu ters kayıtla azalır.
        </p>
      </div>

      <label className="block text-sm font-bold">
        Onaylı Alış
        <select
          value={selectedId}
          onChange={event => {
            setSelectedId(
              event.target.value,
            );
            setQuantities({});
            setMessage("");
          }}
          className="mt-1 w-full rounded-lg border px-3 py-2"
        >
          <option value="">
            Alış seç
          </option>
          {approved.map(
            purchase => (
              <option
                key={
                  purchase.purchaseDocumentId
                }
                value={
                  purchase.purchaseDocumentId
                }
              >
                {purchase.documentNo} — {purchase.supplierName || purchase.supplierId} — {money(purchase.grandTotal)}
              </option>
            ),
          )}
        </select>
      </label>

      {selected && (
        <section className="space-y-3">
          {selected.lines.map(
            line => {
              const returned =
                alreadyReturned(
                  line.id,
                );
              const remaining =
                Math.max(
                  0,
                  line.quantity -
                    returned,
                );

              return (
                <div
                  key={line.id}
                  className="grid gap-2 rounded-xl border bg-white p-4 dark:bg-slate-900 md:grid-cols-[1fr_140px_160px]"
                >
                  <div>
                    <div className="font-bold">
                      {line.description}
                    </div>
                    <div className="text-xs text-slate-500">
                      Alınan: {line.quantity} {line.unit} · Daha önce iade: {returned} · Kalan iade hakkı: {remaining}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {line.kind === "GOODS"
                        ? "Mal: iade edilince stoktan OUT hareketi oluşur."
                        : "Hizmet: stok hareketi oluşmaz; finansal ters kayıt yapılır."}
                    </div>
                  </div>

                  <div className="text-right text-sm font-bold">
                    {money(line.grossAmount)}
                  </div>

                  <input
                    aria-label={`${line.description} iade miktarı`}
                    placeholder="İade miktarı"
                    disabled={
                      remaining <= 0
                    }
                    value={
                      quantities[
                        line.id
                      ] || ""
                    }
                    onChange={event =>
                      setQuantities(
                        current => ({
                          ...current,
                          [line.id]:
                            event.target.value,
                        }),
                      )
                    }
                    className="rounded-lg border px-3 py-2"
                  />
                </div>
              );
            },
          )}

          <label className="block text-sm font-bold">
            İade Nedeni
            <textarea
              value={reason}
              onChange={event =>
                setReason(
                  event.target.value,
                )
              }
              className="mt-1 min-h-24 w-full rounded-lg border px-3 py-2"
              placeholder="Örn. Hatalı ürün / fazla sevkiyat / fiyat anlaşmazlığı"
            />
          </label>

          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void submit()
            }
            className="rounded-lg bg-red-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            Alış İadeyi Kaydet
          </button>
        </section>
      )}

      {message && (
        <div className="rounded-lg border bg-slate-50 p-3 text-sm font-semibold">
          {message}
        </div>
      )}
    </div>
  );
}
