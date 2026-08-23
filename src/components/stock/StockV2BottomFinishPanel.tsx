"use client";

import {
  useMemo,
  useState,
} from "react";
import type {
  StockV2BottomFinishKind,
  StockV2BottomFinishOption,
  StockV2PricingBasis,
  StockV2ProductProfile,
} from "@/lib/stock/stockV2Contracts";
import { useStockV2Store } from "@/store/useStockV2Store";

type OptionDraft = {
  id?: string;
  kind: StockV2BottomFinishKind;
  code: string;
  name: string;
  pricingBasis: StockV2PricingBasis;
  purchaseUnitPrice: string;
  saleUnitPrice: string;
  purchaseVatRate: string;
  saleVatRate: string;
};

const emptyDraft = (): OptionDraft => ({
  kind: "HEM_MODEL",
  code: "",
  name: "",
  pricingBasis: "WIDTH_METER",
  purchaseUnitPrice: "",
  saleUnitPrice: "",
  purchaseVatRate: "",
  saleVatRate: "",
});

function numberOrUndefined(
  value: string,
): number | undefined {
  const normalized =
    value.replace(",", ".").trim();

  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed)
    ? parsed
    : undefined;
}

function createId(): string {
  if (
    typeof globalThis.crypto?.randomUUID ===
    "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  throw new Error(
    "STOCK_V2_RANDOM_UUID_UNAVAILABLE",
  );
}

function kindLabel(
  kind: StockV2BottomFinishKind,
): string {
  return kind === "HEM_MODEL"
    ? "Etek Modeli"
    : "Etek Lazer";
}

function basisLabel(
  basis: StockV2PricingBasis,
): string {
  if (basis === "WIDTH_METER") {
    return "EN üzerinden mt";
  }
  if (basis === "AREA_M2") {
    return "Alan üzerinden m²";
  }
  if (basis === "PIECE") {
    return "Adet";
  }
  return "Sabit fiyat";
}

