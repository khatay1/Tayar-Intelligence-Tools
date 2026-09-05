import {
  PDF_MAX_FILE_BYTES,
  PDF_MAX_FILES,
  PDF_MAX_PAGES,
  PDF_MAX_TOTAL_BYTES,
  PdfSourceInfo,
} from './pdf-types';

function hasPdfHeader(bytes: Uint8Array) {
  return bytes.length >= 5
    && bytes[0] === 0x25
    && bytes[1] === 0x50
    && bytes[2] === 0x44
    && bytes[3] === 0x46
    && bytes[4] === 0x2d;
}

export function safeBaseName(name: string) {
  return name
    .replace(/\.pdf$/i, '')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80) || 'document';
}

function normalizeDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[،؛]/g, ',')
    .replace(/[–—−]/g, '-');
}

export function bytesToBlob(bytes: Uint8Array, type: string) {
  const copy = bytes.slice();
  return new Blob([copy.buffer], { type });
}

export async function readPdfBytes(file: File) {
  if (file.size <= 0 || file.size > PDF_MAX_FILE_BYTES) {
    throw new Error('PDF files must be larger than 0 bytes and no more than 50 MB each.');
  }

  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (!hasPdfHeader(header)) {
    throw new Error('This file is not a valid PDF document.');
  }

  return new Uint8Array(await file.arrayBuffer());
}

export function validatePdfFiles(files: File[], multiple = false) {
  if (!files.length) throw new Error('Choose a PDF file first.');
  if (!multiple && files.length !== 1) throw new Error('Choose one PDF file for this tool.');
  if (files.length > PDF_MAX_FILES) throw new Error('Choose no more than 12 PDF files.');

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > PDF_MAX_TOTAL_BYTES) {
    throw new Error('The selected PDF files exceed the 120 MB combined safety limit.');
  }
}

export async function inspectPdfFile(file: File): Promise<PdfSourceInfo> {
  const bytes = await readPdfBytes(file);
  try {
    const { PDFDocument } = await import('@pdfme/pdf-lib');
    const document = await PDFDocument.load(bytes, { updateMetadata: false });
    const pageCount = document.getPageCount();
    if (pageCount < 1 || pageCount > PDF_MAX_PAGES) {
      throw new Error('PDF page count must be between 1 and 150 pages.');
    }
    return { name: file.name, size: file.size, pageCount };
  } catch (error) {
    if (error instanceof Error && error.message.includes('PDF page count')) throw error;
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (message.includes('decompression bomb')) {
      throw new Error('This PDF exceeded the safe decompression limit.');
    }
    if (message.includes('encrypt')) {
      throw new Error('Password-protected PDFs must be unlocked before using this local tool.');
    }
    throw new Error('This PDF is damaged or uses an unsupported format.');
  }
}

export function parsePageSelection(value: string, pageCount: number, emptyMeansAll = true) {
  const normalized = normalizeDigits(value).trim().toLowerCase();
  if (!normalized || normalized === 'all') {
    if (!emptyMeansAll) throw new Error('Enter at least one page number.');
    return Array.from({ length: pageCount }, (_, index) => index);
  }

  const selected: number[] = [];
  const seen = new Set<number>();
  const tokens = normalized.split(',').map((token) => token.trim()).filter(Boolean);
  if (!tokens.length) throw new Error('Enter pages like 1-3,5,8.');

  const addPage = (pageNumber: number) => {
    if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > pageCount) {
      throw new Error(`Page numbers must be between 1 and ${pageCount}.`);
    }
    const index = pageNumber - 1;
    if (!seen.has(index)) {
      selected.push(index);
      seen.add(index);
    }
  };

  for (const token of tokens) {
    const range = token.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      const step = start <= end ? 1 : -1;
      for (let page = start; step > 0 ? page <= end : page >= end; page += step) addPage(page);
      continue;
    }

    if (!/^\d+$/.test(token)) throw new Error('Enter pages like 1-3,5,8.');
    addPage(Number(token));
  }

  if (!selected.length) throw new Error('Enter at least one page number.');
  return selected;
}

export function parsePageOrder(value: string, pageCount: number) {
  const order = normalizeDigits(value)
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)
    .map(Number);

  if (order.length !== pageCount || order.some((page) => !Number.isInteger(page))) {
    throw new Error(`Enter every page exactly once, from 1 to ${pageCount}.`);
  }

  const unique = new Set(order);
  if (unique.size !== pageCount || order.some((page) => page < 1 || page > pageCount)) {
    throw new Error(`Enter every page exactly once, from 1 to ${pageCount}.`);
  }

  return order.map((page) => page - 1);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    anchor.click();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
