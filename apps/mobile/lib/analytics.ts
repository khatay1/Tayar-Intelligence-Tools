export type AnalyticsColumnType = 'numeric' | 'text' | 'mixed' | 'empty';

export type AnalyticsColumn = {
  name: string;
  type: AnalyticsColumnType;
  nonEmpty: number;
  missing: number;
  uniqueSample: number;
  numericCount: number;
  min?: number;
  max?: number;
  mean?: number;
  sum?: number;
};

export type AnalyticsProfile = {
  fileName: string;
  rowCount: number;
  columnCount: number;
  headers: string[];
  columns: AnalyticsColumn[];
  sampleRows: string[][];
};

export function parseDelimitedText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const normalized = text.replace(/^\uFEFF/, '');

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    if (char === '"') {
      if (quoted && normalized[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (!quoted && (char === ',' || char === ';' || char === '\t')) {
      row.push(field);
      field = '';
      continue;
    }
    if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && normalized[index + 1] === '\n') index += 1;
      row.push(field);
      field = '';
      if (row.some((value) => value.trim().length > 0)) rows.push(row);
      row = [];
      if (rows.length >= 20001) break;
      continue;
    }
    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((value) => value.trim().length > 0)) rows.push(row);
  }
  return rows.map((items) => items.slice(0, 80));
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
  const normalized = text.replace(/\u00a0/g, ' ').replace(/[\s$€£¥kr]/gi, '').replace(/%$/, '');
  if (!normalized) return null;
  let candidate = normalized;
  if (/^-?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(candidate)) candidate = candidate.replace(/,/g, '');
  else if (/^-?\d+(?:,\d+)$/.test(candidate) && !candidate.includes('.')) candidate = candidate.replace(',', '.');
  if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(candidate)) return null;
  const parsed = Number(candidate);
  return Number.isFinite(parsed) ? parsed : null;
}

function distributedSample<T>(rows: T[], count: number): T[] {
  if (rows.length <= count) return rows.slice();
  const indexes = new Set<number>();
  for (let index = 0; index < count; index += 1) indexes.add(Math.floor((index * (rows.length - 1)) / Math.max(1, count - 1)));
  return [...indexes].sort((a, b) => a - b).map((index) => rows[index]);
}

export function profileRows(fileName: string, rows: string[][]): AnalyticsProfile {
  if (!rows.length) throw new Error('The file does not contain readable rows.');
  const sourceHeader = rows[0] || [];
  const dataRows = rows.slice(1);
  const width = Math.max(sourceHeader.length, ...dataRows.slice(0, 1000).map((row) => row.length), 1);
  const seen = new Map<string, number>();
  const headers = Array.from({ length: width }, (_, index) => safeHeader(sourceHeader[index], index, seen));

  const columns = headers.map((name, index): AnalyticsColumn => {
    let nonEmpty = 0;
    let numericCount = 0;
    let sum = 0;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    const unique = new Set<string>();
    for (const dataRow of dataRows) {
      const raw = String(dataRow[index] ?? '').trim();
      if (!raw) continue;
      nonEmpty += 1;
      if (unique.size < 2000) unique.add(raw.slice(0, 200));
      const numeric = parseNumeric(raw);
      if (numeric === null) continue;
      numericCount += 1;
      sum += numeric;
      min = Math.min(min, numeric);
      max = Math.max(max, numeric);
    }
    const missing = Math.max(0, dataRows.length - nonEmpty);
    const ratio = nonEmpty ? numericCount / nonEmpty : 0;
    const type: AnalyticsColumnType = nonEmpty === 0 ? 'empty' : ratio >= 0.8 ? 'numeric' : numericCount > 0 ? 'mixed' : 'text';
    return { name, type, nonEmpty, missing, uniqueSample: unique.size, numericCount, ...(numericCount ? { min, max, sum, mean: sum / numericCount } : {}) };
  });

  return {
    fileName,
    rowCount: dataRows.length,
    columnCount: headers.length,
    headers,
    columns,
    sampleRows: distributedSample(dataRows, 12).map((dataRow) => headers.slice(0, 30).map((_, index) => String(dataRow[index] ?? '').slice(0, 160))),
  };
}

function compact(value: number | undefined) {
  return value === undefined || !Number.isFinite(value) ? undefined : Number(value.toPrecision(8));
}

export function analyticsPromptPayload(profile: AnalyticsProfile) {
  return JSON.stringify({
    fileName: profile.fileName,
    totalDataRows: profile.rowCount,
    totalColumns: profile.columnCount,
    columns: profile.columns.slice(0, 40).map((column) => ({
      name: column.name,
      type: column.type,
      nonEmpty: column.nonEmpty,
      missing: column.missing,
      uniqueSample: column.uniqueSample,
      ...(column.numericCount ? { numericCount: column.numericCount, min: compact(column.min), max: compact(column.max), mean: compact(column.mean), sum: compact(column.sum) } : {}),
    })),
    sampleHeaders: profile.headers.slice(0, 30),
    distributedRowsSample: profile.sampleRows,
    privacyNote: 'Statistics cover the parsed local file. Only this compact summary and a distributed sample of up to 12 rows are sent to AI; the full file is not uploaded.',
  });
}
