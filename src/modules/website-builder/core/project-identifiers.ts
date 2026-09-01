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

export const PAGE_LANGUAGE_LABELS: Record<Language, string> = {
  en: 'English',
  sv: 'Svenska',
  ar: 'العربية',
};

export function languageCodeLabel(language: Language): string {
  return language.toUpperCase();
}
