import type { Language } from '@/lib/i18n';

const ar: Record<string, string> = {
  'Website templates': 'قوالب المواقع', 'Sections, pages and complete sites ready to insert.': 'أقسام وصفحات ومواقع كاملة جاهزة للإدراج.',
  'Search templates': 'البحث في القوالب', 'Template type': 'نوع القالب', 'Category': 'التصنيف', 'All': 'الكل', 'Sections': 'الأقسام', 'Pages': 'الصفحات', 'Sites': 'المواقع',
  'All categories': 'كل التصنيفات', 'Business': 'أعمال', 'SaaS': 'برمجيات كخدمة', 'Portfolio': 'معرض أعمال', 'Commerce': 'تجارة', 'Content': 'محتوى', 'Launch': 'إطلاق',
  'Featured': 'مميز', 'Preview': 'معاينة', 'Insert': 'إدراج', 'Customize with AI': 'تخصيص بالذكاء الاصطناعي', 'No templates found': 'لم يتم العثور على قوالب',
  'Conversion Hero': 'واجهة تحويل رئيسية', 'Features + Proof': 'المزايا والإثبات', 'Pricing Conversion': 'تسعير للتحويل', 'Lead Contact': 'تواصل للعملاء المحتملين',
  'SaaS Landing Page': 'صفحة هبوط SaaS', 'Business Homepage': 'صفحة أعمال رئيسية', 'Portfolio Homepage': 'صفحة معرض أعمال', 'Product Launch': 'إطلاق منتج',
  'Service Business Site': 'موقع أعمال خدمية', 'SaaS Product Site': 'موقع منتج SaaS', 'Commerce Brand Site': 'موقع علامة تجارية', 'Content Publisher': 'موقع نشر محتوى',
  'Hero with a focused value proposition and primary action.': 'واجهة رئيسية بعرض قيمة واضح وإجراء أساسي.',
  'Feature grid with supporting proof and trust content.': 'شبكة مزايا مع إثباتات ومحتوى يعزز الثقة.',
  'Pricing block prepared for clear plan comparison.': 'قسم تسعير مجهز لمقارنة الخطط بوضوح.',
  'Contact section focused on qualified lead capture.': 'قسم تواصل يركز على جمع العملاء المحتملين المؤهلين.',
  'Complete SaaS landing flow from hero through pricing and contact.': 'صفحة هبوط SaaS متكاملة من الواجهة الرئيسية حتى التسعير والتواصل.',
  'Professional homepage for services and local businesses.': 'صفحة رئيسية احترافية للخدمات والأعمال المحلية.',
  'Portfolio-focused page with work, story and contact flow.': 'صفحة تركز على الأعمال والقصة ومسار التواصل.',
  'Launch page with benefits, social proof and countdown-ready content.': 'صفحة إطلاق بالمزايا والإثبات الاجتماعي ومحتوى جاهز للعد التنازلي.',
  'Multi-page starter structure for a service business.': 'هيكل متعدد الصفحات جاهز لأعمال الخدمات.',
  'Multi-page SaaS structure for product, pricing and company content.': 'هيكل SaaS متعدد الصفحات للمنتج والتسعير ومحتوى الشركة.',
  'Brand-led commerce structure prepared for product storytelling.': 'هيكل تجارة تقوده العلامة التجارية ومجهز لعرض قصة المنتجات.',
  'Content-first site structure prepared for dynamic CMS expansion.': 'هيكل موقع يركز على المحتوى ومجهز للتوسع عبر CMS ديناميكي.',
};

const sv: Record<string, string> = {
  'Website templates': 'Webbplatsmallar', 'Sections, pages and complete sites ready to insert.': 'Sektioner, sidor och kompletta webbplatser redo att infogas.',
  'Search templates': 'Sök mallar', 'Template type': 'Malltyp', 'Category': 'Kategori', 'All': 'Alla', 'Sections': 'Sektioner', 'Pages': 'Sidor', 'Sites': 'Webbplatser',
  'All categories': 'Alla kategorier', 'Business': 'Företag', 'SaaS': 'SaaS', 'Portfolio': 'Portfolio', 'Commerce': 'E-handel', 'Content': 'Innehåll', 'Launch': 'Lansering',
  'Featured': 'Utvald', 'Preview': 'Förhandsgranska', 'Insert': 'Infoga', 'Customize with AI': 'Anpassa med AI', 'No templates found': 'Inga mallar hittades',
  'Conversion Hero': 'Konverterande hero', 'Features + Proof': 'Funktioner + bevis', 'Pricing Conversion': 'Konverterande prissättning', 'Lead Contact': 'Leadkontakt',
  'SaaS Landing Page': 'SaaS-landningssida', 'Business Homepage': 'Företagsstartsida', 'Portfolio Homepage': 'Portfoliostartsida', 'Product Launch': 'Produktlansering',
  'Service Business Site': 'Tjänsteföretagssajt', 'SaaS Product Site': 'SaaS-produktsajt', 'Commerce Brand Site': 'Varumärkessajt för handel', 'Content Publisher': 'Innehållspublicerare',
  'Hero with a focused value proposition and primary action.': 'Hero med tydligt värdeerbjudande och primär handling.',
  'Feature grid with supporting proof and trust content.': 'Funktionsrutnät med stödjande bevis och förtroendeskapande innehåll.',
  'Pricing block prepared for clear plan comparison.': 'Prisblock för tydlig jämförelse av planer.',
  'Contact section focused on qualified lead capture.': 'Kontaktsektion fokuserad på kvalificerade leads.',
  'Complete SaaS landing flow from hero through pricing and contact.': 'Komplett SaaS-landningsflöde från hero till priser och kontakt.',
  'Professional homepage for services and local businesses.': 'Professionell startsida för tjänster och lokala företag.',
  'Portfolio-focused page with work, story and contact flow.': 'Portfoliofokuserad sida med arbeten, berättelse och kontaktflöde.',
  'Launch page with benefits, social proof and countdown-ready content.': 'Lanseringssida med fördelar, sociala bevis och innehåll redo för nedräkning.',
  'Multi-page starter structure for a service business.': 'Flersidig startstruktur för ett tjänsteföretag.',
  'Multi-page SaaS structure for product, pricing and company content.': 'Flersidig SaaS-struktur för produkt, priser och företagsinnehåll.',
  'Brand-led commerce structure prepared for product storytelling.': 'Varumärkesdriven handelsstruktur för produktberättande.',
  'Content-first site structure prepared for dynamic CMS expansion.': 'Innehållsdriven webbplatsstruktur för dynamisk CMS-expansion.',
};

export function localizeEditorTemplate(text: string, language: Language): string {
  if (language === 'ar') return ar[text] ?? text;
  if (language === 'sv') return sv[text] ?? text;
  return text;
}
