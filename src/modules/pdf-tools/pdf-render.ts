import type { PDFPageProxy } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { createStoreOnlyZip } from '../batch-image-tools/zip-writer';
import {
  PDF_MAX_RENDER_PAGES,
  PdfCompressionPreset,
  PdfImageFormat,
  PdfProcessProgress,
} from './pdf-types';
import { bytesToBlob, readPdfBytes, safeBaseName } from './pdf-utils';

type ProgressHandler = (progress: PdfProcessProgress) => void;

const MAX_RENDER_PIXELS = 16_000_000;

async function openPdf(file: File) {
  const data = await readPdfBytes(file);
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const loadingTask = pdfjs.getDocument({
    data,
    isEvalSupported: false,
    useWorkerFetch: false,
  });

  try {
    const document = await loadingTask.promise;
    if (document.numPages < 1 || document.numPages > PDF_MAX_RENDER_PAGES) {
      await document.destroy();
      throw new Error('Image and text conversion supports PDFs up to 60 pages.');
    }
    return document;
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (message.includes('password')) {
      throw new Error('Password-protected PDFs must be unlocked before conversion.');
    }
    if (error instanceof Error && error.message.includes('supports PDFs')) throw error;
    throw new Error('This PDF could not be rendered safely in the browser.');
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('The browser could not encode this PDF page.')),
      type,
      quality,
    );
  });
}

async function renderPage(
  page: PDFPageProxy,
  format: PdfImageFormat,
  requestedScale: number,
  quality: number,
) {
  const baseViewport = page.getViewport({ scale: 1 });
  const requestedPixels = baseViewport.width * baseViewport.height * requestedScale * requestedScale;
  const safeScale = requestedPixels > MAX_RENDER_PIXELS
    ? requestedScale * Math.sqrt(MAX_RENDER_PIXELS / requestedPixels)
    : requestedScale;
  const viewport = page.getViewport({ scale: Math.max(0.5, safeScale) });
  const canvas = window.document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Canvas processing is not available in this browser.');

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvas, canvasContext: context, viewport, background: '#ffffff' }).promise;
  const blob = await canvasToBlob(
    canvas,
    format === 'png' ? 'image/png' : 'image/jpeg',
    format === 'png' ? undefined : Math.min(0.95, Math.max(0.35, quality)),
  );
  canvas.width = 1;
  canvas.height = 1;
  return { blob, pageWidth: baseViewport.width, pageHeight: baseViewport.height };
}

export async function pdfToImagesZip(
  file: File,
  format: PdfImageFormat,
  scale: number,
  quality: number,
  onProgress?: ProgressHandler,
) {
  const document = await openPdf(file);
  const entries: Array<{ name: string; data: Uint8Array }> = [];
  const base = safeBaseName(file.name);

  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const rendered = await renderPage(page, format, Math.min(3, Math.max(0.75, scale)), quality);
      entries.push({
        name: `${base}-page-${String(pageNumber).padStart(3, '0')}.${format === 'png' ? 'png' : 'jpg'}`,
        data: new Uint8Array(await rendered.blob.arrayBuffer()),
      });
      page.cleanup();
      onProgress?.({ completed: pageNumber, total: document.numPages });
    }
  } finally {
    await document.destroy();
  }

  return { blob: createStoreOnlyZip(entries), pageCount: entries.length };
}

function pageText(content: Awaited<ReturnType<PDFPageProxy['getTextContent']>>) {
  let text = '';
  for (const item of content.items) {
    if (!('str' in item) || typeof item.str !== 'string') continue;
    text += item.str;
    text += 'hasEOL' in item && item.hasEOL ? '\n' : ' ';
  }
  return text.replace(/[ \t]+\n/g, '\n').replace(/[ \t]{2,}/g, ' ').trim();
}

export async function extractPdfText(file: File, onProgress?: ProgressHandler) {
  const document = await openPdf(file);
  const pages: string[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      pages.push(pageText(await page.getTextContent()));
      page.cleanup();
      onProgress?.({ completed: pageNumber, total: document.numPages });
    }
  } finally {
    await document.destroy();
  }

  const text = pages.join('\n\n\f\n\n').trim();
  if (!text) throw new Error('No selectable text was found. This PDF may require OCR.');
  return { text, pageCount: pages.length };
}

const COMPRESSION_SETTINGS: Record<PdfCompressionPreset, { scale: number; quality: number }> = {
  quality: { scale: 1.8, quality: 0.84 },
  balanced: { scale: 1.35, quality: 0.68 },
  small: { scale: 1, quality: 0.5 },
};

export async function compressPdf(
  file: File,
  preset: PdfCompressionPreset,
  onProgress?: ProgressHandler,
) {
  const source = await openPdf(file);
  const { PDFDocument } = await import('@pdfme/pdf-lib');
  const output = await PDFDocument.create();
  const settings = COMPRESSION_SETTINGS[preset];

  try {
    for (let pageNumber = 1; pageNumber <= source.numPages; pageNumber += 1) {
      const page = await source.getPage(pageNumber);
      const rendered = await renderPage(page, 'jpeg', settings.scale, settings.quality);
      const image = await output.embedJpg(await rendered.blob.arrayBuffer());
      const outputPage = output.addPage([rendered.pageWidth, rendered.pageHeight]);
      outputPage.drawImage(image, {
        x: 0,
        y: 0,
        width: rendered.pageWidth,
        height: rendered.pageHeight,
      });
      page.cleanup();
      onProgress?.({ completed: pageNumber, total: source.numPages });
    }
  } finally {
    await source.destroy();
  }

  output.setProducer('Tayar PDF Studio');
  output.setCreator('Tayar PDF Studio');
  output.setModificationDate(new Date());
  return bytesToBlob(
    await output.save({ useObjectStreams: true, addDefaultPage: false }),
    'application/pdf',
  );
}
