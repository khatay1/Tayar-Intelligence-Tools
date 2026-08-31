import { CsvCleanOptions, CsvDelimiter, CsvStats } from './csv-types';

function isBlankRow(row: string[]) {
  return row.every((cell) => cell.trim() === '');
}

export function cleanCsvRows(rows: string[][], options: CsvCleanOptions): string[][] {
  const cleaned: string[][] = [];
  const seen = new Set<string>();

  for (const sourceRow of rows) {
    const row = options.trimCells
      ? sourceRow.map((cell) => cell.trim())
      : [...sourceRow];

    if (options.removeBlankRows && isBlankRow(row)) continue;

    if (options.removeDuplicateRows) {
      const signature = JSON.stringify(row);
      if (seen.has(signature)) continue;
      seen.add(signature);
    }

    cleaned.push(row);
  }

  return cleaned;
}

export function csvStats(rows: string[][]): CsvStats {
  let columns = 0;
  let emptyRows = 0;

  for (const row of rows) {
    columns = Math.max(columns, row.length);
    if (isBlankRow(row)) emptyRows += 1;
  }

  return { rows: rows.length, columns, emptyRows };
}

export function sanitizeSpreadsheetCell(value: string) {
  const trimmed = value.replace(/^\s+/, '');
  if (
    trimmed.startsWith('=') ||
    trimmed.startsWith('+') ||
    trimmed.startsWith('-') ||
    trimmed.startsWith('@') ||
    trimmed.startsWith('\t') ||
    trimmed.startsWith('\r')
  ) {
    return `'${value}`;
  }
  return value;
}

function encodeCell(value: string, delimiter: CsvDelimiter, spreadsheetSafe: boolean) {
  const safe = spreadsheetSafe ? sanitizeSpreadsheetCell(value) : value;
  if (safe.includes('"') || safe.includes('\n') || safe.includes('\r') || safe.includes(delimiter)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function serializeCsv(rows: string[][], delimiter: CsvDelimiter, spreadsheetSafe: boolean) {
  return rows
    .map((row) => row.map((cell) => encodeCell(cell, delimiter, spreadsheetSafe)).join(delimiter))
    .join('\r\n');
}

export function outputCsvName(sourceName: string) {
  const base = sourceName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80) || 'data';
  return `${base}-cleaned.csv`;
}
