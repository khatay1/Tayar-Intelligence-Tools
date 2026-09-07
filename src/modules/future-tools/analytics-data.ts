import { CsvDocument } from '../csv-cleaner/csv-types';

export type AnalyticsColumnType = 'numeric' | 'text' | 'mixed' | 'empty';

export interface AnalyticsColumnProfile {
  name: string;
  index: number;
  type: AnalyticsColumnType;
  nonEmpty: number;
  missing: number;
  uniqueSample: number;
  numericCount: number;
  min?: number;
  max?: number;
  mean?: number;
  sum?: number;
}

export interface AnalyticsProfile {
  fileName: string;
  rowCount: number;
  columnCount: number;
  headers: string[];
  columns: AnalyticsColumnProfile[];
  sampleRows: string[][];
}

function safeHeader(value: string | undefined, index: number, seen: Map<string, number>) {
  const raw = (value || '').trim().slice(0, 120) || `Column ${index + 1}`;
  const count = seen.get(raw) || 0;
  seen.set(raw, count + 1);
  return count === 0 ? raw : `${raw} (${count + 1})`;
}

function parseNumeric(value: string): number | null {
  const text = value.trim();
  if (!text) return null;

  const normalized = text
    .replace(/\u00a0/g, ' ')
    .replace(/[\s$€£¥kr]/gi, '')
    .replace(/%$/, '');

  if (!normalized) return null;

  let candidate = normalized;
  if (/^-?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(candidate)) {
    candidate = candidate.replace(/,/g, '');
  } else if (/^-?\d+(?:,\d+)$/.test(candidate) && !candidate.includes('.')) {
    candidate = candidate.replace(',', '.');
  }

  if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(candidate)) return null;
  const parsed = Number(candidate);
  return Number.isFinite(parsed) ? parsed : null;
}

export function profileCsv(document: CsvDocument): AnalyticsProfile {
  const sourceHeader = document.rows[0] || [];
  const dataRows = document.rows.slice(1);
  const width = Math.max(sourceHeader.length, ...dataRows.slice(0, 1000).map((row) => row.length), 1);
  const seenHeaders = new Map<string, number>();
  const headers = Array.from({ length: width }, (_, index) => safeHeader(sourceHeader[index], index, seenHeaders));

  const columns = headers.map((name, index): AnalyticsColumnProfile => {
    let nonEmpty = 0;
    let numericCount = 0;
    let sum = 0;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    const unique = new Set<string>();

    for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex += 1) {
      const raw = String(dataRows[rowIndex]?.[index] ?? '').trim();
      if (!raw) continue;
      nonEmpty += 1;
      if (unique.size < 5000) unique.add(raw.slice(0, 240));
      const numeric = parseNumeric(raw);
      if (numeric === null) continue;
      numericCount += 1;
      sum += numeric;
      if (numeric < min) min = numeric;
      if (numeric > max) max = numeric;
    }

    const missing = Math.max(0, dataRows.length - nonEmpty);
    let type: AnalyticsColumnType = 'empty';
    if (nonEmpty > 0) {
      const ratio = numericCount / nonEmpty;
      type = ratio >= 0.8 ? 'numeric' : numericCount > 0 ? 'mixed' : 'text';
    }

    return {
      name,
      index,
      type,
      nonEmpty,
      missing,
      uniqueSample: unique.size,
      numericCount,
      ...(numericCount > 0
        ? {
            min,
            max,
            sum,
            mean: sum / numericCount,
          }
        : {}),
    };
  });

  const sampleRows = dataRows.slice(0, 12).map((row) =>
    headers.slice(0, 30).map((_, index) => String(row[index] ?? '').slice(0, 160)),
  );

  return {
    fileName: document.name,
    rowCount: dataRows.length,
    columnCount: headers.length,
    headers,
    columns,
    sampleRows,
  };
}

export function analyticsPromptPayload(profile: AnalyticsProfile) {
  const columns = profile.columns.slice(0, 40).map((column) => ({
    name: column.name,
    type: column.type,
    nonEmpty: column.nonEmpty,
    missing: column.missing,
    uniqueSample: column.uniqueSample,
    ...(column.numericCount > 0
      ? {
          numericCount: column.numericCount,
          min: compactNumber(column.min),
          max: compactNumber(column.max),
          mean: compactNumber(column.mean),
          sum: compactNumber(column.sum),
        }
      : {}),
  }));

  return JSON.stringify({
    fileName: profile.fileName,
    totalDataRows: profile.rowCount,
    totalColumns: profile.columnCount,
    columns,
    sampleHeaders: profile.headers.slice(0, 30),
    firstRowsSample: profile.sampleRows,
    importantScopeNote: 'Statistics cover the parsed local dataset. Row samples contain only the first 12 rows and at most 30 columns; do not claim row-level findings beyond evidence supplied here.',
  });
}

function compactNumber(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return Number(value.toPrecision(8));
}

export function displayNumber(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}
