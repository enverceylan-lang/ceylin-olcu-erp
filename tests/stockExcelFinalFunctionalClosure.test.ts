import assert from "node:assert/strict";
import * as XLSX from "xlsx";

import {
  STOCK_BOTTOM_FINISH_SHEET_NAME,
  STOCK_CARDS_SHEET_NAME,
  STOCK_BOTTOM_FINISH_TEMPLATE_HEADERS,
  STOCK_CARD_TEMPLATE_HEADERS,
} from "../src/lib/excelBridge/stockExcelTemplate";
import {
  validateStockExcelFile,
} from "../src/lib/excelBridge/stockExcelV2Bridge";

function workbookFile(
  cardRows: unknown[][],
  finishRows: unknown[][],
): File {
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      [...STOCK_CARD_TEMPLATE_HEADERS],
      ...cardRows,
    ]),
    STOCK_CARDS_SHEET_NAME,
  );

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      [...STOCK_BOTTOM_FINISH_TEMPLATE_HEADERS],
      ...finishRows,
    ]),
    STOCK_BOTTOM_FINISH_SHEET_NAME,
  );

  const bytes = XLSX.write(
    workbook,
    {
      type: "array",
      bookType: "xlsx",
    },
  );

  return new File(
    [bytes],
    "stok.xlsx",
    {
      type:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  );
}

async function main() {
const clean = await validateStockExcelFile(
  workbookFile(
    [[
      "ST-001",
      "Stor Örnek",
      "Fiziksel Ürün",
      "Mekanik",
      "",
      "Stor",
      "m²",
      "Tedarikçi A",
      "",
      "",
      100,
      "",
      "",
      "",
      "",
      200,
      "",
      "",
      "",
      "",
      "Hayır",
      "Evet",
      "",
      "",
    ]],
    [[
      "ST-001",
      "Etek Modeli",
      "ST 01",
      "Model 01",
      "EN üzerinden mt",
      50,
      "",
      80,
      "",
    ]],
  ),
  [],
  [
    {
      id: "sup-1",
      name: "Tedarikçi A",
    },
  ],
);

assert.equal(clean.errorCount, 0);
assert.equal(clean.cards.length, 1);
assert.equal(clean.finishes.length, 1);
assert.equal(
  clean.cards[0].unit,
  "m²",
);
assert.equal(
  clean.cards[0].supplierId,
  "sup-1",
);

const duplicate = await validateStockExcelFile(
  workbookFile(
    [[
      "ST-001",
      "Stor Örnek",
      "Fiziksel Ürün",
      "",
      "",
      "Stor",
      "m²",
      "Tedarikçi A",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "Hayır",
      "Hayır",
      "",
      "",
    ]],
    [],
  ),
  [
    {
      id: "existing",
      stockCode: "st-001",
    },
  ],
  [
    {
      id: "sup-1",
      name: "Tedarikçi A",
    },
  ],
);

assert.ok(duplicate.errorCount > 0);

const serviceWithFinish =
  await validateStockExcelFile(
    workbookFile(
      [[
        "SRV-001",
        "Montaj",
        "Hizmet",
        "",
        "",
        "",
        "Hizmet",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        100,
        "",
        "",
        "",
        "",
        "Hayır",
        "Hayır",
        "",
        "",
      ]],
      [[
        "SRV-001",
        "Etek Lazer",
        "LZ 01",
        "Yanlış",
        "Sabit",
        "",
        "",
        20,
        "",
      ]],
    ),
    [],
    [],
  );

assert.ok(
  serviceWithFinish.errorCount > 0,
);

const badBoolean =
  await validateStockExcelFile(
    workbookFile(
      [[
        "ST-002",
        "Stor 2",
        "Fiziksel Ürün",
        "",
        "",
        "Stor",
        "m²",
        "Tedarikçi A",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "Belki",
        "Hayır",
        "",
        "",
      ]],
      [],
    ),
    [],
    [
      {
        id: "sup-1",
        name: "Tedarikçi A",
      },
    ],
  );

assert.ok(badBoolean.errorCount > 0);

console.log(
  "PAK_STOCK_EXCEL_FINAL_FUNCTIONAL_CLOSURE",
);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});