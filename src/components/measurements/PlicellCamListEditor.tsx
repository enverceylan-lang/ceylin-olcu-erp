import React, { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { parsePlicellPieceInput } from "@/lib/plicellPieceInput";

type EntryMode =
  | "COMMON_HEIGHT"
  | "PIECE_BASED";

export interface PlicellCamItem {
  id: string;
  order: number;
  widthCm: string;
  heightCm: number;
  note: string;

  /**
   * Ölçünün hangi giriş grubundan üretildiğini korur.
   * Parça bazlı ve ortak boy kayıtları birbirini değiştiremez.
   */
  sourceMode?: EntryMode;
}

export interface PlicellCamListEditorProps {
  camAdedi?: number;
  ortakCamBoyuCm?: number;
  profilRengi?: string;
  plicellCamListesi?: PlicellCamItem[];
  onChange: (data: {
    camAdedi: number;
    ortakCamBoyuCm: number;
    profilRengi: string;
    plicellCamListesi: PlicellCamItem[];
  }) => void;
}

function createRowId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return [
    "plicell",
    Date.now(),
    Math.random().toString(36).slice(2, 10),
  ].join("-");
}

function normalizeNumberInput(value: string): string {
  const normalized = value
    .replace(",", ".")
    .replace(/[^0-9.]/g, "");

  const firstDot = normalized.indexOf(".");
  if (firstDot < 0) return normalized;

  return (
    normalized.slice(0, firstDot + 1) +
    normalized.slice(firstDot + 1).replace(/\./g, "")
  );
}

function parsePositiveNumber(value: string): number {
  const parsed = Number(normalizeNumberInput(value));

  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : 0;
}

function formatInputNumber(value: number): string {
  return String(value);
}

function renumberRows(
  rows: PlicellCamItem[],
): PlicellCamItem[] {
  return rows.map((row, index) => ({
    ...row,
    order: index + 1,
  }));
}

function inferSourceMode(
  row: PlicellCamItem,
  commonHeight: number,
): EntryMode {
  if (row.sourceMode) return row.sourceMode;

  if (
    commonHeight > 0 &&
    row.heightCm === commonHeight
  ) {
    return "COMMON_HEIGHT";
  }

  return "PIECE_BASED";
}

