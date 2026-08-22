"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  Product,
} from "@/store/useStore";
import {
  BarcodeScannerButton,
} from "@/components/stock/BarcodeScannerButton";

interface StockItemPickerProps {
  products: Product[];
  value?: string;
  disabled?: boolean;
  filterProduct?: (product: Product) => boolean;
  restrictionMessage?: string;
  pickerTitle?: string;
  helperText?: string;
  autoOpen?: boolean;
  hideTrigger?: boolean;
  onRequestClose?: () => void;
  onSelect(product: Product): void;
}

function searchText(
  product: Product,
): string {
  return [
    product.stockCode,
    product.name,
    product.brand,
    product.barcode1,
    product.barcode2,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("tr");
}

export function StockItemPicker({
  products,
  value,
  disabled = false,
  filterProduct,
  restrictionMessage = "Bu stok bu işlem için seçilemez.",
  pickerTitle = "Stok Seç",
  helperText,
  autoOpen = false,
  hideTrigger = false,
  onRequestClose,
  onSelect,
}: StockItemPickerProps) {
  const [query, setQuery] =
    useState("");
  const [open, setOpen] =
    useState(autoOpen);
  const [message, setMessage] =
    useState<string | null>(
      null,
    );

  const allPhysicalProducts = useMemo(
    () =>
      products.filter(
        product =>
          product.productKind !==
          "SERVICE",
      ),
    [products],
  );

  const stockProducts = useMemo(
    () =>
      allPhysicalProducts
        .filter(product =>
          filterProduct
            ? filterProduct(product)
            : true,
        )
        .sort((left, right) =>
          left.name.localeCompare(
            right.name,
            "tr",
          ),
        ),
    [allPhysicalProducts, filterProduct],
  );

  const selected =
    stockProducts.find(
      product =>
        product.id === value,
    );

  const matches = useMemo(() => {
    const normalized =
      query
        .trim()
        .toLocaleLowerCase("tr");

    if (!normalized) {
      return stockProducts.slice(
        0,
        60,
      );
    }

    return stockProducts
      .filter(product =>
        searchText(product).includes(
          normalized,
        ),
      )
      .slice(0, 60);
  }, [query, stockProducts]);

  const closePicker = () => {
    setOpen(false);
    setQuery("");
    setMessage(null);
    onRequestClose?.();
  };

  useEffect(() => {
    if (autoOpen) {
      setOpen(true);
    }
  }, [autoOpen]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    const onKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (event.key === "Escape") {
        closePicker();
      }
    };

    window.addEventListener(
      "keydown",
      onKeyDown,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;
      window.removeEventListener(
        "keydown",
        onKeyDown,
      );
    };
  }, [open]);

  const choose = (
    product: Product,
  ) => {
    onSelect(product);
    closePicker();
  };

  const handleBarcode = (
    barcode: string,
  ) => {
    const normalized =
      barcode.trim();

    const barcodeMatches =
      stockProducts.filter(
        product =>
          product.barcode1?.trim() ===
            normalized ||
          product.barcode2?.trim() ===
            normalized,
      );

    if (
      barcodeMatches.length === 1
    ) {
      choose(
        barcodeMatches[0],
      );
      return;
    }

    if (
      barcodeMatches.length === 0
    ) {
      const excludedBarcodeMatch =
        allPhysicalProducts.find(
          product =>
            product.barcode1?.trim() ===
              normalized ||
            product.barcode2?.trim() ===
              normalized,
        );

      setMessage(
        excludedBarcodeMatch
          ? restrictionMessage
          : `Barkodla eşleşen stok bulunamadı: ${normalized}`,
      );
      setOpen(true);
      return;
    }

    setMessage(
      "Aynı barkod birden fazla stok kartında kayıtlı. Otomatik seçim yapılmadı.",
    );
    setOpen(true);
  };

  return (
    <>
      {!hideTrigger && (
        <div className="min-w-[230px]">
          {selected && (
            <div className="mb-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-xs dark:border-blue-900 dark:bg-blue-950/30">
              <div className="font-bold text-blue-800 dark:text-blue-300">
                {selected.stockCode}
                {" — "}
                {selected.name}
              </div>

              {selected.brand && (
                <div className="mt-0.5 text-blue-600 dark:text-blue-400">
                  {selected.brand}
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setMessage(null);
              setOpen(true);
            }}
            className="flex h-10 w-full min-w-0 items-center justify-between rounded-lg border border-gray-300 bg-white px-3 text-left text-xs text-gray-700 outline-none transition hover:border-blue-400 hover:bg-blue-50/40 focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-blue-700 dark:hover:bg-blue-950/20"
            aria-haspopup="dialog"
            aria-expanded={open}
          >
            <span className="truncate">
              {selected
                ? "Stoku değiştir..."
                : "Stok kodu / adı / marka / barkod..."}
            </span>
            <span className="ml-2 text-[10px] font-bold text-blue-600 dark:text-blue-400">
              SEÇ
            </span>
          </button>
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-sm sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-label={pickerTitle}
          onMouseDown={event => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closePicker();
            }
          }}
        >
          <div className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <div>
                <h3 className="text-base font-bold text-white">
                  {pickerTitle}
                </h3>
                {helperText && (
                  <p className="mt-1 text-xs text-slate-400">
                    {helperText}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={closePicker}
                className="ml-3 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-700 text-xl text-slate-300 hover:bg-slate-800 hover:text-white"
                aria-label="Stok seçimini kapat"
              >
                ×
              </button>
            </div>

            <div className="border-b border-slate-800 p-3 sm:p-4">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={query}
                  autoFocus
                  onChange={event => {
                    setQuery(
                      event.target.value,
                    );
                    setMessage(null);
                  }}
                  placeholder="Stok kodu / adı / marka / barkod ara"
                  className="h-11 min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                />

                <BarcodeScannerButton
                  disabled={disabled}
                  onDetected={
                    handleBarcode
                  }
                  title="Kamera ile barkod okut"
                />
              </div>

              {message && (
                <div className="mt-3 rounded-xl border border-amber-800/60 bg-amber-950/30 p-3 text-xs font-medium text-amber-300">
                  {message}
                </div>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-3">
              {matches.map(
                product => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() =>
                      choose(product)
                    }
                    className="mb-2 block min-h-16 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-3 text-left transition hover:border-blue-700 hover:bg-slate-800 active:scale-[0.995]"
                  >
                    <div className="font-bold text-white">
                      {product.stockCode}
                      {" — "}
                      {product.name}
                    </div>

                    <div className="mt-1 text-xs text-slate-400">
                      {[
                        product.brand,
                        product.barcode1,
                        product.barcode2,
                      ]
                        .filter(Boolean)
                        .join(" • ") ||
                        "Ek bilgi yok"}
                    </div>
                  </button>
                ),
              )}

              {matches.length === 0 &&
                !message && (
                  <div className="p-6 text-center text-sm text-slate-400">
                    Eşleşen stok bulunamadı.
                  </div>
                )}
            </div>

            <div className="border-t border-slate-800 bg-slate-950 p-3">
              <button
                type="button"
                onClick={closePicker}
                className="min-h-11 w-full rounded-xl border border-slate-700 px-4 text-sm font-bold text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}