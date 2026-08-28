"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  useErpRuntimeContext,
} from "@/lib/useErpRuntimeContext";
import {
  useStore,
} from "@/store/useStore";
import {
  useSupplyChainStore,
} from "@/store/useSupplyChainStore";
import {
  persistPurchaseDraftServer,
  approvePurchaseDocumentServer,
} from "@/lib/purchaseApprovalRuntimeClient";
import type {
  PurchaseDraftLineInput,
} from "@/lib/purchaseApprovalServerContract";
import type {
  PurchaseDocument,
  PurchaseQuantityUnit,
  PurchaseTaxRate,
} from "@/lib/purchaseContracts";

type LineForm = {
  id: string;
  stockItemId: string;
  kind: "GOODS" | "SERVICE";
  description: string;
  quantity: string;
  unit: PurchaseQuantityUnit;
  unitPrice: string;
  taxRate: string;
  taxIncluded: boolean | null;
};

const allowedTax =
  new Set(["0","1","10","20"]);

function id() {
  return crypto.randomUUID();
}

function unitFromProduct(
  value: string | undefined,
  service: boolean,
): PurchaseQuantityUnit {
  if (service) {
    return "hizmet";
  }

  const normalized =
    String(value || "")
      .trim()
      .toLocaleLowerCase("tr-TR");

  if (
    normalized.includes("m²") ||
    normalized.includes("m2")
  ) {
    return "m2";
  }

  if (
    normalized.includes("adet")
  ) {
    return "adet";
  }

  if (
    normalized.includes("paket")
  ) {
    return "paket";
  }

  if (
    normalized.includes("set")
  ) {
    return "set";
  }

  if (
    normalized.includes("kg")
  ) {
    return "kg";
  }

  return "mt";
}

function blankLine(): LineForm {
  return {
    id: id(),
    stockItemId: "",
    kind: "GOODS",
    description: "",
    quantity: "1",
    unit: "mt",
    unitPrice: "",
    taxRate: "",
    taxIncluded: null,
  };
}

