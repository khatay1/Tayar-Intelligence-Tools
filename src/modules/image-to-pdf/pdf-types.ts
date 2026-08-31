export type PdfPageSize = 'auto' | 'a4' | 'letter';

export interface PdfImageOptions {
  pageSize: PdfPageSize;
  marginPt: number;
  jpegQuality: number;
}

export interface PdfImagePage {
  jpeg: Uint8Array;
  widthPx: number;
  heightPx: number;
  pageWidthPt: number;
  pageHeightPt: number;
  drawWidthPt: number;
  drawHeightPt: number;
  drawXPt: number;
  drawYPt: number;
}

export const MAX_PDF_IMAGES = 20;
export const MAX_PDF_INPUT_BYTES = 80 * 1024 * 1024;
export const MAX_PDF_OUTPUT_BYTES = 120 * 1024 * 1024;
export const MAX_PDF_PAGE_POINTS = 10_000;
