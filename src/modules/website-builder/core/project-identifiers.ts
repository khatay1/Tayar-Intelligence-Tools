import type { Language } from '@/context/PreferencesContext';

export function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'page';
}

export function normalizePageLanguage(
  value: unknown,
  fallback: Language = 'en',
): Language {
  return value === 'ar' || value === 'sv' || value === 'en'
    ? value
    : fallback;
}
