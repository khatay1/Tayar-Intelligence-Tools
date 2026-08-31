import { validateImageFile } from '../image-tools/image-processing';
import { encodeFileAsJpeg } from './jpeg-encoder';
import { createPdfPageLayout } from './pdf-layout';
import { buildImagePdf } from './simple-pdf-writer';
import {
  MAX_PDF_IMAGES,
  MAX_PDF_INPUT_BYTES,
  MAX_PDF_OUTPUT_BYTES,
  PdfImageOptions,
} from './pdf-types';

export function validatePdfImages(files: File[]) {
  if (!files.length) throw new Error('Choose at least one image.');
  if (files.length > MAX_PDF_IMAGES) {
    throw new Error(`Choose no more than ${MAX_PDF_IMAGES} images.`);
  }

  let total = 0;
  for (const file of files) {
    validateImageFile(file);
    total += file.size;
  }

  if (total > MAX_PDF_INPUT_BYTES) {
    throw new Error('Combined source files exceed the 80 MB limit.');
  }
}

export async function imagesToPdf(
  files: File[],
  options: PdfImageOptions,
  onProgress?: (completed: number, total: number) => void,
) {
  validatePdfImages(files);

  const pages = [];
  let encodedBytes = 0;

  for (let index = 0; index < files.length; index += 1) {
    const encoded = await encodeFileAsJpeg(files[index], options.jpegQuality);
    encodedBytes += encoded.jpeg.byteLength;

    if (encodedBytes > MAX_PDF_OUTPUT_BYTES) {
      throw new Error('Encoded images exceed the 120 MB PDF safety limit.');
    }

    pages.push(
      createPdfPageLayout(
        encoded.jpeg,
        encoded.width,
        encoded.height,
        options,
      ),
    );

    onProgress?.(index + 1, files.length);
  }

  const pdf = buildImagePdf(pages);
  if (pdf.size > MAX_PDF_OUTPUT_BYTES) {
    throw new Error('Generated PDF exceeds the 120 MB safety limit.');
  }
  return pdf;
}

export function downloadPdf(blob: Blob, filename = 'tayar-images.pdf') {
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
