import { useCallback } from 'react';
import { usePreferences } from '@/context/PreferencesContext';

const ar: Record<string, string> = {
  'Variant name': 'اسم المتغير',
  'Variant': 'متغير',
  'variant groups': 'مجموعات المتغيرات',
  'unused': 'غير مستخدمة',
  'Create variant': 'إنشاء متغير',
  'VAR': 'متغير',
  'Component details': 'تفاصيل المكوّن',
  'INFO': 'معلومات',
  'Tags': 'الوسوم',
  'Comma-separated tags': 'وسوم مفصولة بفواصل',
  'Save details': 'حفظ التفاصيل',
};

const sv: Record<string, string> = {
  'Variant name': 'Variantnamn',
  'Variant': 'Variant',
  'variant groups': 'variantgrupper',
  'unused': 'oanvända',
  'Create variant': 'Skapa variant',
  'VAR': 'VAR',
  'Component details': 'Komponentdetaljer',
  'INFO': 'INFO',
  'Tags': 'Taggar',
  'Comma-separated tags': 'Kommaseparerade taggar',
  'Save details': 'Spara detaljer',
};

export function useBuilderComponentsLocalizer() {
  const { prefs } = usePreferences();
  const language = prefs.language;
  return useCallback((text: string) => {
    if (language === 'ar') return ar[text] ?? text;
    if (language === 'sv') return sv[text] ?? text;
    return text;
  }, [language]);
}
