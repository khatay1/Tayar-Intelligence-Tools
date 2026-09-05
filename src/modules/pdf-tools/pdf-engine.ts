import type { PDFDocument as PdfDocument, PDFImage, PDFPage } from '@pdfme/pdf-lib';
import { createStoreOnlyZip } from '../batch-image-tools/zip-writer';
import {
  PdfActionOptions,
  PdfPosition,
  PdfProcessProgress,
  PdfProcessResult,
  PDF_MAX_SPLIT_PAGES,
} from './pdf-types';
import {
  bytesToBlob,
  parsePageOrder,
  parsePageSelection,
  readPdfBytes,
  safeBaseName,
  validatePdfFiles,
} from './pdf-utils';

type ProgressHandler = (progress: PdfProcessProgress) => void;

const MM_TO_POINTS = 72 / 25.4;
const A4: [number, number] = [595.28, 841.89];
const LETTER: [number, number] = [612, 792];

async function loadEditablePdf(file: File) {
  const bytes = await readPdfBytes(file);
  const { PDFDocument } = await import('@pdfme/pdf-lib');
  try {
    const document = await PDFDocument.load(bytes, { updateMetadata: false });
    if (document.getPageCount() < 1 || document.getPageCount() > 150) {
      throw new Error('PDF page count must be between 1 and 150 pages.');
    }
    return document;
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

function markOutput(document: PdfDocument) {
  document.setProducer('Tayar PDF Studio');
  document.setCreator('Tayar PDF Studio');
  document.setModificationDate(new Date());
}

async function saveDocument(document: PdfDocument) {
  markOutput(document);
  const bytes = await document.save({ useObjectStreams: true, addDefaultPage: false });
  return bytesToBlob(bytes, 'application/pdf');
}

async function copyPagesToNewDocument(source: PdfDocument, indices: number[]) {
  const { PDFDocument } = await import('@pdfme/pdf-lib');
  const output = await PDFDocument.create();
  const copied = await output.copyPages(source, indices);
  for (const page of copied) output.addPage(page);
  return output;
}

async function mergePdfFiles(files: File[], onProgress?: ProgressHandler) {
  validatePdfFiles(files, true);
  if (files.length < 2) throw new Error('Choose at least two PDF files to merge.');

  const { PDFDocument } = await import('@pdfme/pdf-lib');
  const output = await PDFDocument.create();
  for (let index = 0; index < files.length; index += 1) {
    const source = await loadEditablePdf(files[index]);
    const pages = await output.copyPages(source, source.getPageIndices());
    for (const page of pages) output.addPage(page);
    onProgress?.({ completed: index + 1, total: files.length });
  }

  if (output.getPageCount() > 150) throw new Error('The merged PDF cannot exceed 150 pages.');
  return saveDocument(output);
}

async function splitPdf(file: File, onProgress?: ProgressHandler) {
  const source = await loadEditablePdf(file);
  const pageCount = source.getPageCount();
  if (pageCount > PDF_MAX_SPLIT_PAGES) {
    throw new Error('Splitting supports PDFs up to 100 pages per ZIP.');
  }
  const entries: Array<{ name: string; data: Uint8Array }> = [];
  const base = safeBaseName(file.name);

  for (let index = 0; index < pageCount; index += 1) {
    const output = await copyPagesToNewDocument(source, [index]);
    markOutput(output);
    entries.push({
      name: `${base}-page-${String(index + 1).padStart(3, '0')}.pdf`,
      data: await output.save({ useObjectStreams: true, addDefaultPage: false }),
    });
    onProgress?.({ completed: index + 1, total: pageCount });
  }

  return createStoreOnlyZip(entries);
}

async function extractPages(file: File, pageSelection: string) {
  const source = await loadEditablePdf(file);
  const indices = parsePageSelection(pageSelection, source.getPageCount(), false);
  return saveDocument(await copyPagesToNewDocument(source, indices));
}

async function deletePages(file: File, pageSelection: string) {
  const source = await loadEditablePdf(file);
  const removed = new Set(parsePageSelection(pageSelection, source.getPageCount(), false));
  const kept = source.getPageIndices().filter((index) => !removed.has(index));
  if (!kept.length) throw new Error('You cannot delete every page from the PDF.');
  return saveDocument(await copyPagesToNewDocument(source, kept));
}

async function reorderPages(file: File, pageOrder: string) {
  const source = await loadEditablePdf(file);
  const indices = parsePageOrder(pageOrder, source.getPageCount());
  return saveDocument(await copyPagesToNewDocument(source, indices));
}

async function rotatePages(file: File, pageSelection: string, rotation: 90 | 180 | 270) {
  const document = await loadEditablePdf(file);
  const selected = parsePageSelection(pageSelection, document.getPageCount());
  const { degrees } = await import('@pdfme/pdf-lib');
  for (const index of selected) {
    const page = document.getPage(index);
    const current = page.getRotation().angle;
    page.setRotation(degrees((current + rotation) % 360));
  }
  return saveDocument(document);
}

async function cropPages(file: File, options: PdfActionOptions) {
  const document = await loadEditablePdf(file);
  const selected = parsePageSelection(options.pageSelection, document.getPageCount());
  const margins = options.cropMm;
  const values = [margins.top, margins.right, margins.bottom, margins.left];
  if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 100)) {
    throw new Error('Crop margins must be between 0 and 100 millimetres.');
  }

  for (const index of selected) {
    const page = document.getPage(index);
    const box = page.getCropBox();
    const left = margins.left * MM_TO_POINTS;
    const right = margins.right * MM_TO_POINTS;
    const top = margins.top * MM_TO_POINTS;
    const bottom = margins.bottom * MM_TO_POINTS;
    const width = box.width - left - right;
    const height = box.height - top - bottom;
    if (width < 36 || height < 36) throw new Error('Crop margins leave no usable page area.');
    page.setCropBox(box.x + left, box.y + bottom, width, height);
  }

  return saveDocument(document);
}

