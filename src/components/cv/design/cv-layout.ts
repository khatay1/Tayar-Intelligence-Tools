export type CVPageSize = 'a4' | 'letter';
export type CVColumnLayout = 'single' | 'sidebar-left' | 'sidebar-right';
export type CVSpacingDensity = 'compact' | 'comfortable' | 'spacious';

export interface CVLayoutSettings {
  pageSize: CVPageSize;
  columns: CVColumnLayout;
  density: CVSpacingDensity;
  pageMarginMm: number;
  sectionGapMm: number;
  lineHeight: number;
  baseFontSizePt: number;
  sidebarWidthPercent: number;
  showDividers: boolean;
}

export const DEFAULT_CV_LAYOUT: CVLayoutSettings = {
  pageSize: 'a4',
  columns: 'single',
  density: 'comfortable',
  pageMarginMm: 14,
  sectionGapMm: 5,
  lineHeight: 1.35,
  baseFontSizePt: 10.5,
  sidebarWidthPercent: 32,
  showDividers: true,
};

const PAGE_DIMENSIONS_MM: Record<CVPageSize, { width: number; height: number }> = {
  a4: { width: 210, height: 297 },
  letter: { width: 215.9, height: 279.4 },
};

export function normalizeCVLayout(value?: Partial<CVLayoutSettings> | null): CVLayoutSettings {
  const next = { ...DEFAULT_CV_LAYOUT, ...(value ?? {}) };
  return {
    ...next,
    pageMarginMm: Math.min(30, Math.max(6, next.pageMarginMm)),
    sectionGapMm: Math.min(14, Math.max(1, next.sectionGapMm)),
    lineHeight: Math.min(1.8, Math.max(1.05, next.lineHeight)),
    baseFontSizePt: Math.min(14, Math.max(8, next.baseFontSizePt)),
    sidebarWidthPercent: Math.min(45, Math.max(25, next.sidebarWidthPercent)),
  };
}

export function getCVPageDimensions(pageSize: CVPageSize) {
  return PAGE_DIMENSIONS_MM[pageSize];
}

export function getCVContentHeightMm(layout: CVLayoutSettings): number {
  return PAGE_DIMENSIONS_MM[layout.pageSize].height - layout.pageMarginMm * 2;
}
