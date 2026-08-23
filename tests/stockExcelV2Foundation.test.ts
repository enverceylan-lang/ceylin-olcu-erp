import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { parseExcelYesNo, stockExcelProfile, type StockExcelRow } from "../src/lib/excelBridge/profiles/stockExcelProfile";
import {
  buildStockExcelTemplateWorkbook,
  STOCK_BOTTOM_FINISH_SHEET_NAME,
  STOCK_BOTTOM_FINISH_TEMPLATE_HEADERS,
  STOCK_CARDS_SHEET_NAME,
  STOCK_CARD_TEMPLATE_HEADERS,
} from "../src/lib/excelBridge/stockExcelTemplate";

assert.equal(parseExcelYesNo("Evet"), true);
assert.equal(parseExcelYesNo("Hayır"), false);
assert.equal(parseExcelYesNo("0"), false);
assert.equal(parseExcelYesNo("1"), true);
assert.throws(() => parseExcelYesNo("belki"));

const existing: StockExcelRow[] = [{ id: "p1", stockCode: "S0001", name: "Örnek", productKind: "Fiziksel Ürün" }];
assert.equal(stockExcelProfile.findMatch({ stockCode: "s0001", name: "Yeni", productKind: "Fiziksel Ürün" }, existing).status, "MANUAL_REVIEW");
assert.equal(stockExcelProfile.findMatch({ stockCode: "S0002", name: "Yeni", productKind: "Hizmet" }, existing).status, "NEW");

const workbook = buildStockExcelTemplateWorkbook();
assert.deepEqual(workbook.SheetNames, [STOCK_CARDS_SHEET_NAME, STOCK_BOTTOM_FINISH_SHEET_NAME]);
const stockRows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[STOCK_CARDS_SHEET_NAME], { header: 1 });
const finishRows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[STOCK_BOTTOM_FINISH_SHEET_NAME], { header: 1 });
assert.deepEqual(stockRows[0], [...STOCK_CARD_TEMPLATE_HEADERS]);
assert.deepEqual(finishRows[0], [...STOCK_BOTTOM_FINISH_TEMPLATE_HEADERS]);

console.log("PAK_STOCK_EXCEL_V2_FOUNDATION");