function getPlacement(
  page: PDFPage,
  itemWidth: number,
  itemHeight: number,
  position: PdfPosition,
  margin = 24,
) {
  const box = page.getCropBox();
  const centerX = box.x + (box.width - itemWidth) / 2;
  const centerY = box.y + (box.height - itemHeight) / 2;
  const left = box.x + margin;
  const right = box.x + box.width - itemWidth - margin;
  const top = box.y + box.height - itemHeight - margin;
  const bottom = box.y + margin;

  switch (position) {
    case 'top-left': return { x: left, y: top };
    case 'top-center': return { x: centerX, y: top };
    case 'top-right': return { x: right, y: top };
    case 'center': return { x: centerX, y: centerY };
    case 'bottom-left': return { x: left, y: bottom };
    case 'bottom-right': return { x: right, y: bottom };
    default: return { x: centerX, y: bottom };
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('The browser could not create the text layer.')),
      type,
      quality,
    );
  });
}

async function createTextImage(document: PdfDocument, text: string, fontSize: number, color: string) {
  const normalized = text.trim().slice(0, 500);
  if (!normalized) throw new Error('Enter the text you want to add.');
  if (!Number.isFinite(fontSize) || fontSize < 8 || fontSize > 120) {
    throw new Error('Text size must be between 8 and 120 points.');
  }

  const scale = 3;
  const lines = normalized.split(/\r?\n/).slice(0, 8);
  const canvas = window.document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas processing is not available in this browser.');
  context.font = `600 ${fontSize * scale}px system-ui, sans-serif`;
  const measuredWidth = Math.max(...lines.map((line) => context.measureText(line || ' ').width));
  const padding = Math.max(18, fontSize) * scale;
  canvas.width = Math.max(8, Math.min(4096, Math.ceil(measuredWidth + padding * 2)));
  canvas.height = Math.max(8, Math.min(2048, Math.ceil(lines.length * fontSize * scale * 1.35 + padding * 2)));

  const draw = canvas.getContext('2d');
  if (!draw) throw new Error('Canvas processing is not available in this browser.');
  draw.clearRect(0, 0, canvas.width, canvas.height);
  draw.font = `600 ${fontSize * scale}px system-ui, sans-serif`;
  draw.fillStyle = color;
  draw.textBaseline = 'middle';
  const rtl = /[\u0590-\u08ff]/.test(normalized);
  draw.direction = rtl ? 'rtl' : 'ltr';
  draw.textAlign = rtl ? 'right' : 'left';
  const x = rtl ? canvas.width - padding : padding;
  lines.forEach((line, index) => {
    draw.fillText(line, x, padding + fontSize * scale * (0.7 + index * 1.35), canvas.width - padding * 2);
  });

  const blob = await canvasToBlob(canvas);
  const image = await document.embedPng(await blob.arrayBuffer());
  return {
    image,
    width: canvas.width / scale,
    height: canvas.height / scale,
  };
}