export default function PurchasePage() {
  const {
    scope,
  } = useErpRuntimeContext();

  const products =
    useStore(
      state => state.products,
    );
  const customers =
    useStore(
      state => state.customers,
    );
  const updateProduct =
    useStore(
      state => state.updateProduct,
    );
  const pending =
    useSupplyChainStore(
      state =>
        state.purchaseDocuments,
    );

  const [
    purchaseDocumentId,
    setPurchaseDocumentId,
  ] = useState<string>(id());
  const [
    documentNo,
    setDocumentNo,
  ] = useState("");
  const [
    supplierId,
    setSupplierId,
  ] = useState("");
  const [
    documentDate,
    setDocumentDate,
  ] = useState(
    new Date()
      .toISOString()
      .slice(0,10),
  );
  const [
    lines,
    setLines,
  ] = useState<LineForm[]>([
    blankLine(),
  ]);
  const [
    payloadHash,
    setPayloadHash,
  ] = useState<string | null>(
    null,
  );
  const [
    message,
    setMessage,
  ] = useState("");
  const [
    busy,
    setBusy,
  ] = useState(false);

  const pendingHere =
    useMemo(
      () =>
        scope
          ? pending.filter(
              document =>
                document.tenantId ===
                  scope.tenantId &&
                document.companyId ===
                  scope.companyId &&
                document.branchId ===
                  scope.branchId &&
                document.accountingPeriodId ===
                  scope.accountingPeriodId &&
                (
                  document.status ===
                    "PENDING_INFO" ||
                  document.status ===
                    "DRAFT"
                ),
            )
          : [],
      [pending, scope],
    );

  const supplier =
    customers.find(
      customer =>
        customer.id === supplierId,
    );

  function changed() {
    setPayloadHash(null);
    setMessage("");
  }

  function patchLine(
    lineId: string,
    patch: Partial<LineForm>,
  ) {
    changed();
    setLines(
      current =>
        current.map(
          line =>
            line.id === lineId
              ? {
                  ...line,
                  ...patch,
                }
              : line,
        ),
    );
  }

  function chooseProduct(
    lineId: string,
    stockItemId: string,
  ) {
    const product =
      products.find(
        item =>
          item.id === stockItemId,
      );

    if (!product) {
      patchLine(
        lineId,
        {
          stockItemId: "",
          description: "",
          unitPrice: "",
          taxRate: "",
        },
      );
      return;
    }

    const service =
      product.productKind ===
        "SERVICE";

    const vat =
      product.purchaseVatRate;

    patchLine(
      lineId,
      {
        stockItemId:
          product.id,
        kind:
          service
            ? "SERVICE"
            : "GOODS",
        description:
          product.name,
        unit:
          unitFromProduct(
            product.unit,
            service,
          ),
        unitPrice:
          typeof product.purchasePrice1 ===
            "number"
            ? String(
                product.purchasePrice1,
              )
            : "",
        taxRate:
          typeof vat === "number" &&
          allowedTax.has(
            String(vat),
          )
            ? String(vat)
            : "",
        taxIncluded: null,
      },
    );
  }

  function openPending(
    document: PurchaseDocument,
  ) {
    changed();
    setPurchaseDocumentId(
      document.id,
    );
    setDocumentNo(
      document.documentNo || "",
    );
    setSupplierId(
      document.supplierId,
    );
    setDocumentDate(
      document.documentDate
        ? document.documentDate
            .slice(0,10)
        : new Date()
            .toISOString()
            .slice(0,10),
    );
    setLines(
      document.lines.map(
        line => ({
          id: line.id,
          stockItemId:
            line.stockItemId || "",
          kind: line.kind,
          description:
            line.description,
          quantity:
            String(line.quantity),
          unit: line.unit,
          unitPrice:
            line.unitPrice === null
              ? ""
              : String(
                  line.unitPrice,
                ),
          taxRate:
            line.taxRate === null
              ? ""
              : String(
                  line.taxRate,
                ),
          taxIncluded:
            line.taxIncluded,
        }),
      ),
    );
  }

  function canonicalLines():
  PurchaseDraftLineInput[] {
    return lines.map(
      line => {
        const quantity =
          Number(
            line.quantity
              .replace(",","."),
          );
        const unitPrice =
          Number(
            line.unitPrice
              .replace(",","."),
          );

        if (
          !line.description.trim() ||
          !Number.isFinite(quantity) ||
          quantity <= 0 ||
          line.unitPrice.trim() ===
            "" ||
          !Number.isFinite(
            unitPrice,
          ) ||
          !allowedTax.has(
            line.taxRate,
          ) ||
          typeof line.taxIncluded !==
            "boolean"
        ) {
          throw new Error(
            "Satırdaki fiyat, KDV ve KDV Dahil/Hariç bilgilerini tamamlayın.",
          );
        }

        return {
          id: line.id,
          kind: line.kind,
          stockItemId:
            line.stockItemId ||
            undefined,
          description:
            line.description,
          quantity,
          unit: line.unit,
          unitPrice,
          taxRate:
            Number(
              line.taxRate,
            ) as PurchaseTaxRate,
          taxIncluded:
            line.taxIncluded,
        };
      },
    );
  }

  async function saveDraft() {
    if (!scope) {
      setMessage(
        "Şirket kapsamı hazır değil.",
      );
      return;
    }

    if (
      !documentNo.trim() ||
      !supplierId.trim()
    ) {
      setMessage(
        "Fatura no ve tedarikçi zorunludur.",
      );
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const result =
        await persistPurchaseDraftServer({
          ...scope,
          purchaseDocumentId,
          documentNo:
            documentNo.trim(),
          supplierId,
          supplierName:
            supplier?.name || null,
          documentDate:
            new Date(
              `${documentDate}T12:00:00`,
            ).toISOString(),
          currency: "TRY",
          status: "DRAFT",
          lines:
            canonicalLines(),
        });

      setPayloadHash(
        result.payloadHash,
      );
      setMessage(
        "Alış taslağı kaydedildi. Şimdi onaylanabilir.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Alış taslağı kaydedilemedi.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (
      !scope ||
      !payloadHash
    ) {
      setMessage(
        "Önce güncel alış taslağını kaydedin.",
      );
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const result =
        await approvePurchaseDocumentServer({
          ...scope,
          purchaseDocumentId,
          approvalIdempotencyKey:
            `PURCHASE_APPROVAL:${purchaseDocumentId}`,
          expectedDraftPayloadHash:
            payloadHash,
        });

      for (
        const update of
          result.price1Updates
      ) {
        updateProduct(
          update.stockItemId,
          {
            purchasePrice1:
              update.purchasePrice1,
          },
        );
      }

      setMessage(
        `Alış onaylandı. Tedarikçi borcu oluştu; ${result.price1Updates.length} stok kartında Alış Fiyat 1 güncellendi.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Alış onaylanamadı.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">
          Alış
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Mal Kabul stoğu oluşturur. Bu ekran alış fiyatını ve faturayı tamamlar; stok miktarını ikinci kez artırmaz.
        </p>
      </div>

      {pendingHere.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="font-bold text-amber-900">
            Bekleyen Alışlar
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {pendingHere.map(
              document => (
                <button
                  key={document.id}
                  type="button"
                  onClick={() =>
                    openPending(
                      document,
                    )
                  }
                  className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-bold text-amber-900"
                >
                  {document.documentNo ||
                    "Belge bilgisi bekliyor"} — {document.supplierName || document.supplierId}
                </button>
              ),
            )}
          </div>
        </section>
      )}

      <section className="grid gap-3 rounded-xl border bg-white p-4 dark:bg-slate-900 md:grid-cols-3">
        <label className="text-sm font-semibold">
          Fatura No
          <input
            value={documentNo}
            onChange={event => {
              changed();
              setDocumentNo(
                event.target.value,
              );
            }}
            className="mt-1 w-full rounded-lg border px-3 py-2"
          />
        </label>

        <label className="text-sm font-semibold">
          Tedarikçi
          <select
            value={supplierId}
            onChange={event => {
              changed();
              setSupplierId(
                event.target.value,
              );
            }}
            className="mt-1 w-full rounded-lg border px-3 py-2"
          >
            <option value="">
              Tedarikçi seç
            </option>
            {customers.map(
              customer => (
                <option
                  key={customer.id}
                  value={customer.id}
                >
                  {customer.name}
                </option>
              ),
            )}
          </select>
        </label>

        <label className="text-sm font-semibold">
          Fatura Tarihi
          <input
            type="date"
            value={documentDate}
            onChange={event => {
              changed();
              setDocumentDate(
                event.target.value,
              );
            }}
            className="mt-1 w-full rounded-lg border px-3 py-2"
          />
        </label>
      </section>

      <section className="space-y-3">
        {lines.map(
          (line, index) => (
            <div
              key={line.id}
              className="rounded-xl border bg-white p-4 dark:bg-slate-900"
            >
              <div className="mb-3 font-bold">
                Satır {index + 1}
              </div>

              <div className="grid gap-3 md:grid-cols-6">
                <label className="text-xs font-bold md:col-span-2">
                  Stok / Hizmet
                  <select
                    value={line.stockItemId}
                    onChange={event =>
                      chooseProduct(
                        line.id,
                        event.target.value,
                      )
                    }
                    className="mt-1 w-full rounded-lg border px-2 py-2"
                  >
                    <option value="">
                      Seç
                    </option>
                    {products.map(
                      product => (
                        <option
                          key={product.id}
                          value={product.id}
                        >
                          {product.stockCode} — {product.name}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label className="text-xs font-bold">
                  Miktar
                  <input
                    value={line.quantity}
                    onChange={event =>
                      patchLine(
                        line.id,
                        {
                          quantity:
                            event.target.value,
                        },
                      )
                    }
                    className="mt-1 w-full rounded-lg border px-2 py-2"
                  />
                </label>

                <label className="text-xs font-bold">
                  Alış Fiyatı
                  <input
                    value={line.unitPrice}
                    onChange={event =>
                      patchLine(
                        line.id,
                        {
                          unitPrice:
                            event.target.value,
                        },
                      )
                    }
                    className="mt-1 w-full rounded-lg border px-2 py-2"
                  />
                  <span className="mt-1 block text-[10px] font-normal text-slate-500">
                    Stok kartındaki Alış Fiyat 1 otomatik gelir.
                  </span>
                </label>

                <label className="text-xs font-bold">
                  KDV
                  <select
                    value={line.taxRate}
                    onChange={event =>
                      patchLine(
                        line.id,
                        {
                          taxRate:
                            event.target.value,
                        },
                      )
                    }
                    className="mt-1 w-full rounded-lg border px-2 py-2"
                  >
                    <option value="">
                      Seç — genel öneri %10
                    </option>
                    <option value="0">%0</option>
                    <option value="1">%1</option>
                    <option value="10">%10</option>
                    <option value="20">%20</option>
                  </select>
                </label>

                <div className="text-xs font-bold">
                  KDV Şekli
                  <div className="mt-1 grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        patchLine(
                          line.id,
                          {
                            taxIncluded:
                              true,
                          },
                        )
                      }
                      className={`rounded-lg border px-2 py-2 ${line.taxIncluded === true ? "bg-blue-600 text-white" : "bg-white"}`}
                    >
                      Dahil
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        patchLine(
                          line.id,
                          {
                            taxIncluded:
                              false,
                          },
                        )
                      }
                      className={`rounded-lg border px-2 py-2 ${line.taxIncluded === false ? "bg-blue-600 text-white" : "bg-white"}`}
                    >
                      Hariç
                    </button>
                  </div>
                </div>
              </div>

              {lines.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    changed();
                    setLines(
                      current =>
                        current.filter(
                          currentLine =>
                            currentLine.id !==
                            line.id,
                        ),
                    );
                  }}
                  className="mt-3 text-xs font-bold text-red-600"
                >
                  Satırı kaldır
                </button>
              )}
            </div>
          ),
        )}

        <button
          type="button"
          onClick={() => {
            changed();
            setLines(
              current => [
                ...current,
                blankLine(),
              ],
            );
          }}
          className="rounded-lg border px-4 py-2 text-sm font-bold"
        >
          + Satır ekle
        </button>
      </section>

      {message && (
        <div className="rounded-lg border bg-slate-50 p-3 text-sm font-semibold">
          {message}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void saveDraft()
          }
          className="rounded-lg bg-slate-800 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          Alış Taslağını Kaydet
        </button>
        <button
          type="button"
          disabled={
            busy ||
            !payloadHash
          }
          onClick={() =>
            void approve()
          }
          className="rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          Alışı Onayla
        </button>
      </div>

      <p className="text-xs text-slate-500">
        Onay sırasında gerçek fatura fiyatı Alış Fiyat 1 olur. Alış Fiyat 2/3/4 değiştirilmez.
      </p>

      <div className="text-xs text-slate-400">
        Belge: {purchaseDocumentId}
      </div>
    </div>
  );
}
