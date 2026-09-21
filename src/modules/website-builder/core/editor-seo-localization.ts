import type { Language } from '@/lib/i18n';

const arSeoPhrases: Record<string, string> = {
  'Page SEO': 'تحسين SEO للصفحة',
  'Search, social sharing and structured data': 'البحث والمشاركة الاجتماعية والبيانات المنظمة',
  'SEO title': 'عنوان SEO', 'Meta description': 'وصف Meta', 'Canonical URL': 'الرابط الأساسي Canonical',
  'Open Graph title': 'عنوان Open Graph', 'Open Graph description': 'وصف Open Graph', 'Open Graph image': 'صورة Open Graph',
  'Schema type': 'نوع Schema', 'Twitter card': 'بطاقة Twitter', 'Large image': 'صورة كبيرة', 'Summary': 'ملخص',
  'Prevent search indexing': 'منع فهرسة محركات البحث', 'Do not follow links': 'عدم تتبع الروابط', 'Save SEO': 'حفظ SEO',
  'recommended': 'موصى به',
};
const svSeoPhrases: Record<string, string> = {
  'Page SEO': 'Sid-SEO',
  'Search, social sharing and structured data': 'Sök, social delning och strukturerad data',
  'SEO title': 'SEO-titel', 'Meta description': 'Metabeskrivning', 'Canonical URL': 'Canonical-URL',
  'Open Graph title': 'Open Graph-titel', 'Open Graph description': 'Open Graph-beskrivning', 'Open Graph image': 'Open Graph-bild',
  'Schema type': 'Schema-typ', 'Twitter card': 'Twitter-kort', 'Large image': 'Stor bild', 'Summary': 'Sammanfattning',
  'Prevent search indexing': 'Förhindra sökindexering', 'Do not follow links': 'Följ inte länkar', 'Save SEO': 'Spara SEO',
  'recommended': 'rekommenderat',
};

export function localizeEditorSeo(text: string, language: Language): string {
  if (language === 'ar') return arSeoPhrases[text] ?? text;
  if (language === 'sv') return svSeoPhrases[text] ?? text;
  return text;
}
