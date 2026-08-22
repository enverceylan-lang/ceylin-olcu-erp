"use client";

import {
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
  onSelect,
}: StockItemPickerProps) {
  const [query, setQuery] =
    useState("");
  const [open, setOpen] =
    useState(false);
  const [message, setMessage] =
    useState<string | null>(
      null,
    );

  const allPhysicalProducts = useMemo(
    () =>
      products.filter(
        product => product.productKind !== "SERVICE",
      ),
    [products],
  );

  const stockProducts = useMemo(
    () =>
      allPhysicalProducts
        .filter(product =>
          filterProduct ? filterProduct(product) : true,
        )
        .sort((left, right) =>
          left.name.localeCompare(right.name, "tr"),
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
        40,
      );
    }

    return stockProducts
      .filter(product =>
        searchText(product).includes(
          normalized,
        ),
      )
      .slice(0, 40);
  }, [query, stockProducts]);

  const choose = (
    product: Product,
  ) => {
    onSelect(product);
    setQuery("");
    setOpen(false);
    setMessage(null);
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
            product.barcode1?.trim() === normalized ||
            product.barcode2?.trim() === normalized,
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

      <div className="flex items-center gap-1.5">
        <div className="relative min-w-0 flex-1">
          <input
            type="text"
            disabled={disabled}
            value={query}
            onFocus={() =>
              setOpen(true)
            }
            onChange={event => {
              setQuery(
                event.target.value,
              );
              setOpen(true);
              setMessage(null);
            }}
            placeholder={
              selected
                ? "Stoku değiştir..."
                : "Stok kodu / adı / marka / barkod..."
            }
            className="h-9 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />

          {open && (
            <div className="absolute left-0 top-full z-40 mt-1 max-h-64 w-[min(420px,85vw)] overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-xl dark:border-gray-700 dark:bg-gray-900">
              {message && (
                <div className="m-1 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs font-medium text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                  {message}
                </div>
              )}

              {matches.map(
                product => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() =>
                      choose(product)
                    }
                    className="block w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <div className="font-bold text-gray-900 dark:text-white">
                      {product.stockCode}
                      {" — "}
                      {product.name}
                    </div>

                    <div className="mt-0.5 text-gray-500">
                      {[
                        product.brand,
                        product.barcode1,
                        product.barcode2,
                      ]
                        .filter(Boolean)
                        .join(" · ") ||
                        "Ek bilgi yok"}
                    </div>
                  </button>
                ),
              )}

              {matches.length === 0 &&
                !message && (
                  <div className="p-3 text-xs text-gray-500">
                    Eşleşen stok bulunamadı.
                  </div>
                )}

              <button
                type="button"
                onClick={() =>
                  setOpen(false)
                }
                className="mt-1 w-full rounded-lg border-t border-gray-100 px-3 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800"
              >
                Kapat
              </button>
            </div>
          )}
        </div>

        <BarcodeScannerButton
          disabled={disabled}
          onDetected={
            handleBarcode
          }
          title="Kamera ile barkod okut"
        />
      </div>
    </div>
  );
}