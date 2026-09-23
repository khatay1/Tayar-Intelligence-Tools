export const CV_AUTOSAVE_DELAY_MS = 1200;
export const CV_PREVIEW_DEFER_MS = 80;
export const CV_MAX_HISTORY_ENTRIES = 50;

export function shouldDeferCVPreview(lastRenderAt: number, now = Date.now()): boolean {
  return now - lastRenderAt < CV_PREVIEW_DEFER_MS;
}

export function stableCVRevisionKey(cvId: string | null, updatedAt: string | null, localRevision: number): string {
  return `${cvId ?? 'new'}:${updatedAt ?? 'local'}:${localRevision}`;
}

export function capCVCollection<T>(items: T[], max: number): T[] {
  if (max <= 0) return [];
  return items.length > max ? items.slice(0, max) : items;
}
