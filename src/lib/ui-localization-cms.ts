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
  'Integrations': 'التكاملات',
  'Connect analytics, payments, email, CRM, APIs and signed webhooks.': 'اربط التحليلات والمدفوعات والبريد الإلكتروني وإدارة علاقات العملاء وواجهات API وخطافات الويب الموقعة.',
  'Provider': 'المزوّد',
  'Add integration': 'إضافة تكامل',
  'active': 'نشط',
  'configuration issue': 'مشكلة في الإعداد',
  'configuration issues': 'مشكلات في الإعداد',
  'Enabled': 'مفعّل',
  'Name': 'الاسم',
  'Environments': 'البيئات',
  'Events': 'الأحداث',
  'Configured — enter to replace': 'تم الإعداد — أدخل قيمة للاستبدال',
  'Testing…': 'جارٍ الاختبار…',
  'Test connection': 'اختبار الاتصال',
  'Remove': 'إزالة',
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
  'Integrations': 'Integrationer',
  'Connect analytics, payments, email, CRM, APIs and signed webhooks.': 'Anslut analys, betalningar, e-post, CRM, API:er och signerade webhooks.',
  'Provider': 'Leverantör',
  'Add integration': 'Lägg till integration',
  'active': 'aktiva',
  'configuration issue': 'konfigurationsproblem',
  'configuration issues': 'konfigurationsproblem',
  'Enabled': 'Aktiverad',
  'Name': 'Namn',
  'Environments': 'Miljöer',
  'Events': 'Händelser',
  'Configured — enter to replace': 'Konfigurerad — ange ett värde för att ersätta',
  'Testing…': 'Testar…',
  'Test connection': 'Testa anslutning',
  'Remove': 'Ta bort',
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
