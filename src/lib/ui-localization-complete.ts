import { usePreferences } from '@/context/PreferencesContext';
import type { Language } from '@/lib/i18n';
import { localizeUi as localizeBaseUi } from './ui-localization';

type PhraseMap = Record<string, string>;

export const arSupplement: PhraseMap = {
  'Close menu': 'إغلاق القائمة',
  'Open menu': 'فتح القائمة',
  'unread': 'غير مقروء',
  'Current subscriptions by plan': 'الاشتراكات الحالية حسب الخطة',
  'Active · cancels at period end': 'نشط · يُلغى عند نهاية الفترة',
  'Billing / Access Date': 'تاريخ الفوترة / الوصول',
  'Only runtime-enforced platform settings are editable here.': 'يمكن هنا تعديل إعدادات المنصة التي تُطبَّق فعليًا أثناء التشغيل فقط.',
  'Authoritative controls': 'عناصر التحكم المعتمدة',
  'Tool access and quotas are managed in Tools. AI provider and model controls are managed in AI Management. Legacy settings that do not enforce runtime behavior are intentionally hidden here.': 'تتم إدارة الوصول إلى الأدوات وحدود الاستخدام من قسم Tools، بينما تتم إدارة مزود الذكاء الاصطناعي والنماذج من AI Management. تم إخفاء الإعدادات القديمة التي لا تؤثر فعليًا في سلوك النظام.',
  'API key inventory only': 'قائمة مفاتيح API فقط',
  'These rows are metadata and do not enable or disable the production secrets used by Edge Functions. Rotate or remove live secrets in Supabase project secrets.': 'هذه الصفوف بيانات وصفية فقط ولا تفعّل أو تعطّل أسرار الإنتاج التي تستخدمها Edge Functions. دوّر الأسرار الحية أو احذفها من أسرار مشروع Supabase.',
  'Read-only service metadata': 'بيانات وصفية للخدمات للقراءة فقط',
  'Failed to toggle tool': 'فشل تغيير حالة الأداة',
  'disabled': 'معطّل',
  'Failed to update tool plan': 'فشل تحديث خطة الأداة',
  'Failed to update usage limits': 'فشل تحديث حدود الاستخدام',
  'usage limits updated': 'تم تحديث حدود الاستخدام',
  'Tool plan access & limits': 'الوصول وحدود الاستخدام حسب الخطة',
  'Choose which plan can access each tool and how many successful uses Free, Pro and Business users can complete per day, month or lifetime. Leave a limit empty for unlimited use.': 'اختر الخطة التي يمكنها الوصول إلى كل أداة وحدد عدد الاستخدامات الناجحة المتاحة لمستخدمي Free وPro وBusiness يوميًا أو شهريًا أو مدى الحياة. اترك الحد فارغًا للاستخدام غير المحدود.',
  'Minimum plan': 'الحد الأدنى للخطة',
  'Reset period': 'فترة إعادة التعيين',
  'Daily': 'يومي',
  'Monthly': 'شهري',
  'Lifetime': 'مدى الحياة',
  'Unlimited': 'غير محدود',
  'recorded uses': 'استخدامات مسجلة',
  'Save limits': 'حفظ الحدود',
  'live quota': 'حد الاستخدام المباشر',
  'Processing...': 'جارٍ المعالجة...',
  'Change sort direction': 'تغيير اتجاه الفرز',
  'Grid view': 'عرض شبكي',
  'List view': 'عرض قائمة',
  'File actions': 'إجراءات الملف',
  'Payment completed. We are syncing your subscription now. Your plan will refresh automatically.': 'اكتملت عملية الدفع. نقوم الآن بمزامنة اشتراكك، وسيتم تحديث خطتك تلقائيًا.',
  'Checkout was canceled. No plan change was made.': 'تم إلغاء عملية الدفع. لم يتم تغيير خطتك.',
  'Account menu': 'قائمة الحساب',
  'Could not clean this file.': 'تعذر تنظيف هذا الملف.',
  'Could not create invoice output.': 'تعذر إنشاء مخرجات الفاتورة.',
  'Could not generate this letter.': 'تعذر إنشاء هذا الخطاب.',
  'Could not generate names.': 'تعذر إنشاء الأسماء.',
  'Checking access...': 'جارٍ التحقق من الوصول...',
  'Access check unavailable': 'تعذر التحقق من الوصول',
  'We could not safely verify your plan. Please retry in a moment.': 'تعذر التحقق من خطتك بأمان. يرجى المحاولة مرة أخرى بعد قليل.',
  'Tool temporarily unavailable': 'الأداة غير متاحة مؤقتًا',
  'This tool has been disabled by the administrator.': 'تم تعطيل هذه الأداة بواسطة المسؤول.',
  'Usage limit reached': 'تم بلوغ حد الاستخدام',
  'View plans': 'عرض الخطط',
  'Website published successfully. Release history was skipped:': 'تم نشر الموقع بنجاح. تم تخطي سجل الإصدارات:',
};

