import * as XLSX from "xlsx";
import { ExcelProfile, ExcelColumnMapping, PreviewResult, ParsedRow, KnownColumn } from "./excelTypes";

/**
 * Reads the headers of an Excel file.
 */
export const readExcelHeaders = async (file: File, sheetName?: string): Promise<{ headers: string[], sheets: string[] }> => {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  
  const targetSheetName = sheetName || workbook.SheetNames[0];
  const worksheet = workbook.Sheets[targetSheetName];
  
  if (!worksheet) {
    throw new Error("Seçilen sayfa bulunamadı.");
  }

  // Get range and headers
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  const headers: string[] = [];
  
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const cellAddress = { c: C, r: range.s.r };
    const cellRef = XLSX.utils.encode_cell(cellAddress);
    const cell = worksheet[cellRef];
    
    // Auto-generate header name if empty
    let headerName = cell && cell.v ? String(cell.v).trim() : `Kolon ${C + 1}`;
    
    // Handle duplicate header names by appending numbers
    let originalName = headerName;
    let counter = 1;
    while (headers.includes(headerName)) {
      headerName = `${originalName} (${counter})`;
      counter++;
    }
    
    headers.push(headerName);
  }

  return { headers, sheets: workbook.SheetNames };
};

/**
 * Auto-maps headers based on profile known columns
 */
export const autoMapHeaders = <T>(headers: string[], profile: ExcelProfile<T>): ExcelColumnMapping[] => {
  const mappings: ExcelColumnMapping[] = [];
  const usedDbFields = new Set<string>();

  headers.forEach(header => {
    const lowerHeader = header.toLowerCase();
    
    // Find best match in profile
    const match = profile.knownColumns.find(col => 
      !usedDbFields.has(col.dbField as string) &&
      col.aliases.some(alias => alias.toLowerCase() === lowerHeader)
    );

    if (match) {
      mappings.push({ excelColumn: header, dbField: match.dbField as string, isCustomField: match.isCustom });
      usedDbFields.add(match.dbField as string);
    } else {
      mappings.push({ excelColumn: header, dbField: "", isCustomField: true });
    }
  });

  return mappings;
};

/**
 * Generates a preview of the imported data against existing data
 */
export const generatePreview = async <T>(
  file: File, 
  sheetName: string, 
  mappings: ExcelColumnMapping[], 
  profile: ExcelProfile<T>,
  existingData: T[]
): Promise<PreviewResult> => {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const worksheet = workbook.Sheets[sheetName];
  
  // Read as array of arrays (defval empty string)
  const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
  
  if (rows.length < 2) {
    throw new Error("Dosyada işlenecek veri bulunamadı.");
  }

  const headers = rows[0].map(String);
  const dataRows = rows.slice(1);
  
  const result: PreviewResult = {
    totalRows: dataRows.length,
    newCount: 0,
    updateCount: 0,
    errorCount: 0,
    manualReviewCount: 0,
    skipCount: 0,
    rows: [],
    headers,
    mappings
  };

  // Build a lookup map for faster access
  const headerIndexMap = new Map<string, number>();
  headers.forEach((h, i) => headerIndexMap.set(h, i));

  const validMappings = mappings.filter(m => m.dbField !== "");

  dataRows.forEach((rowArray, index) => {
    // Skip completely empty rows
    if (rowArray.every(cell => cell === "" || cell === null || cell === undefined)) {
      result.totalRows--;
      return;
    }

    const raw: any = {};
    const parsedData: Partial<T> & { customFields?: any, rawImportData?: any } = {
      customFields: {},
      rawImportData: {}
    } as any;
    
    let hasError = false;
    const errors: string[] = [];
    const warnings: string[] = [];

    // Map each cell based on mappings
    validMappings.forEach(mapping => {
      const colIndex = headerIndexMap.get(mapping.excelColumn);
      if (colIndex === undefined) return;
      
      let val = rowArray[colIndex];
      raw[mapping.excelColumn] = val;

      if (val === "" || val === null || val === undefined) return;

      if (mapping.isCustomField) {
        // If it's mapped to a generic name like "custom_X" or just left as raw
        parsedData.rawImportData[mapping.excelColumn] = val;
      } else {
        const knownCol = profile.knownColumns.find(c => c.dbField === mapping.dbField);
        if (knownCol) {
          try {
            if (knownCol.parser) {
              val = knownCol.parser(val);
            } else if (knownCol.type === 'string') {
              val = String(val).trim();
            } else if (knownCol.type === 'number') {
              val = Number(val);
              if (isNaN(val)) throw new Error("Sayısal değer bekleniyor");
            } else if (knownCol.type === 'boolean') {
              val = Boolean(val);
            }
            
            // Avoid type checking issues with dynamic keys
            (parsedData as any)[mapping.dbField] = val;
          } catch (e: any) {
            hasError = true;
            errors.push(`${mapping.excelColumn} hücresinde hata: ${e.message}`);
          }
        } else {
          // Explicit dbField mapping but not in profile (fallback)
          (parsedData as any)[mapping.dbField] = val;
        }
      }
    });

    // Check required fields
    profile.knownColumns.filter(c => c.required).forEach(c => {
      const val = (parsedData as any)[c.dbField as string];
      if (val === undefined || val === null || val === "") {
        hasError = true;
        errors.push(`${c.aliases[0]} zorunlu alandır.`);
      }
    });

    let status: ParsedRow['status'] = 'ERROR';
    let matchId: string | undefined;

    if (!hasError) {
      const matchResult = profile.findMatch(parsedData, existingData);
      status = matchResult.status;
      matchId = matchResult.matchId;
      if (matchResult.message) {
        warnings.push(matchResult.message);
      }
    }

    const parsedRow: ParsedRow = {
      index,
      data: parsedData,
      raw,
      status,
      errors,
      warnings,
      matchedEntityId: matchId
    };

    result.rows.push(parsedRow);
    
    // Update counts
    if (status === 'NEW') result.newCount++;
    else if (status === 'UPDATE') result.updateCount++;
    else if (status === 'ERROR') result.errorCount++;
    else if (status === 'MANUAL_REVIEW') result.manualReviewCount++;
    else if (status === 'SKIP') result.skipCount++;
  });

  return result;
};