function fitImageToPage(page: PDFPage, imageWidth: number, imageHeight: number, maxWidthRatio = 0.78) {
  const pageBox = page.getCropBox();
  const maxWidth = Math.max(24, pageBox.width * maxWidthRatio);
  const maxHeight = Math.max(24, pageBox.height * 0.45);
  const scale = Math.min(1, maxWidth / imageWidth, maxHeight / imageHeight);
  return { width: imageWidth * scale, height: imageHeight * scale };
}

function rotatePlacementAroundCenter(
  placement: { x: number; y: number },
  width: number,
  height: number,
  angleDegrees: number,
) {
  const angle = angleDegrees * Math.PI / 180;
  const targetX = placement.x + width / 2;
  const targetY = placement.y + height / 2;
  return {
    x: targetX - Math.cos(angle) * width / 2 + Math.sin(angle) * height / 2,
    y: targetY - Math.sin(angle) * width / 2 - Math.cos(angle) * height / 2,
  };
}

async function addTextStamp(file: File, options: PdfActionOptions, watermark: boolean) {
  const document = await loadEditablePdf(file);
  const selected = parsePageSelection(options.pageSelection, document.getPageCount());
  const stamp = await createTextImage(document, options.text, options.fontSize, watermark ? '#4c1d95' : '#111827');
  const { degrees } = await import('@pdfme/pdf-lib');

  for (const index of selected) {
    const page = document.getPage(index);
    const fitted = fitImageToPage(page, stamp.width, stamp.height, watermark ? 0.72 : 0.82);
    const placement = getPlacement(page, fitted.width, fitted.height, options.position, 28);
    const drawPlacement = watermark
      ? rotatePlacementAroundCenter(placement, fitted.width, fitted.height, -30)
      : placement;
    page.drawImage(stamp.image, {
      ...drawPlacement,
      width: fitted.width,
      height: fitted.height,
      opacity: watermark ? Math.min(0.8, Math.max(0.05, options.opacity)) : 1,
      rotate: watermark ? degrees(-30) : degrees(0),
    });
  }

  return saveDocument(document);
}

async function addPageNumbers(file: File, options: PdfActionOptions) {
  const document = await loadEditablePdf(file);
  const selected = parsePageSelection(options.pageSelection, document.getPageCount());
  const { StandardFonts, rgb } = await import('@pdfme/pdf-lib');
  const font = await document.embedFont(StandardFonts.Helvetica);
  const size = Math.min(28, Math.max(8, options.fontSize));
  const start = Math.max(-9999, Math.min(9999, Math.round(options.startNumber)));

  selected.forEach((pageIndex, selectedIndex) => {
    const page = document.getPage(pageIndex);
    const text = String(start + selectedIndex);
    const width = font.widthOfTextAtSize(text, size);
    const height = font.heightAtSize(size);
    const placement = getPlacement(page, width, height, options.position, 22);
    page.drawText(text, { ...placement, size, font, color: rgb(0.12, 0.12, 0.16) });
  });

  return saveDocument(document);
}

async function normalizeSignature(document: PdfDocument, file: File): Promise<PDFImage> {
  if (file.size <= 0 || file.size > 10 * 1024 * 1024) {
    throw new Error('Signature images must be no more than 10 MB.');
  }
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('Use a PNG, JPEG, or WebP signature image.');
  }

  if (file.type === 'image/png') return document.embedPng(await file.arrayBuffer());
  if (file.type === 'image/jpeg') return document.embedJpg(await file.arrayBuffer());

  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 25_000_000 || bitmap.width > 8000 || bitmap.height > 8000) {
      throw new Error('Signature image dimensions are too large to process safely.');
    }
    const canvas = window.document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas processing is not available in this browser.');
    context.drawImage(bitmap, 0, 0);
    return document.embedPng(await (await canvasToBlob(canvas)).arrayBuffer());
  } finally {
    bitmap.close();
  }
}

async function signPdf(file: File, options: PdfActionOptions) {
  if (!options.signatureFile) throw new Error('Choose a signature image first.');
  const document = await loadEditablePdf(file);
  const selected = parsePageSelection(options.pageSelection, document.getPageCount());
  const image = await normalizeSignature(document, options.signatureFile);
  const widthPercent = Math.min(60, Math.max(10, options.signatureWidthPercent));

  for (const index of selected) {
    const page = document.getPage(index);
    const pageBox = page.getCropBox();
    const width = pageBox.width * (widthPercent / 100);
    const height = width * (image.height / image.width);
    const fitted = fitImageToPage(page, width, height, 0.7);
    page.drawImage(image, {
      ...getPlacement(page, fitted.width, fitted.height, options.position, 28),
      width: fitted.width,
      height: fitted.height,
    });
  }

  return saveDocument(document);
}