export const svSupplement: PhraseMap = {
  'Close menu': 'Stäng meny',
  'Open menu': 'Öppna meny',
  'unread': 'olästa',
  'Current subscriptions by plan': 'Aktuella prenumerationer per plan',
  'Active · cancels at period end': 'Aktiv · avslutas vid periodens slut',
  'Billing / Access Date': 'Fakturerings-/åtkomstdatum',
  'Only runtime-enforced platform settings are editable here.': 'Endast plattformsinställningar som faktiskt upprätthålls vid körning kan redigeras här.',
  'Authoritative controls': 'Styrande kontroller',
  'Tool access and quotas are managed in Tools. AI provider and model controls are managed in AI Management. Legacy settings that do not enforce runtime behavior are intentionally hidden here.': 'Verktygsåtkomst och användningsgränser hanteras i Tools. AI-leverantör och modellkontroller hanteras i AI Management. Äldre inställningar som inte påverkar körningen är avsiktligt dolda här.',
  'API key inventory only': 'Endast API-nyckelinventering',
  'These rows are metadata and do not enable or disable the production secrets used by Edge Functions. Rotate or remove live secrets in Supabase project secrets.': 'Dessa rader är endast metadata och aktiverar eller inaktiverar inte produktionshemligheterna som används av Edge Functions. Rotera eller ta bort aktiva hemligheter i Supabase-projektets secrets.',
  'Read-only service metadata': 'Skrivskyddad tjänstemetadata',
  'Failed to toggle tool': 'Det gick inte att ändra verktygets status',
  'disabled': 'inaktiverad',
  'Failed to update tool plan': 'Det gick inte att uppdatera verktygets plan',
  'Failed to update usage limits': 'Det gick inte att uppdatera användningsgränserna',
  'usage limits updated': 'användningsgränserna uppdaterades',
  'Tool plan access & limits': 'Verktygsåtkomst och gränser per plan',
  'Choose which plan can access each tool and how many successful uses Free, Pro and Business users can complete per day, month or lifetime. Leave a limit empty for unlimited use.': 'Välj vilken plan som får använda varje verktyg och hur många lyckade användningar Free-, Pro- och Business-användare kan göra per dag, månad eller under hela livstiden. Lämna en gräns tom för obegränsad användning.',
  'Minimum plan': 'Lägsta plan',
  'Reset period': 'Återställningsperiod',
  'Daily': 'Daglig',
  'Monthly': 'Månadsvis',
  'Lifetime': 'Livstid',
  'Unlimited': 'Obegränsat',
  'recorded uses': 'registrerade användningar',
  'Save limits': 'Spara gränser',
  'live quota': 'livekvot',
  'Processing...': 'Bearbetar...',
  'Change sort direction': 'Ändra sorteringsriktning',
  'Grid view': 'Rutnätsvy',
  'List view': 'Listvy',
  'File actions': 'Filåtgärder',
  'Payment completed. We are syncing your subscription now. Your plan will refresh automatically.': 'Betalningen är klar. Vi synkroniserar din prenumeration nu. Din plan uppdateras automatiskt.',
  'Checkout was canceled. No plan change was made.': 'Kassan avbröts. Ingen planändring gjordes.',
  'Account menu': 'Kontomeny',
  'Could not clean this file.': 'Kunde inte rensa den här filen.',
  'Could not create invoice output.': 'Kunde inte skapa fakturautdata.',
  'Could not generate this letter.': 'Kunde inte skapa det här brevet.',
  'Could not generate names.': 'Kunde inte generera namn.',
  'Checking access...': 'Kontrollerar åtkomst...',
  'Access check unavailable': 'Åtkomstkontroll är inte tillgänglig',
  'We could not safely verify your plan. Please retry in a moment.': 'Vi kunde inte verifiera din plan på ett säkert sätt. Försök igen om en stund.',
  'Tool temporarily unavailable': 'Verktyget är tillfälligt otillgängligt',
  'This tool has been disabled by the administrator.': 'Det här verktyget har inaktiverats av administratören.',
  'Usage limit reached': 'Användningsgränsen har nåtts',
  'View plans': 'Visa planer',
  'Website published successfully. Release history was skipped:': 'Webbplatsen publicerades. Versionshistoriken hoppades över:',
};

const supplementalMaps: Record<Language, PhraseMap> = { en: {}, ar: arSupplement, sv: svSupplement };

export function localizeUi(text: string, language: Language): string {
  if (language === 'en') return text;
  return supplementalMaps[language][text] ?? localizeBaseUi(text, language);
}

export function useLocalizer() {
  const { prefs } = usePreferences();
  return (text: string) => localizeUi(text, prefs.language);
}
