import React, {
  useState
} from "react";
import {
  Plus,
  Trash2
} from "lucide-react";
import {
  parsePlicellPieceInput
} from "@/lib/plicellPieceInput";

export interface PlicellCamItem {
  id:
    string;

  order:
    number;

  widthCm:
    string;

  heightCm:
    number;

  note:
    string;
}

export interface PlicellCamListEditorProps {
  camAdedi?:
    number;

  ortakCamBoyuCm?:
    number;

  profilRengi?:
    string;

  plicellCamListesi?:
    PlicellCamItem[];

  onChange: (
    data: {
      camAdedi:
        number;

      ortakCamBoyuCm:
        number;

      profilRengi:
        string;

      plicellCamListesi:
        PlicellCamItem[];
    }
  ) => void;
}

type EntryMode =
  | "COMMON_HEIGHT"
  | "PIECE_BASED";

function createRowId():
  string {
  if (
    typeof crypto !==
      "undefined" &&
    typeof crypto.randomUUID ===
      "function"
  ) {
    return crypto.randomUUID();
  }

  return [
    "plicell",
    Date.now(),
    Math.random()
      .toString(36)
      .slice(2, 10)
  ].join("-");
}

function normalizeNumberInput(
  value:
    string
): string {
  const normalized =
    value
      .replace(",", ".")
      .replace(
        /[^0-9.]/g,
        ""
      );

  const firstDot =
    normalized.indexOf(".");

  if (
    firstDot < 0
  ) {
    return normalized;
  }

  return (
    normalized.slice(
      0,
      firstDot + 1
    ) +
    normalized
      .slice(
        firstDot + 1
      )
      .replace(/\./g, "")
  );
}

function parsePositiveNumber(
  value:
    string
): number {
  const parsed =
    Number(
      normalizeNumberInput(
        value
      )
    );

  return (
    Number.isFinite(parsed) &&
    parsed > 0
      ? parsed
      : 0
  );
}

function formatInputNumber(
  value:
    number
): string {
  return String(value);
}