async function createBlankPdf(options: PdfActionOptions) {
  const pageCount = Math.round(options.createPageCount);
  if (pageCount < 1 || pageCount > 20) throw new Error('Blank PDFs can contain between 1 and 20 pages.');
  const { PDFDocument } = await import('@pdfme/pdf-lib');
  const document = await PDFDocument.create();
  const base = options.createPageSize === 'letter' ? LETTER : A4;
  const size: [number, number] = options.createOrientation === 'landscape'
    ? [base[1], base[0]]
    : base;
  for (let index = 0; index < pageCount; index += 1) document.addPage(size);
  return saveDocument(document);
}

async function flattenPdf(file: File) {
  const document = await loadEditablePdf(file);
  const form = document.getForm();
  if (!form.getFields().length) throw new Error('This PDF does not contain interactive form fields.');
  form.flatten({ updateFieldAppearances: true });
  return saveDocument(document);
}

function firstFile(options: PdfActionOptions) {
  validatePdfFiles(options.files);
  return options.files[0];
}

export async function runPdfAction(
  options: PdfActionOptions,
  onProgress?: ProgressHandler,
): Promise<PdfProcessResult> {
  const file = options.files[0];
  const base = file ? safeBaseName(file.name) : 'tayar-document';

  switch (options.operation) {
    case 'merge': {
      const blob = await mergePdfFiles(options.files, onProgress);
      return { kind: 'pdf', blob, filename: 'tayar-merged.pdf', itemCount: options.files.length };
    }
    case 'split': {
      const source = firstFile(options);
      const blob = await splitPdf(source, onProgress);
      return { kind: 'zip', blob, filename: `${base}-split.zip` };
    }
    case 'extract':
      return { kind: 'pdf', blob: await extractPages(firstFile(options), options.pageSelection), filename: `${base}-extracted.pdf` };
    case 'delete':
      return { kind: 'pdf', blob: await deletePages(firstFile(options), options.pageSelection), filename: `${base}-pages-removed.pdf` };
    case 'reorder':
      return { kind: 'pdf', blob: await reorderPages(firstFile(options), options.pageOrder), filename: `${base}-reordered.pdf` };
    case 'rotate':
      return { kind: 'pdf', blob: await rotatePages(firstFile(options), options.pageSelection, options.rotation), filename: `${base}-rotated.pdf` };
    case 'crop':
      return { kind: 'pdf', blob: await cropPages(firstFile(options), options), filename: `${base}-cropped.pdf` };
    case 'page-numbers':
      return { kind: 'pdf', blob: await addPageNumbers(firstFile(options), options), filename: `${base}-numbered.pdf` };
    case 'watermark':
      return { kind: 'pdf', blob: await addTextStamp(firstFile(options), options, true), filename: `${base}-watermarked.pdf` };
    case 'add-text':
      return { kind: 'pdf', blob: await addTextStamp(firstFile(options), options, false), filename: `${base}-with-text.pdf` };
    case 'sign':
      return { kind: 'pdf', blob: await signPdf(firstFile(options), options), filename: `${base}-signed.pdf` };
    case 'create':
      return { kind: 'pdf', blob: await createBlankPdf(options), filename: 'tayar-new.pdf', itemCount: options.createPageCount };
    case 'to-images': {
      const { pdfToImagesZip } = await import('./pdf-render');
      const output = await pdfToImagesZip(firstFile(options), options.imageFormat, options.imageScale, options.imageQuality, onProgress);
      return { kind: 'zip', blob: output.blob, filename: `${base}-${options.imageFormat}.zip`, itemCount: output.pageCount };
    }
    case 'extract-text': {
      const { extractPdfText } = await import('./pdf-render');
      const output = await extractPdfText(firstFile(options), onProgress);
      const blob = new Blob([output.text], { type: 'text/plain;charset=utf-8' });
      return { kind: 'text', blob, text: output.text, filename: `${base}.txt`, itemCount: output.pageCount };
    }
    case 'compress': {
      const { compressPdf } = await import('./pdf-render');
      const blob = await compressPdf(firstFile(options), options.compressionPreset, onProgress);
      return { kind: 'pdf', blob, filename: `${base}-compressed.pdf` };
    }
    case 'flatten':
      return { kind: 'pdf', blob: await flattenPdf(firstFile(options)), filename: `${base}-flattened.pdf` };
  }
}