export function StockV2BottomFinishPanel({
  productId,
  profile,
  isSaved,
}: {
  productId: string;
  profile?: StockV2ProductProfile;
  isSaved: boolean;
}) {
  const options = useStockV2Store(
    state => state.bottomFinishOptions,
  );
  const upsertOption = useStockV2Store(
    state => state.upsertBottomFinishOption,
  );

  const [draft, setDraft] =
    useState<OptionDraft>(emptyDraft);
  const [message, setMessage] =
    useState<string | null>(null);

  const productOptions = useMemo(() => {
    if (!profile) {
      return [];
    }

    return options
      .filter(
        option =>
          option.productId === productId &&
          option.scope.tenantId ===
            profile.scope.tenantId &&
          option.scope.companyId ===
            profile.scope.companyId &&
          option.scope.branchId ===
            profile.scope.branchId &&
          option.scope.accountingPeriodId ===
            profile.scope.accountingPeriodId,
      )
      .sort((left, right) =>
        left.code.localeCompare(
          right.code,
          "tr",
        ),
      );
  }, [options, productId, profile]);

  if (!isSaved) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
        Etek Modeli / Etek Lazer tanımlamak
        için önce stok kartını kaydedin.
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
        Stok V2 ürün ailesi henüz
        kaydedilmemiş. Kartı kaydedip tekrar
        açın.
      </div>
    );
  }

  if (!profile.bottomFinishEnabled) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-950/50 dark:text-gray-300">
        Bu ürün ailesinde Etek Modeli /
        Etek Lazer kullanılmaz.
      </div>
    );
  }

  const saveDraft = () => {
    const code = draft.code.trim();
    const name = draft.name.trim();

    if (!code || !name) {
      setMessage(
        "Model kodu ve model adı zorunludur.",
      );
      return;
    }

    const now = new Date().toISOString();
    const existing = draft.id
      ? productOptions.find(
          option => option.id === draft.id,
        )
      : undefined;

    const option: StockV2BottomFinishOption = {
      id: draft.id ?? createId(),
      productId,
      scope: profile.scope,
      kind: draft.kind,
      code,
      name,
      pricingBasis: draft.pricingBasis,
      purchaseUnitPrice:
        numberOrUndefined(
          draft.purchaseUnitPrice,
        ),
      saleUnitPrice:
        numberOrUndefined(
          draft.saleUnitPrice,
        ),
      purchaseVatRate:
        numberOrUndefined(
          draft.purchaseVatRate,
        ),
      saleVatRate:
        numberOrUndefined(
          draft.saleVatRate,
        ),
      isActive:
        existing?.isActive ?? true,
      createdAt:
        existing?.createdAt ?? now,
      updatedAt: now,
    };

    try {
      upsertOption(option);
      setDraft(emptyDraft());
      setMessage(null);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Ürün seçeneği kaydedilemedi.",
      );
    }
  };

  const editOption = (
    option: StockV2BottomFinishOption,
  ) => {
    setDraft({
      id: option.id,
      kind: option.kind,
      code: option.code,
      name: option.name,
      pricingBasis:
        option.pricingBasis,
      purchaseUnitPrice:
        option.purchaseUnitPrice?.toString() ??
        "",
      saleUnitPrice:
        option.saleUnitPrice?.toString() ??
        "",
      purchaseVatRate:
        option.purchaseVatRate?.toString() ??
        "",
      saleVatRate:
        option.saleVatRate?.toString() ??
        "",
    });
    setMessage(null);
  };

  const toggleActive = (
    option: StockV2BottomFinishOption,
  ) => {
    try {
      upsertOption({
        ...option,
        isActive: !option.isActive,
        updatedAt:
          new Date().toISOString(),
      });
      setMessage(null);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Ürün seçeneği güncellenemedi.",
      );
    }
  };

  return (
    <div className="mt-5 space-y-4 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
      <div>
        <div className="text-sm font-semibold text-gray-900 dark:text-white">
          Etek Seçenekleri
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Yalnız Etek Modeli ve Etek Lazer
          kullanılır. Satışta ikisinden yalnız
          biri seçilebilir.
        </p>
      </div>

      {message && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {message}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
          Tür
          <select
            value={draft.kind}
            onChange={event =>
              setDraft(current => ({
                ...current,
                kind:
                  event.target
                    .value as StockV2BottomFinishKind,
              }))
            }
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          >
            <option value="HEM_MODEL">
              Etek Modeli
            </option>
            <option value="HEM_LASER">
              Etek Lazer
            </option>
          </select>
        </label>

        <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
          Model Kodu
          <input
            value={draft.code}
            onChange={event =>
              setDraft(current => ({
                ...current,
                code: event.target.value,
              }))
            }
            placeholder="ST 01 / LZ 01"
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          />
        </label>

        <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
          Model Adı
          <input
            value={draft.name}
            onChange={event =>
              setDraft(current => ({
                ...current,
                name: event.target.value,
              }))
            }
            placeholder="Örn. Model 01"
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          />
        </label>

        <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
          Hesaplama
          <select
            value={draft.pricingBasis}
            onChange={event =>
              setDraft(current => ({
                ...current,
                pricingBasis:
                  event.target
                    .value as StockV2PricingBasis,
              }))
            }
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          >
            <option value="WIDTH_METER">
              EN üzerinden mt
            </option>
            <option value="AREA_M2">
              Alan üzerinden m²
            </option>
            <option value="PIECE">
              Adet
            </option>
            <option value="FIXED">
              Sabit fiyat
            </option>
          </select>
        </label>

        <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
          Alış Fiyatı
          <input
            inputMode="decimal"
            value={
              draft.purchaseUnitPrice
            }
            onChange={event =>
              setDraft(current => ({
                ...current,
                purchaseUnitPrice:
                  event.target.value,
              }))
            }
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          />
        </label>

        <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
          Satış Fiyatı
          <input
            inputMode="decimal"
            value={draft.saleUnitPrice}
            onChange={event =>
              setDraft(current => ({
                ...current,
                saleUnitPrice:
                  event.target.value,
              }))
            }
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          />
        </label>

        <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
          Alış KDV %
          <input
            inputMode="decimal"
            value={draft.purchaseVatRate}
            onChange={event =>
              setDraft(current => ({
                ...current,
                purchaseVatRate:
                  event.target.value,
              }))
            }
            placeholder="Boş bırakılabilir"
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          />
        </label>

        <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
          Satış KDV %
          <input
            inputMode="decimal"
            value={draft.saleVatRate}
            onChange={event =>
              setDraft(current => ({
                ...current,
                saleVatRate:
                  event.target.value,
              }))
            }
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={saveDraft}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {draft.id
            ? "Modeli Güncelle"
            : "Model Ekle"}
        </button>

        {draft.id && (
          <button
            type="button"
            onClick={() =>
              setDraft(emptyDraft())
            }
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Vazgeç
          </button>
        )}
      </div>

      {productOptions.length > 0 && (
        <div className="space-y-2">
          {productOptions.map(option => (
            <div
              key={option.id}
              className="flex flex-col gap-3 rounded-lg border border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800"
            >
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  {kindLabel(option.kind)} —{" "}
                  {option.code}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {option.name} •{" "}
                  {basisLabel(
                    option.pricingBasis,
                  )}
                  {!option.isActive &&
                    " • Pasif"}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    editOption(option)
                  }
                  className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Düzenle
                </button>
                <button
                  type="button"
                  onClick={() =>
                    toggleActive(option)
                  }
                  className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  {option.isActive
                    ? "Pasife Al"
                    : "Aktifleştir"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
