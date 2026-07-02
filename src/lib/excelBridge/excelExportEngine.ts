import * as XLSX from "xlsx";
import { ExcelProfile } from "./excelTypes";

export interface ExportTemplate {
  name: string;
  columns: {
    header: string;
    dbField: string;
    formatter?: (value: any, row: any) => any;
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
    const row: any = {};
    
    template.columns.forEach(col => {
      let val;
      
      if (col.dbField.startsWith('customFields.') || col.dbField.startsWith('rawImportData.')) {
        const parts = col.dbField.split('.');
        const parent = (item as any)[parts[0]];
        val = parent ? parent[parts[1]] : "";
      } else {
        val = (item as any)[col.dbField];
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
export const booleanFormatter = (val: any) => val ? 'Evet' : 'Hayır';
export const trueFalseFormatter = (val: any) => val ? 'True' : 'False';
export const numberFormatter = (val: any) => typeof val === 'number' ? val : 0;
