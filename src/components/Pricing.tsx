import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Sparkles } from 'lucide-react';
import { usePreferences } from '@/context/PreferencesContext';
import { useLocalizer } from '@/lib/ui-localization';
import { fetchPublicPlanCatalogV2, formatPlanPrice, planDisplayName, type PublicPlanCatalogV2, type PublicPlanToolV2 } from '@/lib/plan-catalog-v2';

interface PricingProps { onGetStarted?: () => void; }

type PeriodCopy = { day: string; month: string; year: string; lifetime: string; unlimited: string };

const pricingCopy = {
  en: {
    eyebrow: 'Plans',
    title: 'Choose the plan that matches how you work.',
    description: 'Every account includes the Tayar workspace. Tool access, live usage limits and paid prices now come directly from the same rules Tayar enforces.',
    popular: 'Most popular',
    cta: 'Get started',
    includedTitle: 'Included with every account',
    included: ['Tayar workspace', 'Website Builder access when enabled for your plan', 'English · Arabic · Swedish interface', 'Plan-based tool access and usage limits'],
    note: 'Free starts without a credit card. Paid plans are confirmed securely through Stripe after you sign in. The list below reflects the current live Admin configuration.',
    toolsIncluded: '{count} tools currently included',
    showAll: 'Show all included tools',
    showLess: 'Show fewer tools',
    unlimited: 'Unlimited',
    day: 'day',
    month: 'month',
    year: 'year',
    lifetime: 'lifetime',
    live: 'Live plan data',
    fallback: 'Using safe pricing fallback',
    plans: [
      { name: 'Free', price: '$0', period: 'forever', desc: 'For exploring Tayar with Free tool access and plan limits.', features: ['Free-access tools with Free usage limits', 'Personal workspace and project saving', 'No credit card required'] },
      { name: 'Pro', price: '$19', period: 'month', desc: 'For professionals who need Pro tools and higher limits.', features: ['Free + Pro tool access', 'Higher usage limits than Free', 'Personal workspace and project saving'] },
      { name: 'Business', price: '$49', period: 'month', desc: 'For teams and higher-volume work with Business-only tools.', features: ['Free + Pro + Business tool access', 'Highest plan usage limits', 'Business-only tools such as Team Workspace when enabled'] },
    ],
  },
  ar: {
    eyebrow: 'الخطط',
    title: 'اختر الخطة المناسبة لطريقة عملك.',
    description: 'كل حساب يتضمن مساحة عمل Tayar. الوصول إلى الأدوات وحدود الاستخدام الفعلية والأسعار المدفوعة تأتي الآن مباشرة من نفس القواعد التي يطبقها Tayar.',
    popular: 'الأكثر اختياراً',
    cta: 'ابدأ الآن',
    includedTitle: 'متضمن مع كل حساب',
    included: ['مساحة عمل Tayar', 'الوصول إلى Website Builder عندما يكون متاحاً لخطتك', 'واجهة إنجليزية · عربية · سويدية', 'الوصول وحدود الاستخدام حسب الخطة'],
    note: 'تبدأ الخطة المجانية بدون بطاقة. يتم تأكيد الخطط المدفوعة بأمان عبر Stripe بعد تسجيل الدخول. القائمة أدناه تعكس إعدادات Admin الفعلية الحالية.',
    toolsIncluded: '{count} أداة متضمنة حالياً',
    showAll: 'عرض كل الأدوات المتضمنة',
    showLess: 'عرض أدوات أقل',
    unlimited: 'غير محدود',
    day: 'يوم',
    month: 'شهر',
    year: 'سنة',
    lifetime: 'مدى الحياة',
    live: 'بيانات الخطط المباشرة',
    fallback: 'يتم استخدام القيم الاحتياطية الآمنة',
    plans: [
      { name: 'Free', price: '$0', period: 'دائماً', desc: 'لاستكشاف Tayar باستخدام أدوات Free وحدود الخطة الفعلية.', features: ['أدوات Free ضمن حدود الخطة المجانية', 'مساحة شخصية وحفظ المشاريع', 'لا تحتاج بطاقة ائتمان'] },
      { name: 'Pro', price: '$19', period: 'شهرياً', desc: 'للمحترفين الذين يحتاجون أدوات Pro وحدوداً أعلى.', features: ['أدوات Free + Pro', 'حدود استخدام أعلى من Free', 'مساحة شخصية وحفظ المشاريع'] },
      { name: 'Business', price: '$49', period: 'شهرياً', desc: 'للفرق والعمل بحجم أكبر مع أدوات Business.', features: ['أدوات Free + Pro + Business', 'أعلى حدود استخدام للخطة', 'أدوات Business مثل Team Workspace عندما تكون مفعّلة'] },
    ],
  },
  sv: {
    eyebrow: 'Planer',
    title: 'Välj planen som passar hur du arbetar.',
    description: 'Varje konto innehåller Tayar-arbetsytan. Verktygsåtkomst, livegränser och betalda priser kommer nu direkt från samma regler som Tayar faktiskt använder.',
    popular: 'Mest populär',
    cta: 'Kom igång',
    includedTitle: 'Ingår med varje konto',
    included: ['Tayar-arbetsyta', 'Åtkomst till Website Builder när den är aktiverad för din plan', 'Engelskt · arabiskt · svenskt gränssnitt', 'Verktygsåtkomst och användningsgränser per plan'],
    note: 'Free startar utan betalkort. Betalda planer bekräftas säkert via Stripe efter inloggning. Listan nedan speglar den aktuella livekonfigurationen i Admin.',
    toolsIncluded: '{count} verktyg ingår just nu',
    showAll: 'Visa alla inkluderade verktyg',
    showLess: 'Visa färre verktyg',
    unlimited: 'Obegränsat',
    day: 'dag',
    month: 'månad',
    year: 'år',
    lifetime: 'livstid',
    live: 'Live plandata',
    fallback: 'Säkra reservvärden används',
    plans: [
      { name: 'Free', price: '$0', period: 'för alltid', desc: 'För att utforska Tayar med Free-verktyg och planens faktiska gränser.', features: ['Free-verktyg med Free-planens gränser', 'Personlig arbetsyta och projektsparning', 'Inget betalkort krävs'] },
      { name: 'Pro', price: '$19', period: 'månad', desc: 'För professionella som behöver Pro-verktyg och högre gränser.', features: ['Free + Pro-verktyg', 'Högre användningsgränser än Free', 'Personlig arbetsyta och projektsparning'] },
      { name: 'Business', price: '$49', period: 'månad', desc: 'För team och större arbetsvolymer med Business-verktyg.', features: ['Free + Pro + Business-verktyg', 'Planens högsta användningsgränser', 'Business-verktyg som Team Workspace när de är aktiverade'] },
    ],
  },
} as const;

