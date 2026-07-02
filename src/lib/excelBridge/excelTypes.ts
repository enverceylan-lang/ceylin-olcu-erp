export interface ExcelColumnMapping {
  dbField: string;
  excelColumn: string;
  isCustomField?: boolean;
}

export interface ParsedRow {
  index: number;
  data: any; // Parsed DB object
  raw: any; // Raw Excel row object
  status: 'NEW' | 'UPDATE' | 'ERROR' | 'MANUAL_REVIEW' | 'SKIP';
  errors: string[];
  warnings: string[];
  matchedEntityId?: string;
}

export interface PreviewResult {
  totalRows: number;
  newCount: number;
  updateCount: number;
  errorCount: number;
  manualReviewCount: number;
  skipCount: number;
  rows: ParsedRow[];
  headers: string[];
  mappings: ExcelColumnMapping[];
}

export interface KnownColumn<T> {
  dbField: keyof T | string;
  aliases: string[]; // Possible excel headers e.g. ['Cari Kodu', 'Müşteri Kodu']
  type: 'string' | 'number' | 'boolean' | 'date' | 'phone';
  required?: boolean;
  parser?: (value: any) => any;
  isCustom?: boolean;
}

export interface ExcelProfile<T> {
  moduleName: string;
  knownColumns: KnownColumn<T>[];
  // findMatch should check existingData and decide if it's NEW, UPDATE or MANUAL_REVIEW
  findMatch: (row: Partial<T>, existingData: T[]) => { matchId?: string, status: ParsedRow['status'], message?: string };
}