export function PlicellCamListEditor({
  camAdedi = 0,
  ortakCamBoyuCm = 0,
  profilRengi = "",
  plicellCamListesi,
  onChange,
}: PlicellCamListEditorProps) {
  void camAdedi;

  const initialRows = useMemo(
    () =>
      (plicellCamListesi || []).map((row) => ({
        ...row,
        sourceMode: inferSourceMode(
          row,
          ortakCamBoyuCm,
        ),
      })),
    [plicellCamListesi, ortakCamBoyuCm],
  );

  const initialPieceRows = initialRows.filter(
    (row) => row.sourceMode === "PIECE_BASED",
  );

  const initialCommonRows = initialRows.filter(
    (row) => row.sourceMode === "COMMON_HEIGHT",
  );

  const [entryMode, setEntryMode] =
    useState<EntryMode>(
      initialPieceRows.length > 0
        ? "PIECE_BASED"
        : "COMMON_HEIGHT",
    );

  const [pieceRows, setPieceRows] =
    useState<PlicellCamItem[]>(
      () => initialPieceRows,
    );

  const [commonRows, setCommonRows] =
    useState<PlicellCamItem[]>(
      () => initialCommonRows,
    );

  const [localAdet, setLocalAdet] =
    useState<string>("");

  const [localBoy, setLocalBoy] =
    useState<string>(
      ortakCamBoyuCm
        ? String(ortakCamBoyuCm)
        : "",
    );

  const [localRenk, setLocalRenk] =
    useState<string>(profilRengi || "");

  const [fastInput, setFastInput] =
    useState("");

  const [
    fastInputMessage,
    setFastInputMessage,
  ] = useState<string | null>(null);

  const activeRows =
    entryMode === "PIECE_BASED"
      ? pieceRows
      : commonRows;

  function emitCombined(
    nextPieceRows: PlicellCamItem[],
    nextCommonRows: PlicellCamItem[],
    nextCommonHeight = parsePositiveNumber(
      localBoy,
    ),
    nextColor = localRenk,
  ): void {
    const normalizedPieceRows = nextPieceRows.map(
      (row) => ({
        ...row,
        sourceMode: "PIECE_BASED" as const,
      }),
    );

    const normalizedCommonRows =
      nextCommonRows.map((row) => ({
        ...row,
        sourceMode: "COMMON_HEIGHT" as const,
      }));

    const combined = renumberRows([
      ...normalizedPieceRows,
      ...normalizedCommonRows,
    ]);

    onChange({
      camAdedi: combined.length,
      ortakCamBoyuCm:
        normalizedCommonRows.length > 0
          ? nextCommonHeight
          : 0,
      profilRengi: nextColor,
      plicellCamListesi: combined,
    });
  }

  function handleModeChange(
    mode: EntryMode,
  ): void {
    setEntryMode(mode);
    setFastInputMessage(null);

    if (mode === "COMMON_HEIGHT") {
      setLocalAdet(
        commonRows.length > 0
          ? String(commonRows.length)
          : "",
      );
    }

    /*
     * Mod değiştirmek mevcut ölçüleri değiştirmez.
     * Parça bazlı ve ortak boy grupları ayrı kalır.
     */
  }

  function handleGenerateCommon(): void {
    const adet = Number.parseInt(
      localAdet,
      10,
    );
    const boy = parsePositiveNumber(
      localBoy,
    );

    if (
      !Number.isInteger(adet) ||
      adet <= 0
    ) {
      window.alert(
        "Lütfen geçerli bir ortak boy cam adedi giriniz.",
      );
      return;
    }

    if (boy <= 0) {
      window.alert(
        "Lütfen geçerli bir ortak cam boyu giriniz.",
      );
      return;
    }

    const nextCommonRows:
      PlicellCamItem[] = [];

    for (
      let index = 0;
      index < adet;
      index++
    ) {
      const existing =
        commonRows[index];

      nextCommonRows.push(
        existing
          ? {
              ...existing,
              heightCm: boy,
              sourceMode:
                "COMMON_HEIGHT",
            }
          : {
              id: createRowId(),
              order: index + 1,
              widthCm: "",
              heightCm: boy,
              note: "",
              sourceMode:
                "COMMON_HEIGHT",
            },
      );
    }

    setCommonRows(nextCommonRows);
    setFastInputMessage(null);

    /*
     * Yalnız ortak boy grubu yeniden üretilir.
     * Parça bazlı ölçüler aynen korunur.
     */
    emitCombined(
      pieceRows,
      nextCommonRows,
      boy,
    );
  }

  function handleGeneratePieces(): void {
    const result =
      parsePlicellPieceInput(fastInput);

    if (result.pieces.length === 0) {
      setFastInputMessage(
        result.errors.join(" | "),
      );
      return;
    }

    const nextPieceRows =
      result.pieces.map(
        (
          piece,
          index,
        ): PlicellCamItem => ({
          id:
            pieceRows[index]?.id ||
            createRowId(),
          order: index + 1,
          widthCm:
            formatInputNumber(
              piece.widthCm,
            ),
          heightCm:
            piece.heightCm,
          note:
            pieceRows[index]?.note ||
            "",
          sourceMode: "PIECE_BASED",
        }),
      );

    setPieceRows(nextPieceRows);

    setFastInputMessage(
      result.errors.length > 0
        ? [
            `${nextPieceRows.length} parça bazlı cam aktarıldı.`,
            result.errors.join(" | "),
          ].join(" ")
        : `${nextPieceRows.length} parça bazlı cam aktarıldı.`,
    );

    /*
     * Yalnız parça bazlı grup yenilenir.
     * Ortak boy camları aynen korunur.
     */
    emitCombined(
      nextPieceRows,
      commonRows,
    );
  }

  function handleRenkChange(
    value: string,
  ): void {
    setLocalRenk(value);
    emitCombined(
      pieceRows,
      commonRows,
      parsePositiveNumber(localBoy),
      value,
    );
  }

  function updateActiveRows(
    nextRows: PlicellCamItem[],
  ): void {
    if (entryMode === "PIECE_BASED") {
      setPieceRows(nextRows);
      emitCombined(
        nextRows,
        commonRows,
      );
      return;
    }

    setCommonRows(nextRows);
    emitCombined(
      pieceRows,
      nextRows,
    );
  }

  function handleRowChange(
    index: number,
    field:
      | "widthCm"
      | "heightCm"
      | "note",
    value: string,
  ): void {
    const nextRows = [...activeRows];

    if (field === "widthCm") {
      nextRows[index] = {
        ...nextRows[index],
        widthCm:
          normalizeNumberInput(value),
      };
    } else if (field === "heightCm") {
      nextRows[index] = {
        ...nextRows[index],
        heightCm:
          parsePositiveNumber(value),
      };
    } else {
      nextRows[index] = {
        ...nextRows[index],
        note: value,
      };
    }

    updateActiveRows(nextRows);
  }

  function handleAddMore(
    count: number,
  ): void {
    const commonHeight =
      entryMode === "COMMON_HEIGHT"
        ? parsePositiveNumber(localBoy)
        : 0;

    if (
      entryMode === "COMMON_HEIGHT" &&
      commonHeight <= 0
    ) {
      window.alert(
        "Önce ortak cam boyunu giriniz.",
      );
      return;
    }

    const nextRows = [...activeRows];

    for (
      let index = 0;
      index < count;
      index++
    ) {
      nextRows.push({
        id: createRowId(),
        order: nextRows.length + 1,
        widthCm: "",
        heightCm: commonHeight,
        note: "",
        sourceMode: entryMode,
      });
    }

    if (entryMode === "COMMON_HEIGHT") {
      setLocalAdet(String(nextRows.length));
    }

    updateActiveRows(nextRows);
  }

  function handleRemoveRow(
    index: number,
  ): void {
    const nextRows = renumberRows(
      activeRows.filter(
        (_row, rowIndex) =>
          rowIndex !== index,
      ),
    );

    if (entryMode === "COMMON_HEIGHT") {
      setLocalAdet(String(nextRows.length));
    }

    updateActiveRows(nextRows);
  }

  const totalCount =
    pieceRows.length + commonRows.length;

  return (
    <div
      data-plicell-cam-list-editor
      className="space-y-3 sm:space-y-4"
    >
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 sm:p-4 dark:border-blue-900/30 dark:bg-blue-950/20">
        <h3 className="mb-3 text-sm font-bold text-blue-800 dark:text-blue-300">
          Plicell Çoklu Cam Ölçüsü
        </h3>

        <div className="mb-3 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-800 dark:border-blue-800 dark:bg-gray-900 dark:text-blue-300">
          Parça bazlı: {pieceRows.length} cam •
          Ortak boy: {commonRows.length} cam •
          Toplam: {totalCount} cam
        </div>

        <div
          data-plicell-entry-mode
          className="mb-4 grid grid-cols-2 gap-2"
        >
          <button
            type="button"
            onClick={() =>
              handleModeChange(
                "COMMON_HEIGHT",
              )
            }
            className={
              entryMode ===
              "COMMON_HEIGHT"
                ? "min-h-11 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-bold text-white"
                : "min-h-11 rounded-lg border border-blue-200 bg-white px-3 py-2.5 text-sm font-bold text-blue-700 dark:border-blue-800 dark:bg-gray-900 dark:text-blue-300"
            }
          >
            Ortak Boy
          </button>

          <button
            type="button"
            onClick={() =>
              handleModeChange(
                "PIECE_BASED",
              )
            }
            className={
              entryMode ===
              "PIECE_BASED"
                ? "min-h-11 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-bold text-white"
                : "min-h-11 rounded-lg border border-blue-200 bg-white px-3 py-2.5 text-sm font-bold text-blue-700 dark:border-blue-800 dark:bg-gray-900 dark:text-blue-300"
            }
          >
            Parça Bazlı
          </button>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs font-bold text-gray-700 dark:text-gray-300">
            Profil Rengi
          </label>

          <select
            value={localRenk}
            onChange={(event) =>
              handleRenkChange(
                event.target.value,
              )
            }
            className="w-full rounded-lg border border-blue-200 bg-white p-2 text-gray-900 dark:border-blue-800/50 dark:bg-gray-900 dark:text-white"
          >
            <option value="">Seçiniz...</option>
            <option value="BEYAZ">BEYAZ</option>
            <option value="KREM">KREM</option>
            <option value="GRİ">GRİ</option>
            <option value="ANTRASİT">ANTRASİT</option>
            <option value="BAKIR">BAKIR</option>
            <option value="KAHVE">KAHVE</option>
            <option value="SİYAH">SİYAH</option>
          </select>
        </div>

        {entryMode ===
        "COMMON_HEIGHT" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-bold text-gray-700 dark:text-gray-300">
                Bu Ortak Boy Grubunda Kaç Cam Var?
              </label>
              <input
                type="number"
                min="1"
                value={localAdet}
                onChange={(event) =>
                  setLocalAdet(
                    event.target.value,
                  )
                }
                className="w-full rounded-lg border border-blue-200 bg-white p-2 text-gray-900 dark:border-blue-800/50 dark:bg-gray-900 dark:text-white"
                placeholder="Örn: 5"
              />
            </div>

            <div className="flex-1">
              <label className="mb-1 block text-xs font-bold text-gray-700 dark:text-gray-300">
                Ortak Cam Boyu (cm)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={localBoy}
                onChange={(event) =>
                  setLocalBoy(
                    event.target.value,
                  )
                }
                className="w-full rounded-lg border border-blue-200 bg-white p-2 text-gray-900 dark:border-blue-800/50 dark:bg-gray-900 dark:text-white"
                placeholder="Örn: 176"
              />
            </div>

            <div className="flex items-end sm:col-span-2 lg:col-span-1">
              <button
                type="button"
                onClick={handleGenerateCommon}
                className="min-h-11 w-full cursor-pointer rounded-lg bg-blue-600 px-5 py-2.5 font-bold text-white transition-colors hover:bg-blue-700 lg:w-auto"
              >
                Ortak Boy Grubunu Üret
              </button>
            </div>
          </div>
        ) : (
          <div
            data-plicell-piece-input
            className="rounded-lg border border-blue-100 bg-white p-3 dark:border-blue-900/40 dark:bg-gray-900"
          >
            <label className="mb-1 block text-xs font-bold text-blue-800 dark:text-blue-300">
              Parça Bazlı Hızlı Giriş
            </label>
            <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
              Her satıra En x Boy yazın. Bu bölüm ortak boy grubunu değiştirmez.
            </p>

            <textarea
              value={fastInput}
              onChange={(event) =>
                setFastInput(
                  event.target.value,
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  (
                    event.ctrlKey ||
                    event.metaKey
                  )
                ) {
                  event.preventDefault();
                  handleGeneratePieces();
                }
              }}
              rows={5}
              placeholder="Her satıra bir cam ölçüsü girin"
              className="min-h-32 w-full resize-y rounded-lg border border-blue-200 bg-white p-3 font-mono text-base text-gray-900 outline-none focus:border-blue-500 dark:border-blue-800 dark:bg-gray-950 dark:text-white"
            />

            <button
              type="button"
              onClick={handleGeneratePieces}
              className="mt-2 min-h-11 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 sm:w-auto"
            >
              Parça Bazlı Ölçüleri Aktar
            </button>

            {fastInputMessage ? (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs font-medium text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                {fastInputMessage}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {activeRows.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-3 sm:p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200">
              {entryMode === "PIECE_BASED"
                ? "Parça Bazlı Camlar"
                : "Ortak Boy Camları"}
            </h4>

            <div className="grid w-full grid-cols-2 gap-2 sm:w-auto">
              <button
                type="button"
                onClick={() =>
                  handleAddMore(1)
                }
                className="min-h-10 flex cursor-pointer items-center justify-center gap-1 rounded-md bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <Plus className="h-3 w-3" />
                1 Ekle
              </button>
              <button
                type="button"
                onClick={() =>
                  handleAddMore(5)
                }
                className="min-h-10 flex cursor-pointer items-center justify-center gap-1 rounded-md bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <Plus className="h-3 w-3" />
                5 Ekle
              </button>
            </div>
          </div>

          <div className="max-h-[500px] space-y-2 overflow-y-auto pr-2">
            {activeRows.map(
              (row, index) => (
                <div
                  key={row.id}
                  data-plicell-piece-row
                  className="flex flex-col items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 p-2 dark:border-gray-800 dark:bg-gray-800/50 sm:flex-row"
                >
                  <div className="w-full text-center font-bold text-gray-500 dark:text-gray-400 sm:w-20">
                    {index + 1}. Cam
                  </div>

                  <label className="relative w-full flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                      En:
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={row.widthCm}
                      onChange={(event) =>
                        handleRowChange(
                          index,
                          "widthCm",
                          event.target.value,
                        )
                      }
                      className="min-h-11 w-full rounded border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-base text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                      placeholder="Örn: 56,70"
                    />
                  </label>

                  <label className="relative w-full flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                      Boy:
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={row.heightCm || ""}
                      onChange={(event) =>
                        handleRowChange(
                          index,
                          "heightCm",
                          event.target.value,
                        )
                      }
                      disabled={
                        entryMode ===
                        "COMMON_HEIGHT"
                      }
                      className={
                        entryMode ===
                        "COMMON_HEIGHT"
                          ? "min-h-11 w-full cursor-not-allowed rounded border border-gray-200 bg-gray-100 py-2.5 pl-10 pr-3 text-base text-gray-500 dark:border-gray-700 dark:bg-gray-800"
                          : "min-h-11 w-full rounded border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-base text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                      }
                      placeholder="Örn: 175"
                    />
                  </label>

                  <input
                    type="text"
                    value={row.note}
                    onChange={(event) =>
                      handleRowChange(
                        index,
                        "note",
                        event.target.value,
                      )
                    }
                    className="min-h-11 w-full flex-1 rounded border border-gray-200 bg-white px-3 py-2.5 text-base text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    placeholder="Not (Opsiyonel)"
                  />

                  <button
                    type="button"
                    aria-label={`${index + 1}. camı sil`}
                    onClick={() =>
                      handleRemoveRow(index)
                    }
                    className="min-h-11 min-w-11 cursor-pointer rounded p-2 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ),
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}