export function PlicellCamListEditor({
  camAdedi = 0,
  ortakCamBoyuCm = 0,
  profilRengi = "",
  plicellCamListesi,
  onChange
}: PlicellCamListEditorProps) {
  const initialRows =
    plicellCamListesi || [];

  const hasDifferentHeights =
    initialRows.some(
      row =>
        row.heightCm > 0 &&
        ortakCamBoyuCm > 0 &&
        row.heightCm !==
          ortakCamBoyuCm
    );

  const [
    entryMode,
    setEntryMode
  ] = useState<EntryMode>(
    hasDifferentHeights
      ? "PIECE_BASED"
      : "COMMON_HEIGHT"
  );

  const [
    localAdet,
    setLocalAdet
  ] = useState<string>(
    camAdedi
      ? String(camAdedi)
      : ""
  );

  const [
    localBoy,
    setLocalBoy
  ] = useState<string>(
    ortakCamBoyuCm
      ? String(
          ortakCamBoyuCm
        )
      : ""
  );

  const [
    localRenk,
    setLocalRenk
  ] = useState<string>(
    profilRengi || ""
  );

  const [
    fastInput,
    setFastInput
  ] = useState("");

  const [
    fastInputMessage,
    setFastInputMessage
  ] = useState<
    string | null
  >(null);

  const [
    rows,
    setRows
  ] = useState<
    PlicellCamItem[]
  >(
    () =>
      initialRows
  );

  function emitChange(
    nextRows:
      PlicellCamItem[],
    nextCommonHeight?:
      number
  ): void {
    const commonHeight =
      nextCommonHeight ??
      (
        entryMode ===
        "COMMON_HEIGHT"
          ? parsePositiveNumber(
              localBoy
            )
          : 0
      );

    onChange({
      camAdedi:
        nextRows.length,

      ortakCamBoyuCm:
        commonHeight,

      profilRengi:
        localRenk,

      plicellCamListesi:
        nextRows
    });
  }

  function handleModeChange(
    mode:
      EntryMode
  ): void {
    setEntryMode(mode);
    setFastInputMessage(null);

    if (
      mode ===
      "COMMON_HEIGHT"
    ) {
      const commonHeight =
        parsePositiveNumber(
          localBoy
        );

      const nextRows =
        commonHeight > 0
          ? rows.map(
              row => ({
                ...row,
                heightCm:
                  commonHeight
              })
            )
          : rows;

      setRows(nextRows);
      emitChange(
        nextRows,
        commonHeight
      );

      return;
    }

    onChange({
      camAdedi:
        rows.length,

      ortakCamBoyuCm:
        0,

      profilRengi:
        localRenk,

      plicellCamListesi:
        rows
    });
  }

  function handleGenerateCommon():
    void {
    const adet =
      Number.parseInt(
        localAdet,
        10
      );

    const boy =
      parsePositiveNumber(
        localBoy
      );

    if (
      !Number.isInteger(adet) ||
      adet <= 0
    ) {
      window.alert(
        "Lütfen geçerli bir cam adedi giriniz."
      );

      return;
    }

    if (
      boy <= 0
    ) {
      window.alert(
        "Lütfen geçerli bir ortak cam boyu giriniz."
      );

      return;
    }

    const nextRows:
      PlicellCamItem[] = [];

    for (
      let index = 0;
      index < adet;
      index++
    ) {
      const existing =
        rows[index];

      nextRows.push(
        existing
          ? {
              ...existing,
              order:
                index + 1,
              heightCm:
                boy
            }
          : {
              id:
                createRowId(),
              order:
                index + 1,
              widthCm:
                "",
              heightCm:
                boy,
              note:
                ""
            }
      );
    }

    setRows(nextRows);
    setFastInputMessage(null);
    emitChange(
      nextRows,
      boy
    );
  }

  function handleGeneratePieces():
    void {
    const result =
      parsePlicellPieceInput(
        fastInput
      );

    if (
      result.pieces.length ===
      0
    ) {
      setFastInputMessage(
        result.errors.join(
          " | "
        )
      );

      return;
    }

    const nextRows =
      result.pieces.map(
        (
          piece,
          index
        ): PlicellCamItem => ({
          id:
            rows[index]?.id ||
            createRowId(),

          order:
            index + 1,

          widthCm:
            formatInputNumber(
              piece.widthCm
            ),

          heightCm:
            piece.heightCm,

          note:
            rows[index]?.note ||
            ""
        })
      );

    setRows(nextRows);
    setLocalAdet(
      String(
        nextRows.length
      )
    );

    setFastInputMessage(
      result.errors.length > 0
        ? [
            `${nextRows.length} cam tabloya aktarıldı.`,
            result.errors.join(
              " | "
            )
          ].join(" ")
        : `${nextRows.length} cam tabloya aktarıldı.`
    );

    onChange({
      camAdedi:
        nextRows.length,

      ortakCamBoyuCm:
        0,

      profilRengi:
        localRenk,

      plicellCamListesi:
        nextRows
    });
  }

  function handleRenkChange(
    value:
      string
  ): void {
    setLocalRenk(value);

    onChange({
      camAdedi:
        rows.length,

      ortakCamBoyuCm:
        entryMode ===
        "COMMON_HEIGHT"
          ? parsePositiveNumber(
              localBoy
            )
          : 0,

      profilRengi:
        value,

      plicellCamListesi:
        rows
    });
  }

  function handleRowChange(
    index:
      number,
    field:
      | "widthCm"
      | "heightCm"
      | "note",
    value:
      string
  ): void {
    const nextRows =
      [...rows];

    if (
      field ===
      "widthCm"
    ) {
      nextRows[index] = {
        ...nextRows[index],
        widthCm:
          normalizeNumberInput(
            value
          )
      };
    }
    else if (
      field ===
      "heightCm"
    ) {
      nextRows[index] = {
        ...nextRows[index],
        heightCm:
          parsePositiveNumber(
            value
          )
      };
    }
    else {
      nextRows[index] = {
        ...nextRows[index],
        note:
          value
      };
    }

    setRows(nextRows);
    emitChange(nextRows);
  }

  function handleAddMore(
    count:
      number
  ): void {
    const commonHeight =
      entryMode ===
      "COMMON_HEIGHT"
        ? parsePositiveNumber(
            localBoy
          )
        : 0;

    const nextRows =
      [...rows];

    for (
      let index = 0;
      index < count;
      index++
    ) {
      nextRows.push({
        id:
          createRowId(),

        order:
          nextRows.length + 1,

        widthCm:
          "",

        heightCm:
          commonHeight,

        note:
          ""
      });
    }

    setRows(nextRows);
    setLocalAdet(
      String(
        nextRows.length
      )
    );
    emitChange(nextRows);
  }

  function handleRemoveRow(
    index:
      number
  ): void {
    const nextRows =
      rows
        .filter(
          (
            _row,
            rowIndex
          ) =>
            rowIndex !==
            index
        )
        .map(
          (
            row,
            rowIndex
          ) => ({
            ...row,
            order:
              rowIndex + 1
          })
        );

    setRows(nextRows);
    setLocalAdet(
      String(
        nextRows.length
      )
    );
    emitChange(nextRows);
  }

  return (
    <div
      data-plicell-cam-list-editor
      className="space-y-4"
    >
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-900/30 dark:bg-blue-950/20">
        <h3 className="mb-3 text-sm font-bold text-blue-800 dark:text-blue-300">
          Plicell Çoklu Cam Ölçüsü
        </h3>

        <div
          data-plicell-entry-mode
          className="mb-4 grid grid-cols-2 gap-2"
        >
          <button
            type="button"
            onClick={() =>
              handleModeChange(
                "COMMON_HEIGHT"
              )
            }
            className={
              entryMode ===
              "COMMON_HEIGHT"
                ? "rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white"
                : "rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-bold text-blue-700 dark:border-blue-800 dark:bg-gray-900 dark:text-blue-300"
            }
          >
            Ortak Boy
          </button>

          <button
            type="button"
            onClick={() =>
              handleModeChange(
                "PIECE_BASED"
              )
            }
            className={
              entryMode ===
              "PIECE_BASED"
                ? "rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white"
                : "rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-bold text-blue-700 dark:border-blue-800 dark:bg-gray-900 dark:text-blue-300"
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
            value={
              localRenk
            }
            onChange={
              event =>
                handleRenkChange(
                  event.target.value
                )
            }
            className="w-full rounded-lg border border-blue-200 bg-white p-2 text-gray-900 dark:border-blue-800/50 dark:bg-gray-900 dark:text-white"
          >
            <option value="">
              Seçiniz...
            </option>
            <option value="BEYAZ">
              BEYAZ
            </option>
            <option value="KREM">
              KREM
            </option>
            <option value="GRİ">
              GRİ
            </option>
            <option value="ANTRASİT">
              ANTRASİT
            </option>
            <option value="BAKIR">
              BAKIR
            </option>
            <option value="KAHVE">
              KAHVE
            </option>
            <option value="SİYAH">
              SİYAH
            </option>
          </select>
        </div>

        {entryMode ===
        "COMMON_HEIGHT" ? (
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-bold text-gray-700 dark:text-gray-300">
                Kaç Cam Var?
              </label>

              <input
                type="number"
                min="1"
                value={
                  localAdet
                }
                onChange={
                  event =>
                    setLocalAdet(
                      event.target.value
                    )
                }
                className="w-full rounded-lg border border-blue-200 bg-white p-2 text-gray-900 dark:border-blue-800/50 dark:bg-gray-900 dark:text-white"
                placeholder="Örn: 10"
              />
            </div>

            <div className="flex-1">
              <label className="mb-1 block text-xs font-bold text-gray-700 dark:text-gray-300">
                Ortak Cam Boyu (cm)
              </label>

              <input
                type="text"
                inputMode="decimal"
                value={
                  localBoy
                }
                onChange={
                  event =>
                    setLocalBoy(
                      event.target.value
                    )
                }
                className="w-full rounded-lg border border-blue-200 bg-white p-2 text-gray-900 dark:border-blue-800/50 dark:bg-gray-900 dark:text-white"
                placeholder="Örn: 176"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={
                  handleGenerateCommon
                }
                className="h-10 cursor-pointer rounded-lg bg-blue-600 px-6 font-bold text-white transition-colors hover:bg-blue-700"
              >
                Üret
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
              Her satıra En x Boy yazın. Aynı ölçüden birden fazla varsa 5*56,60x175 biçimini kullanın.
            </p>

            <textarea
              value={
                fastInput
              }
              onChange={
                event =>
                  setFastInput(
                    event.target.value
                  )
              }
              onKeyDown={
                event => {
                  if (
                    event.key ===
                      "Enter" &&
                    (
                      event.ctrlKey ||
                      event.metaKey
                    )
                  ) {
                    event.preventDefault();
                    handleGeneratePieces();
                  }
                }
              }
              rows={5}
              placeholder={"4*174,5x221\n61,7x177\n74,8x20"}
              className="w-full resize-y rounded-lg border border-blue-200 bg-white p-3 font-mono text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-blue-800 dark:bg-gray-950 dark:text-white"
            />

            <button
              type="button"
              onClick={
                handleGeneratePieces
              }
              className="mt-2 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 sm:w-auto"
            >
              Ölçüleri Tabloya Aktar
            </button>

            {fastInputMessage ? (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs font-medium text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                {fastInputMessage}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {rows.length >
      0 ? (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200">
              Cam Ölçüleri
            </h4>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  handleAddMore(1)
                }
                className="flex cursor-pointer items-center gap-1 rounded-md bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <Plus className="h-3 w-3" />
                1 Ekle
              </button>

              <button
                type="button"
                onClick={() =>
                  handleAddMore(5)
                }
                className="flex cursor-pointer items-center gap-1 rounded-md bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <Plus className="h-3 w-3" />
                5 Ekle
              </button>
            </div>
          </div>

          <div className="max-h-[500px] space-y-2 overflow-y-auto pr-2">
            {rows.map(
              (
                row,
                index
              ) => (
                <div
                  key={
                    row.id
                  }
                  data-plicell-piece-row
                  className="flex flex-col items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 p-2 dark:border-gray-800 dark:bg-gray-800/50 sm:flex-row"
                >
                  <div className="w-full text-center font-bold text-gray-500 dark:text-gray-400 sm:w-16">
                    {row.order}. Cam
                  </div>

                  <label className="relative w-full flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                      En:
                    </span>

                    <input
                      type="text"
                      inputMode="decimal"
                      value={
                        row.widthCm
                      }
                      onChange={
                        event =>
                          handleRowChange(
                            index,
                            "widthCm",
                            event.target.value
                          )
                      }
                      className="w-full rounded border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
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
                      value={
                        row.heightCm ||
                        ""
                      }
                      onChange={
                        event =>
                          handleRowChange(
                            index,
                            "heightCm",
                            event.target.value
                          )
                      }
                      disabled={
                        entryMode ===
                        "COMMON_HEIGHT"
                      }
                      className={
                        entryMode ===
                        "COMMON_HEIGHT"
                          ? "w-full cursor-not-allowed rounded border border-gray-200 bg-gray-100 py-2 pl-10 pr-3 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800"
                          : "w-full rounded border border-gray-200 bg-white py-2 pl-10 pr-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                      }
                      placeholder="Örn: 175"
                    />
                  </label>

                  <input
                    type="text"
                    value={
                      row.note
                    }
                    onChange={
                      event =>
                        handleRowChange(
                          index,
                          "note",
                          event.target.value
                        )
                    }
                    className="w-full flex-1 rounded border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    placeholder="Not (Opsiyonel)"
                  />

                  <button
                    type="button"
                    aria-label={`${row.order}. camı sil`}
                    onClick={() =>
                      handleRemoveRow(
                        index
                      )
                    }
                    className="cursor-pointer rounded p-2 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}