import * as XLSX from "xlsx";
import { ExcelProfile } from "./excelTypes";

export interface ExportTemplate {
  name: string;
  columns: {
    header: string;
    dbField: string;
    formatter?: (value: unknown, row: unknown) => unknown;
  }[];
}

export const exportToExcel = <T>(
  data: T[], 
  profile: ExcelProfile<T>, 
  template: ExportTemplate, 
  fileName: string
) => {
  if (!data || data.length === 0) {
    throw new Error("Dışa aktarılacak veri bulunamadı.");
  }

  // Create rows based on template
  const rows = data.map(item => {
    const row: Record<string, unknown> = {};
    const source = item as unknown as Record<string, unknown>;
    
    template.columns.forEach(col => {
      let val;
      
      if (col.dbField.startsWith('customFields.') || col.dbField.startsWith('rawImportData.')) {
        const parts = col.dbField.split('.');
        const parent = source[parts[0]];
        val =
          parent && typeof parent === 'object'
            ? (parent as Record<string, unknown>)[parts[1]]
            : "";
      } else {
        val = source[col.dbField];
      }

      if (col.formatter) {
        val = col.formatter(val, item);
      } else {
        // Default boolean formatting
        if (typeof val === 'boolean') {
          val = val ? 'Evet' : 'Hayır';
        }
      }
      
      row[col.header] = val ?? "";
    });
    
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, profile.moduleName);
  
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

// Common Formatters
export const booleanFormatter = (val: unknown) => val ? 'Evet' : 'Hayır';
export const trueFalseFormatter = (val: unknown) => val ? 'True' : 'False';
export const numberFormatter = (val: unknown) => typeof val === 'number' ? val : 0;
