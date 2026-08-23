import * as XLSX from "xlsx";

export const STOCK_CARDS_SHEET_NAME = "STOK KARTLARI";
export const STOCK_BOTTOM_FINISH_SHEET_NAME = "ETEK MODELLERİ";

export const STOCK_CARD_TEMPLATE_HEADERS = [
  "Stok Kodu","Stok Adı","Tür","Grup / Kategori","Marka","Ürün Ailesi","Birim","Tedarikçi",
  "Barkod 1","Barkod 2","Alış Fiyatı 1","Alış Fiyatı 2","Alış Fiyatı 3","Alış Fiyatı 4",
  "Alış KDV %","Satış Fiyatı 1","Satış Fiyatı 2","Satış Fiyatı 3","Satış Fiyatı 4",
  "Satış KDV %","Dikim Gerekir","Montaj Gerekir","Ek Açıklama","Genel Açıklama",
] as const;

export const STOCK_BOTTOM_FINISH_TEMPLATE_HEADERS = [
  "Stok Kodu","Tür","Model Kodu","Model Adı","Hesaplama","Alış Fiyatı","Alış KDV %",
  "Satış Fiyatı","Satış KDV %",
] as const;

const headerSheet = (headers: readonly string[]) => XLSX.utils.aoa_to_sheet([[...headers]]);

export function buildStockExcelTemplateWorkbook() {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, headerSheet(STOCK_CARD_TEMPLATE_HEADERS), STOCK_CARDS_SHEET_NAME);
  XLSX.utils.book_append_sheet(workbook, headerSheet(STOCK_BOTTOM_FINISH_TEMPLATE_HEADERS), STOCK_BOTTOM_FINISH_SHEET_NAME);
  return workbook;
}

export function downloadStockExcelTemplate(fileName = "ENVerp_Stok_Sablonu") {
  XLSX.writeFile(buildStockExcelTemplateWorkbook(), `${fileName}.xlsx`);
}