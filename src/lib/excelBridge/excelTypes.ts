export interface ExcelColumnMapping {
  dbField: string;
  excelColumn: string;
  isCustomField?: boolean;
}

export interface ExcelImportMetadata {
  customFields?: Record<string, unknown>;
  rawImportData?: Record<string, unknown>;
}

export interface ParsedRow<T = Record<string, unknown>> {
  index: number;
  data: T & ExcelImportMetadata;
  raw: Record<string, unknown>;
  status: 'NEW' | 'UPDATE' | 'ERROR' | 'MANUAL_REVIEW' | 'SKIP';
  errors: string[];
  warnings: string[];
  matchedEntityId?: string;
}

export interface PreviewResult<T = Record<string, unknown>> {
  totalRows: number;
  newCount: number;
  updateCount: number;
  errorCount: number;
  manualReviewCount: number;
  skipCount: number;
  rows: ParsedRow<T>[];
  headers: string[];
  mappings: ExcelColumnMapping[];
}

export interface KnownColumn<T> {
  dbField: keyof T | string;
  aliases: string[]; // Possible excel headers e.g. ['Cari Kodu', 'Müşteri Kodu']
  type: 'string' | 'number' | 'boolean' | 'date' | 'phone';
  required?: boolean;
  parser?: (value: unknown) => unknown;
  isCustom?: boolean;
}

export interface ExcelProfile<T> {
  moduleName: string;
  knownColumns: KnownColumn<T>[];
  // findMatch should check existingData and decide if it's NEW, UPDATE or MANUAL_REVIEW
  findMatch: (row: Partial<T>, existingData: T[]) => { matchId?: string, status: ParsedRow['status'], message?: string };
}
