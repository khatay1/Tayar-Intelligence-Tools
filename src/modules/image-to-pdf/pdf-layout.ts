import {
  MAX_PDF_PAGE_POINTS,
  PdfImageOptions,
  PdfImagePage,
} from './pdf-types';

const PAGE_SIZES = {
  a4: { width: 595.28, height: 841.89 },
  letter: { width: 612, height: 792 },
} as const;

function clampPagePoint(value: number) {
  return Math.max(1, Math.min(MAX_PDF_PAGE_POINTS, value));
}

export function createPdfPageLayout(
  jpeg: Uint8Array,
  widthPx: number,
  heightPx: number,
  options: PdfImageOptions,
): PdfImagePage {
  if (widthPx < 1 || heightPx < 1) throw new Error('Image dimensions are invalid.');

  if (options.pageSize === 'auto') {
    const pageWidthPt = clampPagePoint(widthPx * 0.75);
    const pageHeightPt = clampPagePoint(heightPx * 0.75);
    const scale = Math.min(pageWidthPt / widthPx, pageHeightPt / heightPx);

    return {
      jpeg,
      widthPx,
      heightPx,
      pageWidthPt,
      pageHeightPt,
      drawWidthPt: widthPx * scale,
      drawHeightPt: heightPx * scale,
      drawXPt: 0,
      drawYPt: 0,
    };
  }

  const base = PAGE_SIZES[options.pageSize];
  const landscape = widthPx > heightPx;
  const pageWidthPt = landscape ? base.height : base.width;
  const pageHeightPt = landscape ? base.width : base.height;
  const margin = Math.max(0, Math.min(72, options.marginPt));
  const availableWidth = Math.max(1, pageWidthPt - margin * 2);
  const availableHeight = Math.max(1, pageHeightPt - margin * 2);
  const scale = Math.min(availableWidth / widthPx, availableHeight / heightPx);
  const drawWidthPt = widthPx * scale;
  const drawHeightPt = heightPx * scale;

  return {
    jpeg,
    widthPx,
    heightPx,
    pageWidthPt,
    pageHeightPt,
    drawWidthPt,
    drawHeightPt,
    drawXPt: (pageWidthPt - drawWidthPt) / 2,
    drawYPt: (pageHeightPt - drawHeightPt) / 2,
  };
}
