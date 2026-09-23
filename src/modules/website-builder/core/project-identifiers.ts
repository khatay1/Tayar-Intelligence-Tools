import type { Language } from '@/context/PreferencesContext';

export function normalizeSlug(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
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
