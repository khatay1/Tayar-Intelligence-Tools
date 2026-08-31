export type CsvDelimiter = ',' | ';' | '\t';

export interface CsvDocument {
  rows: string[][];
  delimiter: CsvDelimiter;
  name: string;
  size: number;
}

export interface CsvCleanOptions {
  trimCells: boolean;
  removeBlankRows: boolean;
  removeDuplicateRows: boolean;
  spreadsheetSafe: boolean;
}

export interface CsvStats {
  rows: number;
  columns: number;
  emptyRows: number;
}

export const MAX_CSV_BYTES = 10 * 1024 * 1024;
export const MAX_CSV_ROWS = 50_000;
export const MAX_CSV_COLUMNS = 200;
export const MAX_CELL_CHARS = 20_000;
export const MAX_TOTAL_CELLS = 500_000;
