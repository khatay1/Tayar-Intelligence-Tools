import type { Language } from '@/lib/i18n';

const arSiteQuality: Record<string, string> = {
  'Site Quality': 'جودة الموقع', 'SEO, accessibility, links and performance': 'تحسين محركات البحث وإمكانية الوصول والروابط والأداء',
  'Accessibility': 'إمكانية الوصول', 'Links': 'الروابط', 'Performance': 'الأداء', 'All': 'الكل', 'errors': 'أخطاء', 'warnings': 'تحذيرات', 'suggestions': 'اقتراحات',
  'Fix with AI': 'إصلاح بالذكاء الاصطناعي', 'AI fix': 'إصلاح AI', 'No issues in this category.': 'لا توجد مشاكل في هذا التصنيف.',
  'Missing SEO title': 'عنوان SEO مفقود', 'SEO title is longer than 60 characters': 'عنوان SEO أطول من 60 حرفًا', 'Missing meta description': 'وصف Meta مفقود',
  'Meta description is longer than 160 characters': 'وصف Meta أطول من 160 حرفًا', 'Canonical URL is not configured': 'الرابط الأساسي Canonical غير مضبوط',
  'Open Graph image is not configured': 'صورة Open Graph غير مضبوطة', 'Duplicate page slug': 'مسار صفحة مكرر', 'Page has no H1 heading': 'الصفحة لا تحتوي عنوان H1',
  'Page has multiple H1 headings': 'الصفحة تحتوي عدة عناوين H1', 'Image is missing alternative text': 'الصورة تفتقد النص البديل',
  'Image is not marked for lazy loading': 'الصورة غير مضبوطة للتحميل الكسول', 'Unsafe link URL': 'رابط غير آمن', 'Link target is empty': 'هدف الرابط فارغ',
  'Internal link does not match a page': 'الرابط الداخلي لا يطابق صفحة', 'Interactive element has no accessible name': 'العنصر التفاعلي لا يحتوي اسمًا متاحًا',
};
const svSiteQuality: Record<string, string> = {
  'Site Quality': 'Webbplatskvalitet', 'SEO, accessibility, links and performance': 'SEO, tillgänglighet, länkar och prestanda',
  'Accessibility': 'Tillgänglighet', 'Links': 'Länkar', 'Performance': 'Prestanda', 'All': 'Alla', 'errors': 'fel', 'warnings': 'varningar', 'suggestions': 'förslag',
  'Fix with AI': 'Åtgärda med AI', 'AI fix': 'AI-åtgärd', 'No issues in this category.': 'Inga problem i den här kategorin.',
  'Missing SEO title': 'SEO-titel saknas', 'SEO title is longer than 60 characters': 'SEO-titeln är längre än 60 tecken', 'Missing meta description': 'Metabeskrivning saknas',
  'Meta description is longer than 160 characters': 'Metabeskrivningen är längre än 160 tecken', 'Canonical URL is not configured': 'Canonical-URL är inte konfigurerad',
  'Open Graph image is not configured': 'Open Graph-bild är inte konfigurerad', 'Duplicate page slug': 'Duplicerad sid-slug', 'Page has no H1 heading': 'Sidan saknar H1-rubrik',
  'Page has multiple H1 headings': 'Sidan har flera H1-rubriker', 'Image is missing alternative text': 'Bilden saknar alternativtext',
  'Image is not marked for lazy loading': 'Bilden är inte markerad för lazy loading', 'Unsafe link URL': 'Osäker länk-URL', 'Link target is empty': 'Länkmålet är tomt',
  'Internal link does not match a page': 'Intern länk matchar ingen sida', 'Interactive element has no accessible name': 'Interaktivt element saknar tillgängligt namn',
};

export function localizeSiteQuality(text: string, language: Language): string {
  if (language === 'ar') return arSiteQuality[text] ?? text;
  if (language === 'sv') return svSiteQuality[text] ?? text;
  return text;
}
