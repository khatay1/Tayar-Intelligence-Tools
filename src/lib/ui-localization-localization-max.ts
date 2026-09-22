import { useCallback } from 'react';
import { usePreferences } from '@/context/PreferencesContext';
import type { Language } from '@/lib/i18n';
import { localizeUi as localizeBaseUi } from './ui-localization';

type PhraseMap = Record<string, string>;

export const arLocalizationMaxSupplement: PhraseMap = {
  'Manage multilingual content, routes, SEO, RTL and locale domains.': 'إدارة المحتوى متعدد اللغات والمسارات وتحسين محركات البحث واتجاه RTL ونطاقات اللغات.',
  'Editing language': 'لغة التحرير',
  'Direction': 'اتجاه الكتابة',
  'Fallback language': 'اللغة الاحتياطية',
  'Locale path prefix': 'بادئة مسار اللغة',
  'Subdomain': 'النطاق الفرعي',
  'Localized page name': 'اسم الصفحة المترجم',
  'Localized slug': 'المسار المترجم',
  'Translating…': 'جارٍ الترجمة…',
  'Translate page with AI': 'ترجمة الصفحة بالذكاء الاصطناعي',
};

export const svLocalizationMaxSupplement: PhraseMap = {
  'Manage multilingual content, routes, SEO, RTL and locale domains.': 'Hantera flerspråkigt innehåll, rutter, SEO, RTL och språkdomäner.',
  'Editing language': 'Redigeringsspråk',
  'Direction': 'Skrivriktning',
  'Fallback language': 'Reservspråk',
  'Locale path prefix': 'Sökvägsprefix för språk',
  'Subdomain': 'Underdomän',
  'Localized page name': 'Lokaliserat sidnamn',
  'Localized slug': 'Lokaliserad slug',
  'Translating…': 'Översätter…',
  'Translate page with AI': 'Översätt sidan med AI',
};

const localizationMaxMaps: Record<Language, PhraseMap> = {
  en: {},
  ar: arLocalizationMaxSupplement,
  sv: svLocalizationMaxSupplement,
};

export function localizeUi(text: string, language: Language): string {
  if (language === 'en') return text;
  return localizationMaxMaps[language][text] ?? localizeBaseUi(text, language);
}

export function useLocalizer() {
  const { prefs } = usePreferences();
  const language = prefs.language;
  return useCallback((text: string) => localizeUi(text, language), [language]);
}
