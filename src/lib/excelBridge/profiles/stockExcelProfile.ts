import { ExcelProfile } from "../excelTypes";

// This is a placeholder for future implementation
// The actual Stock interface will be used when Stok module is fully implemented

export interface DummyStock {
  id: string;
  stockCode?: string;
  name: string;
}

export const stockExcelProfile: ExcelProfile<DummyStock> = {
  moduleName: "Stoklar",
  
  knownColumns: [
    { dbField: "stockCode", aliases: ["Stok Kodu", "Ürün Kodu"], type: "string" },
    { dbField: "name", aliases: ["Stok Adı", "Ürün Adı"], type: "string", required: true },
  ],

  findMatch: (row, existingData) => {
    if (row.stockCode) {
      const match = existingData.find(s => s.stockCode === row.stockCode);
      if (match) {
        return { matchId: match.id, status: 'UPDATE' };
      }
    }
    return { status: 'NEW' };
  }
};
