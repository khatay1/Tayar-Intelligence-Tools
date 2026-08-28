import { usePreferences } from '@/context/PreferencesContext';

const copy = {
  en: {
    nav: { faq: 'FAQ', language: 'Language' },
    hero: {
      eyebrow: 'Tayar Intelligence · V1',
      titleA: 'Build, create and ship',
      titleB: 'from one workspace.',
      description: 'A focused platform for website building, documents, writing, translation, study tools and team collaboration — with English, Arabic and Swedish built in.',
      primary: 'Start free',
      secondary: 'Explore tools',
      points: ['No credit card to start', 'EN · AR · SV', 'Team-ready workspaces'],
      workspaceTitle: 'Your workspace',
      workspaceSubtitle: 'Everything you need, without the tab chaos',
      builder: 'Website Builder',
      builderDesc: 'Design, publish, analyze and manage client sites.',
      team: 'Team Workspace',
      teamDesc: 'Invite collaborators with clear roles and permissions.',
      documents: 'Documents & AI tools',
      documentsDesc: 'Create, translate, study and organize work in one place.',
      status: 'Production-ready V1',
    },
    tools: {
      eyebrow: 'Core tools',
      title: 'A practical toolkit, not a crowded toolbox',
      description: 'Start with the workflow you need today. Your projects, files and settings stay in one workspace.',
      open: 'Open in workspace',
      items: {
        website: ['Website Builder', 'Build responsive websites, publish releases, manage leads and track conversions.'],
        team: ['Team Workspace', 'Share projects with Owner, Admin, Editor and Viewer permissions.'],
        cv: ['CV Builder', 'Create structured, professional CVs with reusable project data.'],
        cover: ['Cover Letter', 'Draft focused cover letters without starting from a blank page.'],
        document: ['Document AI', 'Work with documents, summaries and structured information.'],
        writer: ['AI Writer', 'Draft and refine everyday writing in a focused workspace.'],
        translator: ['Translator', 'Move between English, Arabic and Swedish workflows smoothly.'],
        study: ['Study Assistant', 'Organize learning, explanations and study notes in one place.'],
      },
    },
    business: {
      eyebrow: 'Built for real work',
      title: 'From first draft to client delivery',
      description: 'The platform now covers the full website workflow: build, collaborate, publish, measure and hand off.',
      items: [
        ['Build & publish', 'Create responsive sites, preview safely, publish versions and roll back when needed.'],
        ['Collaborate safely', 'Invite teammates, assign roles and keep shared projects protected with row-level access rules.'],
        ['Operate after launch', 'Capture leads, review analytics, track conversions and prepare clean client handoffs.'],
      ],
      link: 'See plans',
    },
    stats: [
      ['EN · AR · SV', 'Interface languages'],
      ['4 roles', 'Team permissions'],
      ['3 plans', 'Free · Pro · Business'],
      ['V1.0', 'Website Builder release'],
    ],
    pricing: {
      eyebrow: 'Plans',
      title: 'Start small. Upgrade when the work grows.',
      description: 'The limits below match the Website Builder plan controls in the product.',
      popular: 'Most popular',
      cta: 'Choose plan',
      free: {
        name: 'Free', price: '$0', period: 'forever', desc: 'For trying the workflow and shipping a small site.',
        features: ['1 Website Builder project', 'Up to 3 pages', 'Core publishing', '50 stored leads', 'Basic release history'],
      },
      pro: {
        name: 'Pro', price: '$19', period: 'month', desc: 'For freelancers and professionals shipping multiple sites.',
        features: ['Up to 10 websites', 'Up to 25 pages per site', 'ZIP export & multilingual', 'Analytics & production integrations', 'Team workspace for up to 3 members'],
      },
      business: {
        name: 'Business', price: '$49', period: 'month', desc: 'For teams, client delivery and higher-volume production.',
        features: ['Up to 50 websites', 'Up to 100 pages per site', 'Client delivery workspace', 'White-label handoff', 'Up to 10 team members'],
      },
      note: 'Paid pricing is completed through the billing checkout configured for your account.',
    },
    useCases: {
      eyebrow: 'Why Tayar',
      title: 'Less switching. More finished work.',
      description: 'The product is designed around three things that matter after the demo: continuity, control and delivery.',
      items: [
        ['Continuity', 'Projects, files, settings, versions and collaboration stay connected instead of being scattered across tools.'],
        ['Control', 'Autosave recovery, release history, permissions, audits and launch checks make changes safer to manage.'],
        ['Delivery', 'Publishing, leads, analytics and client handoff turn the builder into an operating workflow, not just a mockup tool.'],
      ],
    },
    faq: {
      eyebrow: 'FAQ', title: 'Questions before you start?', description: 'Straight answers about the current product.',
      items: [
        ['What can I build today?', 'Website Builder V1 is active and supports responsive pages, forms, publishing, release history, analytics, multilingual pages, team collaboration and client handoff features.'],
        ['Can I start for free?', 'Yes. The Free plan is designed for a small Website Builder project and does not require a paid subscription to get started.'],
        ['Which languages does the interface support?', 'The product interface supports English, Arabic and Swedish, including right-to-left layout for Arabic.'],
        ['Can I work with a team?', 'Yes. Pro and Business plans can use Team Workspaces with Owner, Admin, Editor and Viewer roles.'],
        ['Can I undo a bad publish?', 'Yes. Published releases are versioned so you can restore an older release or restore a version back into the editor.'],
        ['Is AI required to use the Website Builder?', 'No. Website Builder V1 is fully usable without the upcoming AI generation layer. AI-assisted website generation is intentionally a later phase.'],
      ],
    },
    cta: {
      eyebrow: 'Ready when you are',
      title: 'Start with the workflow that is already production-ready.',
      description: 'Create a free account, open the Website Builder and move from first page to published site in one workspace.',
      primary: 'Start free', secondary: 'See pricing',
    },
    footer: {
      description: 'One workspace for building websites, creating documents, collaborating with teams and shipping finished work.',
      product: 'Product', company: 'Company', legal: 'Legal',
      tools: 'Tools', pricing: 'Pricing', business: 'Business', faq: 'FAQ',
      about: 'About', help: 'Help / FAQ', privacy: 'Privacy', terms: 'Terms',
      copyright: '© 2026 Tayar Intelligence. All rights reserved.',
    },
  },
  ar: {
    nav: { faq: 'الأسئلة الشائعة', language: 'اللغة' },
    hero: {
      eyebrow: 'Tayar Intelligence · الإصدار V1',
      titleA: 'ابنِ وأنشئ وانشر',
      titleB: 'من مساحة عمل واحدة.',
      description: 'منصة مركزة لبناء المواقع والمستندات والكتابة والترجمة والدراسة والعمل الجماعي — مع دعم الإنجليزية والعربية والسويدية.',
      primary: 'ابدأ مجاناً',
      secondary: 'استكشف الأدوات',
      points: ['ابدأ بدون بطاقة', 'EN · AR · SV', 'مساحات عمل للفرق'],
      workspaceTitle: 'مساحة عملك',
      workspaceSubtitle: 'كل ما تحتاجه بدون فوضى عشرات التبويبات',
      builder: 'منشئ المواقع',
      builderDesc: 'صمّم وانشر وحلّل وأدر مواقع العملاء.',
      team: 'مساحة الفريق',
      teamDesc: 'ادعُ المتعاونين بصلاحيات وأدوار واضحة.',
      documents: 'المستندات وأدوات الذكاء الاصطناعي',
      documentsDesc: 'أنشئ وترجم وادرس ونظّم عملك في مكان واحد.',
      status: 'V1 جاهز للإنتاج',
    },
    tools: {
      eyebrow: 'الأدوات الأساسية',
      title: 'مجموعة عملية بدل صندوق أدوات مزدحم',
      description: 'ابدأ بما تحتاجه اليوم، مع بقاء مشاريعك وملفاتك وإعداداتك في مساحة واحدة.',
      open: 'افتح في مساحة العمل',
      items: {
        website: ['منشئ المواقع', 'أنشئ مواقع متجاوبة وانشر الإصدارات وأدر العملاء المحتملين والتحويلات.'],
        team: ['مساحة الفريق', 'شارك المشاريع بصلاحيات المالك والمدير والمحرر والمشاهد.'],
        cv: ['منشئ السيرة الذاتية', 'أنشئ سيراً ذاتية منظمة واحترافية مع بيانات قابلة لإعادة الاستخدام.'],
        cover: ['خطاب التغطية', 'اكتب خطابات تغطية مركزة بدون البدء من صفحة فارغة.'],
        document: ['ذكاء المستندات', 'اعمل على المستندات والملخصات والمعلومات المنظمة.'],
        writer: ['الكاتب الذكي', 'اكتب وحسّن النصوص اليومية داخل مساحة مركزة.'],
        translator: ['المترجم', 'انتقل بسلاسة بين الإنجليزية والعربية والسويدية.'],
        study: ['مساعد الدراسة', 'نظّم التعلم والشرح والملاحظات الدراسية في مكان واحد.'],
      },
    },
    business: {
      eyebrow: 'مصمم للعمل الحقيقي',
      title: 'من أول مسودة إلى تسليم العميل',
      description: 'المنصة تغطي دورة الموقع كاملة: بناء، تعاون، نشر، قياس وتسليم.',
      items: [
        ['ابنِ وانشر', 'أنشئ مواقع متجاوبة، عاين بأمان، انشر نسخاً محفوظة وارجع لإصدار سابق عند الحاجة.'],
        ['تعاون بأمان', 'ادعُ الفريق وحدد الأدوار وحافظ على المشاريع المشتركة بصلاحيات دقيقة.'],
        ['أدر الموقع بعد الإطلاق', 'استقبل العملاء المحتملين وراجع التحليلات والتحويلات وجهّز تسليم العميل.'],
      ],
      link: 'شاهد الخطط',
    },
    stats: [['EN · AR · SV', 'لغات الواجهة'], ['4 أدوار', 'صلاحيات الفريق'], ['3 خطط', 'Free · Pro · Business'], ['V1.0', 'إصدار منشئ المواقع']],
    pricing: {
      eyebrow: 'الخطط', title: 'ابدأ صغيراً وطوّر خطتك عندما يكبر العمل.', description: 'الحدود أدناه متوافقة مع نظام الخطط داخل منشئ المواقع.', popular: 'الأكثر اختياراً', cta: 'اختر الخطة',
      free: { name: 'Free', price: '$0', period: 'دائماً', desc: 'لتجربة سير العمل ونشر موقع صغير.', features: ['مشروع Website Builder واحد', 'حتى 3 صفحات', 'النشر الأساسي', '50 عميلاً محتملاً محفوظاً', 'سجل إصدارات أساسي'] },
      pro: { name: 'Pro', price: '$19', period: 'شهرياً', desc: 'للمستقلين والمحترفين الذين يديرون عدة مواقع.', features: ['حتى 10 مواقع', 'حتى 25 صفحة لكل موقع', 'ZIP وتعدد اللغات', 'التحليلات والتكاملات', 'فريق حتى 3 أعضاء'] },
      business: { name: 'Business', price: '$49', period: 'شهرياً', desc: 'للفرق وتسليم العملاء والإنتاج الأكبر.', features: ['حتى 50 موقعاً', 'حتى 100 صفحة لكل موقع', 'مساحة تسليم العميل', 'تسليم White-label', 'حتى 10 أعضاء في الفريق'] },
      note: 'يتم إتمام سعر الخطط المدفوعة من خلال صفحة الدفع المهيأة لحسابك.',
    },
    useCases: {
      eyebrow: 'لماذا Tayar', title: 'تنقل أقل. عمل مكتمل أكثر.', description: 'المنتج مبني حول الاستمرارية والتحكم والتسليم بعد انتهاء العرض التجريبي.',
      items: [['استمرارية', 'تبقى المشاريع والملفات والإعدادات والإصدارات والتعاون مترابطة بدلاً من التشتت بين أدوات مختلفة.'], ['تحكم', 'الاسترجاع التلقائي وسجل الإصدارات والصلاحيات والتدقيق وفحوص الإطلاق تجعل التغيير أكثر أماناً.'], ['تسليم', 'النشر والعملاء المحتملون والتحليلات وتسليم العميل يحول المنشئ إلى سير عمل حقيقي وليس مجرد نموذج.']],
    },
    faq: {
      eyebrow: 'الأسئلة الشائعة', title: 'أسئلة قبل أن تبدأ؟', description: 'إجابات مباشرة عن المنتج الحالي.',
      items: [['ماذا أستطيع أن أبني الآن؟', 'Website Builder V1 فعال ويدعم الصفحات المتجاوبة والنماذج والنشر وسجل الإصدارات والتحليلات والصفحات متعددة اللغات والعمل الجماعي وتسليم العملاء.'], ['هل أستطيع البدء مجاناً؟', 'نعم. خطة Free مناسبة لمشروع Website Builder صغير ولا تحتاج اشتراكاً مدفوعاً للبدء.'], ['ما اللغات المدعومة؟', 'واجهة المنتج تدعم الإنجليزية والعربية والسويدية، مع RTL حقيقي للعربية.'], ['هل يمكنني العمل مع فريق؟', 'نعم. خطتا Pro وBusiness تدعمان Team Workspaces بأدوار Owner وAdmin وEditor وViewer.'], ['هل يمكن الرجوع بعد نشر سيئ؟', 'نعم. الإصدارات المنشورة محفوظة ويمكن استرجاع إصدار قديم أو إعادته إلى المحرر.'], ['هل الذكاء الاصطناعي ضروري لاستخدام منشئ المواقع؟', 'لا. Website Builder V1 يعمل بالكامل بدون طبقة توليد المواقع بالذكاء الاصطناعي، وهي مرحلة لاحقة عمداً.']],
    },
    cta: { eyebrow: 'جاهز عندما تكون جاهزاً', title: 'ابدأ بسير العمل الجاهز فعلياً للإنتاج.', description: 'أنشئ حساباً مجانياً وافتح منشئ المواقع وانتقل من أول صفحة إلى موقع منشور داخل مساحة واحدة.', primary: 'ابدأ مجاناً', secondary: 'شاهد الأسعار' },
    footer: { description: 'مساحة واحدة لبناء المواقع وإنشاء المستندات والعمل مع الفرق وتسليم العمل النهائي.', product: 'المنتج', company: 'الشركة', legal: 'قانوني', tools: 'الأدوات', pricing: 'الأسعار', business: 'الأعمال', faq: 'الأسئلة الشائعة', about: 'حول', help: 'المساعدة / الأسئلة', privacy: 'الخصوصية', terms: 'الشروط', copyright: '© 2026 Tayar Intelligence. جميع الحقوق محفوظة.' },
  },
  sv: {
    nav: { faq: 'Vanliga frågor', language: 'Språk' },
    hero: {
      eyebrow: 'Tayar Intelligence · V1', titleA: 'Bygg, skapa och lansera', titleB: 'från en arbetsyta.',
      description: 'En fokuserad plattform för webbplatser, dokument, skrivande, översättning, studier och teamsamarbete — med engelska, arabiska och svenska inbyggt.',
      primary: 'Börja gratis', secondary: 'Utforska verktyg', points: ['Inget kort krävs för att börja', 'EN · AR · SV', 'Arbetsytor för team'],
      workspaceTitle: 'Din arbetsyta', workspaceSubtitle: 'Allt du behöver utan flikkaos', builder: 'Webbplatsbyggare', builderDesc: 'Designa, publicera, analysera och hantera kundwebbplatser.', team: 'Team Workspace', teamDesc: 'Bjud in personer med tydliga roller och behörigheter.', documents: 'Dokument & AI-verktyg', documentsDesc: 'Skapa, översätt, studera och organisera arbete på ett ställe.', status: 'Produktionsklar V1',
    },
    tools: {
      eyebrow: 'Kärnverktyg', title: 'En praktisk verktygslåda utan onödigt brus', description: 'Börja med arbetsflödet du behöver idag. Projekt, filer och inställningar stannar i samma arbetsyta.', open: 'Öppna i arbetsytan',
      items: {
        website: ['Webbplatsbyggare', 'Bygg responsiva webbplatser, publicera versioner, hantera leads och följ konverteringar.'], team: ['Team Workspace', 'Dela projekt med rollerna Owner, Admin, Editor och Viewer.'], cv: ['CV Builder', 'Skapa strukturerade professionella CV:n med återanvändbar projektdata.'], cover: ['Personligt brev', 'Skriv fokuserade personliga brev utan att börja från ett tomt dokument.'], document: ['Document AI', 'Arbeta med dokument, sammanfattningar och strukturerad information.'], writer: ['AI Writer', 'Skriv och förbättra vardaglig text i en fokuserad arbetsyta.'], translator: ['Översättare', 'Växla smidigt mellan engelska, arabiska och svenska arbetsflöden.'], study: ['Studiestöd', 'Organisera lärande, förklaringar och studienoteringar på ett ställe.'],
      },
    },
    business: { eyebrow: 'Byggd för riktigt arbete', title: 'Från första utkast till kundleverans', description: 'Plattformen täcker hela webbflödet: bygg, samarbeta, publicera, mät och leverera.', items: [['Bygg & publicera', 'Skapa responsiva webbplatser, förhandsgranska säkert, publicera versioner och återställ vid behov.'], ['Samarbeta säkert', 'Bjud in teamet, tilldela roller och skydda delade projekt med tydliga åtkomstregler.'], ['Driv efter lansering', 'Samla leads, granska analys, följ konverteringar och förbered rena kundleveranser.']], link: 'Se planer' },
    stats: [['EN · AR · SV', 'Gränssnittsspråk'], ['4 roller', 'Teambehörigheter'], ['3 planer', 'Free · Pro · Business'], ['V1.0', 'Webbplatsbyggarens version']],
    pricing: {
      eyebrow: 'Planer', title: 'Börja litet. Uppgradera när arbetet växer.', description: 'Gränserna nedan matchar planreglerna i Webbplatsbyggaren.', popular: 'Mest populär', cta: 'Välj plan',
      free: { name: 'Free', price: '$0', period: 'för alltid', desc: 'För att prova arbetsflödet och lansera en liten webbplats.', features: ['1 Website Builder-projekt', 'Upp till 3 sidor', 'Grundläggande publicering', '50 sparade leads', 'Grundläggande versionshistorik'] },
      pro: { name: 'Pro', price: '$19', period: 'månad', desc: 'För frilansare och professionella som lanserar flera webbplatser.', features: ['Upp till 10 webbplatser', 'Upp till 25 sidor per webbplats', 'ZIP-export & flera språk', 'Analys & produktionsintegrationer', 'Team Workspace med upp till 3 medlemmar'] },
      business: { name: 'Business', price: '$49', period: 'månad', desc: 'För team, kundleverans och större produktion.', features: ['Upp till 50 webbplatser', 'Upp till 100 sidor per webbplats', 'Kundleveransyta', 'White-label-leverans', 'Upp till 10 teammedlemmar'] },
      note: 'Betald prissättning slutförs i den betalningssida som är konfigurerad för ditt konto.',
    },
    useCases: { eyebrow: 'Varför Tayar', title: 'Mindre växlande. Mer färdigt arbete.', description: 'Produkten är byggd kring kontinuitet, kontroll och leverans efter demon.', items: [['Kontinuitet', 'Projekt, filer, inställningar, versioner och samarbete hålls ihop i stället för att spridas över olika verktyg.'], ['Kontroll', 'Återställning, versionshistorik, behörigheter, revisioner och launch-kontroller gör ändringar säkrare.'], ['Leverans', 'Publicering, leads, analys och kundleverans gör byggaren till ett riktigt arbetsflöde, inte bara en mockup.']] },
    faq: { eyebrow: 'Vanliga frågor', title: 'Frågor innan du börjar?', description: 'Raka svar om den nuvarande produkten.', items: [['Vad kan jag bygga idag?', 'Website Builder V1 är aktiv och stöder responsiva sidor, formulär, publicering, versionshistorik, analys, flerspråkiga sidor, teamsamarbete och kundleverans.'], ['Kan jag börja gratis?', 'Ja. Free-planen är avsedd för ett litet Website Builder-projekt och kräver ingen betald prenumeration för att komma igång.'], ['Vilka språk stöds?', 'Gränssnittet stöder engelska, arabiska och svenska, inklusive riktig RTL-layout för arabiska.'], ['Kan jag arbeta med ett team?', 'Ja. Pro och Business kan använda Team Workspaces med rollerna Owner, Admin, Editor och Viewer.'], ['Kan jag återställa en dålig publicering?', 'Ja. Publicerade versioner sparas så att du kan återställa en äldre version eller ta tillbaka den till redigeraren.'], ['Krävs AI för Webbplatsbyggaren?', 'Nej. Website Builder V1 fungerar fullt ut utan den kommande AI-genereringsdelen. Den är medvetet planerad som ett senare steg.']] },
    cta: { eyebrow: 'Redo när du är', title: 'Börja med arbetsflödet som redan är produktionsklart.', description: 'Skapa ett gratiskonto, öppna Webbplatsbyggaren och gå från första sidan till publicerad webbplats i samma arbetsyta.', primary: 'Börja gratis', secondary: 'Se priser' },
    footer: { description: 'En arbetsyta för att bygga webbplatser, skapa dokument, samarbeta med team och leverera färdigt arbete.', product: 'Produkt', company: 'Företag', legal: 'Juridik', tools: 'Verktyg', pricing: 'Priser', business: 'Företag', faq: 'Vanliga frågor', about: 'Om oss', help: 'Hjälp / FAQ', privacy: 'Integritet', terms: 'Villkor', copyright: '© 2026 Tayar Intelligence. Alla rättigheter förbehållna.' },
  },
} as const;

export type LandingCopy = typeof copy.en;

export function useLandingCopy(): LandingCopy {
  const { prefs } = usePreferences();
  return copy[prefs.language] as unknown as LandingCopy;
}
