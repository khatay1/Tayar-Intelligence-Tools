import { useCallback } from 'react';
import { usePreferences } from '@/context/PreferencesContext';
import type { Language } from '@/lib/i18n';
import { localizeUi as localizeBaseUi } from './ui-localization';

type PhraseMap = Record<string, string>;

export const arWorkspaceSupplement: PhraseMap = {
  'Search tools...': 'ابحث عن الأدوات...',
  'Clear search': 'مسح البحث',
  'Ungroup container': 'فك تجميع الحاوية',
  'Code Assistant': 'مساعد البرمجة',
  'Build, inspect, adapt, and reuse UI components with AI-assisted workflows.': 'أنشئ مكونات واجهة المستخدم وافحصها وكيّفها وأعد استخدامها عبر مسارات عمل مدعومة بالذكاء الاصطناعي.',
  'Remove image backgrounds privately with local in-browser AI. Image pixels stay on the user’s device.': 'أزل خلفيات الصور بخصوصية عبر ذكاء اصطناعي محلي داخل المتصفح؛ تبقى بكسلات الصورة على جهاز المستخدم.',
  'Profile CSV data locally and turn statistics into AI business insights.': 'حلّل بيانات CSV محلياً وحوّل الإحصاءات إلى رؤى أعمال بالذكاء الاصطناعي.',
  'Organize, edit, convert and optimize PDF files locally with 16 focused tools.': 'نظّم ملفات PDF وعدّلها وحوّلها وحسّنها محلياً باستخدام 16 أداة متخصصة.',
  'Invite teammates, manage roles and collaborate on shared projects.': 'ادعُ زملاء الفريق وأدر الأدوار وتعاون في المشاريع المشتركة.',
  'Build, operate, audit and publish production-ready websites.': 'أنشئ مواقع جاهزة للإنتاج وشغّلها ودقّقها وانشرها.',
  'Create a CV': 'إنشاء سيرة ذاتية',
  'Build a professional resume with AI assistance': 'أنشئ سيرة ذاتية احترافية بمساعدة الذكاء الاصطناعي',
  'Write a Cover Letter': 'كتابة خطاب تغطية',
  'Generate a tailored cover letter for any job': 'أنشئ خطاب تغطية مخصصاً لأي وظيفة',
  'Analyze a PDF': 'تحليل ملف PDF',
  'Upload and analyze any document with AI': 'ارفع أي مستند وحلّله بالذكاء الاصطناعي',
  'Translate Text': 'ترجمة نص',
  'Translate between any languages': 'ترجم بين أي لغات',
  'Write with AI': 'الكتابة بالذكاء الاصطناعي',
  'Generate any written content with AI': 'أنشئ أي محتوى مكتوب بالذكاء الاصطناعي',
  'Get help with study materials and notes': 'احصل على مساعدة في المواد الدراسية والملاحظات',
  'Improve My Resume': 'تحسين سيرتي الذاتية',
  'Optimize your CV for ATS and recruiters': 'حسّن سيرتك الذاتية لأنظمة ATS ومسؤولي التوظيف',
  'Summarize My Document': 'تلخيص مستندي',
  'Get a concise summary of any document': 'احصل على ملخص موجز لأي مستند',
  'Projects could not be loaded. Tool results are still available.': 'تعذر تحميل المشاريع، لكن نتائج الأدوات ما زالت متاحة.',
};

export const svWorkspaceSupplement: PhraseMap = {
  'Search tools...': 'Sök verktyg...',
  'Clear search': 'Rensa sökning',
  'Ungroup container': 'Dela upp behållare',
  'Code Assistant': 'Kodassistent',
  'Build, inspect, adapt, and reuse UI components with AI-assisted workflows.': 'Bygg, granska, anpassa och återanvänd gränssnittskomponenter med AI-stödda arbetsflöden.',
  'Remove image backgrounds privately with local in-browser AI. Image pixels stay on the user’s device.': 'Ta bort bildbakgrunder privat med lokal AI i webbläsaren. Bildpixlarna stannar på användarens enhet.',
  'Profile CSV data locally and turn statistics into AI business insights.': 'Profilera CSV-data lokalt och omvandla statistik till affärsinsikter med AI.',
  'Organize, edit, convert and optimize PDF files locally with 16 focused tools.': 'Organisera, redigera, konvertera och optimera PDF-filer lokalt med 16 fokuserade verktyg.',
  'Invite teammates, manage roles and collaborate on shared projects.': 'Bjud in kollegor, hantera roller och samarbeta i delade projekt.',
  'Build, operate, audit and publish production-ready websites.': 'Bygg, hantera, granska och publicera produktionsklara webbplatser.',
  'Create a CV': 'Skapa ett CV',
  'Build a professional resume with AI assistance': 'Skapa ett professionellt CV med AI-hjälp',
  'Write a Cover Letter': 'Skriv ett personligt brev',
  'Generate a tailored cover letter for any job': 'Skapa ett anpassat personligt brev för valfritt jobb',
  'Analyze a PDF': 'Analysera en PDF',
  'Upload and analyze any document with AI': 'Ladda upp och analysera valfritt dokument med AI',
  'Translate Text': 'Översätt text',
  'Translate between any languages': 'Översätt mellan valfria språk',
  'Write with AI': 'Skriv med AI',
  'Generate any written content with AI': 'Skapa valfritt skriftligt innehåll med AI',
  'Get help with study materials and notes': 'Få hjälp med studiematerial och anteckningar',
  'Improve My Resume': 'Förbättra mitt CV',
  'Optimize your CV for ATS and recruiters': 'Optimera ditt CV för ATS och rekryterare',
  'Summarize My Document': 'Sammanfatta mitt dokument',
  'Get a concise summary of any document': 'Få en kort sammanfattning av valfritt dokument',
  'Projects could not be loaded. Tool results are still available.': 'Projekt kunde inte läsas in. Verktygsresultaten är fortfarande tillgängliga.',
};

const workspaceMaps: Record<Language, PhraseMap> = {
  en: {},
  ar: arWorkspaceSupplement,
  sv: svWorkspaceSupplement,
};

export function localizeUi(text: string, language: Language): string {
  if (language === 'en') return text;
  return workspaceMaps[language][text] ?? localizeBaseUi(text, language);
}

export function useLocalizer() {
  const { prefs } = usePreferences();
  const language = prefs.language;
  return useCallback((text: string) => localizeUi(text, language), [language]);
}
