import { useCallback } from 'react';
import { usePreferences } from '@/context/PreferencesContext';
import type { Language } from '@/lib/i18n';
import { localizeUi as localizeBaseUi } from './ui-localization';

type PhraseMap = Record<string, string>;

export const arCmsSupplement: PhraseMap = {
  'Referenced by': 'مُشار إليه من',
  'Collection settings': 'إعدادات المجموعة',
  'Collection slug': 'مسار المجموعة',
  'Entry slug field': 'حقل مسار الإدخال',
  'Referenced collection': 'المجموعة المرتبطة',
  'Duplicate entry': 'نسخ الإدخال',
  'This entry is referenced by other CMS content': 'هذا الإدخال مرتبط بمحتوى CMS آخر',
  'Matching published entries': 'الإدخالات المنشورة المطابقة',
  'Remove filter': 'إزالة الفلتر',
  'Add filter': 'إضافة فلتر',
};

export const svCmsSupplement: PhraseMap = {
  'Referenced by': 'Refereras av',
  'Collection settings': 'Samlingsinställningar',
  'Collection slug': 'Samlingsslug',
  'Entry slug field': 'Slugfält för post',
  'Referenced collection': 'Refererad samling',
  'Duplicate entry': 'Duplicera post',
  'This entry is referenced by other CMS content': 'Den här posten refereras av annat CMS-innehåll',
  'Matching published entries': 'Matchande publicerade poster',
  'Remove filter': 'Ta bort filter',
  'Add filter': 'Lägg till filter',
};

const cmsMaps: Record<Language, PhraseMap> = {
  en: {},
  ar: arCmsSupplement,
  sv: svCmsSupplement,
};

export function localizeUi(text: string, language: Language): string {
  if (language === 'en') return text;
  return cmsMaps[language][text] ?? localizeBaseUi(text, language);
}

export function useLocalizer() {
  const { prefs } = usePreferences();
  const language = prefs.language;
  return useCallback((text: string) => localizeUi(text, language), [language]);
}
