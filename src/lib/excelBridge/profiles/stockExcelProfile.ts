import { ExcelProfile } from "../excelTypes";

export type StockExcelCardType = "Fiziksel Ürün" | "Hizmet";

export interface StockExcelRow {
  id?: string;
  stockCode?: string;
  name: string;
  productKind?: StockExcelCardType;
  category?: string;
  brand?: string;
  family?: string;
  unit?: string;
  supplierName?: string;
  barcode1?: string;
  barcode2?: string;
  purchasePrice1?: number;
  purchasePrice2?: number;
  purchasePrice3?: number;
  purchasePrice4?: number;
  purchaseVatRate?: number;
  salePrice1?: number;
  salePrice2?: number;
  salePrice3?: number;
  salePrice4?: number;
  saleVatRate?: number;
  requiresSewing?: boolean;
  requiresInstallation?: boolean;
  extraDescription?: string;
  description?: string;
}

const text = (value: unknown) => String(value ?? "").trim();
const stockCode = (value: unknown) => text(value).toLocaleUpperCase("tr-TR");

function optionalNumber(value: unknown): number | undefined {
  if (value === "" || value === null || value === undefined) return undefined;
  const normalized = typeof value === "string" ? value.trim().replace(/\s+/g, "").replace(",", ".") : value;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) throw new Error("Sayısal değer bekleniyor");
  return parsed;
}

function optionalVat(value: unknown): number | undefined {
  const parsed = optionalNumber(value);
  if (parsed === undefined) return undefined;
  if (parsed < 0 || parsed > 100) throw new Error("KDV oranı 0 ile 100 arasında olmalıdır");
  return parsed;
}

export function parseExcelYesNo(value: unknown): boolean | undefined {
  if (value === "" || value === null || value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLocaleLowerCase("tr-TR");
  if (["evet","e","true","1"].includes(normalized)) return true;
  if (["hayır","hayir","h","false","0"].includes(normalized)) return false;
  throw new Error("Evet/Hayır değeri bekleniyor");
}

function parseProductKind(value: unknown): StockExcelCardType {
  const normalized = text(value).toLocaleLowerCase("tr-TR");
  if (["fiziksel ürün","fiziksel urun","physical"].includes(normalized)) return "Fiziksel Ürün";
  if (["hizmet","service"].includes(normalized)) return "Hizmet";
  throw new Error("Tür yalnız Fiziksel Ürün veya Hizmet olabilir");
}

export const stockExcelProfile: ExcelProfile<StockExcelRow> = {
  moduleName: "Stoklar",
  knownColumns: [
    { dbField: "stockCode", aliases: ["Stok Kodu","Ürün Kodu"], type: "string", required: true, parser: stockCode },
    { dbField: "name", aliases: ["Stok Adı","Ürün Adı"], type: "string", required: true },
    { dbField: "productKind", aliases: ["Tür","Kart Türü"], type: "string", required: true, parser: parseProductKind },
    { dbField: "category", aliases: ["Grup / Kategori","Kategori","Grup"], type: "string" },
    { dbField: "brand", aliases: ["Marka"], type: "string" },
    { dbField: "family", aliases: ["Ürün Ailesi","Aile"], type: "string" },
    { dbField: "unit", aliases: ["Birim"], type: "string" },
    { dbField: "supplierName", aliases: ["Tedarikçi"], type: "string" },
    { dbField: "barcode1", aliases: ["Barkod 1","Barkod1"], type: "string" },
    { dbField: "barcode2", aliases: ["Barkod 2","Barkod2"], type: "string" },
    { dbField: "purchasePrice1", aliases: ["Alış Fiyatı 1"], type: "number", parser: optionalNumber },
    { dbField: "purchasePrice2", aliases: ["Alış Fiyatı 2"], type: "number", parser: optionalNumber },
    { dbField: "purchasePrice3", aliases: ["Alış Fiyatı 3"], type: "number", parser: optionalNumber },
    { dbField: "purchasePrice4", aliases: ["Alış Fiyatı 4"], type: "number", parser: optionalNumber },
    { dbField: "purchaseVatRate", aliases: ["Alış KDV %","Alış KDV"], type: "number", parser: optionalVat },
    { dbField: "salePrice1", aliases: ["Satış Fiyatı 1"], type: "number", parser: optionalNumber },
    { dbField: "salePrice2", aliases: ["Satış Fiyatı 2"], type: "number", parser: optionalNumber },
    { dbField: "salePrice3", aliases: ["Satış Fiyatı 3"], type: "number", parser: optionalNumber },
    { dbField: "salePrice4", aliases: ["Satış Fiyatı 4"], type: "number", parser: optionalNumber },
    { dbField: "saleVatRate", aliases: ["Satış KDV %","Satış KDV"], type: "number", parser: optionalVat },
    { dbField: "requiresSewing", aliases: ["Dikim Gerekir"], type: "boolean", parser: parseExcelYesNo },
    { dbField: "requiresInstallation", aliases: ["Montaj Gerekir"], type: "boolean", parser: parseExcelYesNo },
    { dbField: "extraDescription", aliases: ["Ek Açıklama"], type: "string" },
    { dbField: "description", aliases: ["Genel Açıklama","Açıklama"], type: "string" },
  ],
  findMatch: (row, existingData) => {
    const code = stockCode(row.stockCode);
    const duplicate = existingData.find(item => stockCode(item.stockCode) === code);
    if (duplicate) {
      return {
        status: "MANUAL_REVIEW",
        matchId: duplicate.id,
        message: "Bu stok kodu sistemde zaten var. Otomatik güncelleme yapılmaz.",
      };
    }
    return { status: "NEW" };
  },
};