interface RenderPlan {
  key: string;
  name: string;
  price: string;
  period: string;
  desc: string;
  highlighted: boolean;
  features: readonly string[];
  tools: PublicPlanToolV2[];
}

function periodText(interval: string, c: PeriodCopy): string {
  if (interval === 'year') return c.year;
  if (interval === 'forever') return c.lifetime;
  return c.month;
}

function quotaText(tool: PublicPlanToolV2, c: PeriodCopy): string {
  if (tool.limit == null) return c.unlimited;
  const period = tool.period === 'daily' ? c.day : tool.period === 'lifetime' ? c.lifetime : c.month;
  return `${tool.limit}/${period}`;
}

export default function Pricing({ onGetStarted }: PricingProps) {
  const { prefs } = usePreferences();
  const l = useLocalizer();
  const c = pricingCopy[prefs.language];
  const [catalog, setCatalog] = useState<PublicPlanCatalogV2 | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    void fetchPublicPlanCatalogV2()
      .then(data => { if (active) setCatalog(data); })
      .catch(() => { if (active) setCatalog(null); })
      .finally(() => { if (active) setCatalogLoading(false); });
    return () => { active = false; };
  }, []);

  const plans = useMemo<RenderPlan[]>(() => {
    const livePlans = catalog?.plans.filter(plan => plan.visible) || [];
    if (livePlans.length) {
      return livePlans.map(plan => ({
        key: plan.id,
        name: planDisplayName(plan.id),
        price: formatPlanPrice(plan.price, prefs.language),
        period: periodText(plan.price.interval, c),
        desc: plan.description[prefs.language] || plan.description.en,
        highlighted: plan.featured,
        features: [],
        tools: plan.tools,
      }));
    }
    return c.plans.map((plan, index) => ({
      key: plan.name,
      name: plan.name,
      price: plan.price,
      period: plan.period,
      desc: plan.desc,
      highlighted: index === 1,
      features: plan.features,
      tools: [],
    }));
  }, [catalog, c, prefs.language]);

  return (
    <section id="pricing" className="site-section bg-[#07070f]/55 backdrop-blur-[2px]">
      <div className="site-container">
        <div className="section-heading">
          <span className="eyebrow">{c.eyebrow}</span>
          <h2>{c.title}</h2>
          <p>{c.description}</p>
        </div>

        <div className="mx-auto mb-6 max-w-4xl rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 sm:p-5">
          <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">{c.includedTitle}</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {c.included.map(item => (
              <div key={item} className="flex items-start gap-2 text-sm leading-5 text-gray-400">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto mb-4 flex max-w-6xl items-center justify-end gap-2 text-[11px] text-gray-600">
          {catalogLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          <span>{catalog ? c.live : c.fallback}</span>
        </div>

        <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-3">
          {plans.map(plan => {
            const toolsShown = expanded[plan.key] ? plan.tools : plan.tools.slice(0, 6);
            return (
              <article key={plan.key} className={`relative rounded-2xl border p-6 sm:p-7 ${plan.highlighted ? 'border-violet-400/35 bg-gradient-to-b from-violet-500/[0.12] to-white/[0.025] shadow-[0_24px_70px_rgba(76,29,149,0.18)]' : 'border-white/[0.07] bg-white/[0.025]'}`}>
                {plan.highlighted && <div className="absolute -top-3 start-6 inline-flex items-center gap-1 rounded-full bg-violet-600 px-3 py-1 text-[11px] font-bold text-white"><Sparkles className="h-3 w-3" />{c.popular}</div>}
                <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                <p className="mt-1.5 min-h-[44px] text-sm leading-6 text-gray-500">{plan.desc}</p>
                <div className="mt-5 flex items-end gap-2"><span className="text-4xl font-black tracking-tight text-white">{plan.price}</span><span className="pb-1 text-sm text-gray-500">/ {plan.period}</span></div>
                <button type="button" onClick={onGetStarted} className={`mt-6 min-h-11 w-full rounded-xl py-3 text-sm font-bold transition-all ${plan.highlighted ? 'bg-violet-600 text-white hover:bg-violet-500' : 'border border-white/10 bg-white/[0.035] text-white hover:bg-white/[0.06]'}`}>{c.cta}</button>

                {plan.tools.length ? (
                  <div className="mt-6">
                    <div className="mb-3 text-xs font-semibold text-violet-200">{c.toolsIncluded.replace('{count}', String(plan.tools.length))}</div>
                    <ul className="space-y-2.5">
                      {toolsShown.map(tool => <li key={tool.id} className="flex items-start justify-between gap-3 text-sm leading-5"><span className="flex min-w-0 items-start gap-2 text-gray-400"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><span className="min-w-0 break-words">{l(tool.label)}</span></span><span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-gray-500">{quotaText(tool, c)}</span></li>)}
                    </ul>
                    {plan.tools.length > 6 && <button type="button" onClick={() => setExpanded(previous => ({ ...previous, [plan.key]: !previous[plan.key] }))} className="mt-4 text-xs font-semibold text-violet-300 hover:text-violet-200">{expanded[plan.key] ? c.showLess : c.showAll}</button>}
                  </div>
                ) : (
                  <ul className="mt-6 space-y-3">
                    {plan.features.map(feature => <li key={feature} className="flex items-start gap-2.5 text-sm leading-5 text-gray-400"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><span>{feature}</span></li>)}
                  </ul>
                )}
              </article>
            );
          })}
        </div>
        <p className="mx-auto mt-6 max-w-2xl text-center text-xs leading-5 text-gray-600">{c.note}</p>
      </div>
    </section>
  );
}
