"use client";

import {
  useRef,
  useState,
} from "react";
import type {
  StockExcelExistingProduct,
  StockExcelSupplier,
  StockExcelValidatedPlan,
} from "@/lib/excelBridge/stockExcelV2Bridge";
import {
  validateStockExcelFile,
} from "@/lib/excelBridge/stockExcelV2Bridge";

export function StockExcelFinalModal({
  isOpen,
  onClose,
  existingProducts,
  suppliers,
  onCommit,
}: {
  isOpen: boolean;
  onClose(): void;
  existingProducts:
    readonly StockExcelExistingProduct[];
  suppliers:
    readonly StockExcelSupplier[];
  onCommit(
    plan: StockExcelValidatedPlan,
  ): Promise<void>;
}) {
  const inputRef =
    useRef<HTMLInputElement>(null);
  const [file, setFile] =
    useState<File | null>(null);
  const [plan, setPlan] =
    useState<StockExcelValidatedPlan | null>(
      null,
    );
  const [busy, setBusy] =
    useState(false);
  const [message, setMessage] =
    useState<string | null>(null);

  if (!isOpen) {
    return null;
  }

  const reset = () => {
    setFile(null);
    setPlan(null);
    setMessage(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const chooseFile = async (
    selected: File,
  ) => {
    setBusy(true);
    setMessage(null);
    setFile(selected);

    try {
      const nextPlan =
        await validateStockExcelFile(
          selected,
          existingProducts,
          suppliers,
        );
      setPlan(nextPlan);
    } catch (error) {
      setPlan(null);
      setMessage(
        error instanceof Error
          ? error.message
          : String(error),
      );
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (
      !plan ||
      plan.errorCount > 0 ||
      plan.cards.length === 0
    ) {
      setMessage(
        "Dosya temiz değil. Toplu açma yapılmadı.",
      );
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await onCommit(plan);
      reset();
      onClose();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : String(error),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-bold">
              Stok Excel İçe Aktar
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Dosya kontrol edilir → önizlenir → yalnız temiz dosya toplu açılır.
            </p>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => {
              reset();
              onClose();
            }}
            className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
          >
            Kapat
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={event => {
              const selected =
                event.target.files?.[0];
              if (selected) {
                void chooseFile(selected);
              }
            }}
          />

          <button
            type="button"
            disabled={busy}
            onClick={() =>
              inputRef.current?.click()
            }
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy
              ? "Kontrol ediliyor..."
              : file
                ? "Başka Dosya Seç"
                : "Excel Dosyası Seç"}
          </button>

          {file && (
            <div className="text-sm text-gray-600 dark:text-gray-300">
              Dosya:{" "}
              <strong>{file.name}</strong>
            </div>
          )}

          {message && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">
              {message}
            </div>
          )}

          {plan && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border p-4">
                  <div className="text-2xl font-bold">
                    {plan.cards.length}
                  </div>
                  <div className="text-xs text-gray-500">
                    Açılacak kart
                  </div>
                </div>
                <div className="rounded-xl border p-4">
                  <div className="text-2xl font-bold">
                    {plan.finishes.length}
                  </div>
                  <div className="text-xs text-gray-500">
                    Etek seçeneği
                  </div>
                </div>
                <div className="rounded-xl border p-4">
                  <div className={`text-2xl font-bold ${
                    plan.errorCount > 0
                      ? "text-red-600"
                      : "text-emerald-600"
                  }`}>
                    {plan.errorCount}
                  </div>
                  <div className="text-xs text-gray-500">
                    Hatalı satır
                  </div>
                </div>
              </div>

              <div className="max-h-80 overflow-auto rounded-xl border">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-gray-50 dark:bg-gray-950">
                    <tr>
                      <th className="p-2">
                        Sayfa
                      </th>
                      <th className="p-2">
                        Satır
                      </th>
                      <th className="p-2">
                        Kayıt
                      </th>
                      <th className="p-2">
                        Durum
                      </th>
                      <th className="p-2">
                        Açıklama
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.rows.map(
                      (row, index) => (
                        <tr
                          key={`${row.sheet}-${row.rowNumber}-${index}`}
                          className="border-t"
                        >
                          <td className="p-2">
                            {row.sheet}
                          </td>
                          <td className="p-2">
                            {row.rowNumber}
                          </td>
                          <td className="p-2 font-medium">
                            {row.primary}
                          </td>
                          <td className="p-2">
                            {row.status ===
                            "OK" ? (
                              <span className="font-bold text-emerald-600">
                                PAK
                              </span>
                            ) : (
                              <span className="font-bold text-red-600">
                                DUR
                              </span>
                            )}
                          </td>
                          <td className="p-2">
                            {row.errors.length >
                            0
                              ? row.errors.join(
                                  " | ",
                                )
                              : "Temiz"}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 px-5 py-4 dark:border-gray-800">
          <div className="text-xs text-gray-500">
            Hata veya mükerrer varsa hiçbir kayıt açılmaz.
          </div>
          <button
            type="button"
            disabled={
              busy ||
              !plan ||
              plan.errorCount > 0 ||
              plan.cards.length === 0
            }
            onClick={() => void confirm()}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Temiz Dosyayı Toplu Aç
          </button>
        </div>
      </div>
    </div>
  );
}