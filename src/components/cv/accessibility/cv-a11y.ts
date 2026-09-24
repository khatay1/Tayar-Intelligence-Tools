export interface CVAccessibilityPreferences {
  reducedMotion: boolean;
  highContrast: boolean;
  previewZoom: number;
}

export const DEFAULT_CV_A11Y: CVAccessibilityPreferences = {
  reducedMotion: false,
  highContrast: false,
  previewZoom: 1,
};

export function normalizeCVPreviewZoom(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(2, Math.max(0.5, value));
}

export function cvSectionAriaLabel(title: string, itemCount?: number): string {
  const clean = title.trim() || 'CV section';
  return typeof itemCount === 'number' ? `${clean}, ${itemCount} items` : clean;
}

export function cvSaveStatusAnnouncement(status: string): string {
  if (status === 'saving') return 'Saving CV';
  if (status === 'saved') return 'CV saved';
  if (status === 'error') return 'CV save failed';
  return '';
}
