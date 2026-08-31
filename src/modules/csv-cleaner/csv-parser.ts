import {
  CsvDelimiter,
  CsvDocument,
  MAX_CELL_CHARS,
  MAX_CSV_BYTES,
  MAX_CSV_COLUMNS,
  MAX_CSV_ROWS,
  MAX_TOTAL_CELLS,
} from './csv-types';

const ALLOWED_EXTENSIONS = ['.csv', '.txt', '.tsv'];

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._ -]+/g, '-').slice(0, 120) || 'data.csv';
}

function validateCsvFile(file: File) {
  const lower = file.name.toLowerCase();
  if (!ALLOWED_EXTENSIONS.some((extension) => lower.endsWith(extension))) {
    throw new Error('Choose a CSV, TSV or plain-text delimited file.');
  }
  if (file.size <= 0 || file.size > MAX_CSV_BYTES) {
    throw new Error('File must be larger than 0 bytes and no more than 10 MB.');
  }
}

export function detectDelimiter(text: string): CsvDelimiter {
  const sample = text.slice(0, 8192);
  const counts: Record<CsvDelimiter, number> = { ',': 0, ';': 0, '\t': 0 };
  let quoted = false;

  for (let index = 0; index < sample.length; index += 1) {
    const char = sample[index];
    if (char === '"') {
      if (quoted && sample[index + 1] === '"') {
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (!quoted && (char === ',' || char === ';' || char === '\t')) {
      counts[char] += 1;
    }
  }

  if (counts['\t'] >= counts[','] && counts['\t'] >= counts[';'] && counts['\t'] > 0) return '\t';
  if (counts[';'] > counts[',']) return ';';
  return ',';
}

export function parseDelimitedText(text: string, delimiter: CsvDelimiter): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let totalCells = 0;

  const pushCell = () => {
    if (cell.length > MAX_CELL_CHARS) throw new Error('A cell exceeds the 20,000 character safety limit.');
    row.push(cell);
    cell = '';
    if (row.length > MAX_CSV_COLUMNS) throw new Error('CSV exceeds the 200-column safety limit.');
    totalCells += 1;
    if (totalCells > MAX_TOTAL_CELLS) throw new Error('CSV contains too many cells to process safely in the browser.');
  };

  const pushRow = () => {
    pushCell();
    rows.push(row);
    row = [];
    if (rows.length > MAX_CSV_ROWS) throw new Error('CSV exceeds the 50,000-row safety limit.');
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
        if (cell.length > MAX_CELL_CHARS) throw new Error('A cell exceeds the 20,000 character safety limit.');
      }
      continue;
    }

    if (char === '"') {
      if (cell.length === 0) quoted = true;
      else cell += char;
    } else if (char === delimiter) {
      pushCell();
    } else if (char === '\n') {
      pushRow();
    } else if (char === '\r') {
      if (text[index + 1] === '\n') index += 1;
      pushRow();
    } else {
      cell += char;
      if (cell.length > MAX_CELL_CHARS) throw new Error('A cell exceeds the 20,000 character safety limit.');
    }
  }

  if (quoted) throw new Error('CSV contains an unterminated quoted field.');

  if (cell.length > 0 || row.length > 0) {
    pushRow();
  }

  return rows;
}

export async function readCsvFile(file: File): Promise<CsvDocument> {
  validateCsvFile(file);
  const text = await file.text();
  const normalizedText = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const delimiter = detectDelimiter(normalizedText);
  const rows = parseDelimitedText(normalizedText, delimiter);

  if (!rows.length) throw new Error('The file does not contain any rows.');

  return {
    rows,
    delimiter,
    name: safeFileName(file.name),
    size: file.size,
  };
}
