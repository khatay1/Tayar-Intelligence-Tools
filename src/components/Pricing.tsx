import { Check, Sparkles } from 'lucide-react';
import { usePreferences } from '@/context/PreferencesContext';

interface PricingProps { onGetStarted?: () => void; }

const pricingCopy = {
  en: {
    eyebrow: 'Plans',
    title: 'Choose the plan that matches how you work.',
    description: 'Every account includes the Tayar workspace and Website Builder access. Upgrade when you need higher limits, more tool access and team capacity.',
    popular: 'Most popular',
    cta: 'Get started',
    includedTitle: 'Included with every account',
    included: ['Tayar workspace', 'Website Builder access', 'English · Arabic · Swedish interface', 'Plan-based tool access and usage limits'],
    note: 'Free starts without a credit card. Paid plans are confirmed securely through Stripe after you sign in. Tool access and usage limits are enforced by your active plan.',
    plans: [
      { name: 'Free', price: '$0', period: 'forever', desc: 'For exploring Tayar and completing your first small project.', features: ['1 Website Builder project', 'Up to 3 pages per website', 'Free-access tools with Free usage limits', 'Personal workspace and project saving', 'No credit card required'] },
      { name: 'Pro', price: '$19', period: 'month', desc: 'For freelancers and professionals who need more capacity.', features: ['Up to 10 Website Builder projects', 'Up to 25 pages per website', 'Pro tool access with higher usage limits', 'Expanded website production features', 'Team Workspace for up to 3 members'] },
      { name: 'Business', price: '$49', period: 'month', desc: 'For teams, client work and higher-volume production.', features: ['Up to 50 Website Builder projects', 'Up to 100 pages per website', 'Business tool access with the highest plan limits', 'Client delivery and advanced production workflows', 'Team Workspace for up to 10 members'] },
    ],
  },
  ar: {
    eyebrow: 'الخطط',
    title: 'اختر الخطة المناسبة لطريقة عملك.',
    description: 'كل حساب يتضمن مساحة عمل Tayar والوصول إلى منشئ المواقع. طوّر خطتك عندما تحتاج حدوداً أعلى وأدوات أكثر وسعة أكبر للفريق.',
    popular: 'الأكثر اختياراً',
    cta: 'ابدأ الآن',
    includedTitle: 'متضمن مع كل حساب',
    included: ['مساحة عمل Tayar', 'الوصول إلى منشئ المواقع', 'واجهة إنجليزية · عربية · سويدية', 'الوصول وحدود الاستخدام حسب الخطة'],
    note: 'تبدأ الخطة المجانية بدون بطاقة. يتم تأكيد الخطط المدفوعة بأمان عبر Stripe بعد تسجيل الدخول. الوصول إلى الأدوات وحدود الاستخدام يحددهما اشتراكك الفعّال.',
    plans: [
      { name: 'Free', price: '$0', period: 'دائماً', desc: 'لاستكشاف Tayar وإنجاز أول مشروع صغير.', features: ['مشروع Website Builder واحد', 'حتى 3 صفحات لكل موقع', 'أدوات Free ضمن حدود استخدام الخطة المجانية', 'مساحة شخصية وحفظ المشاريع', 'لا تحتاج بطاقة ائتمان'] },
      { name: 'Pro', price: '$19', period: 'شهرياً', desc: 'للمستقلين والمحترفين الذين يحتاجون سعة أكبر.', features: ['حتى 10 مشاريع Website Builder', 'حتى 25 صفحة لكل موقع', 'أدوات Pro مع حدود استخدام أعلى', 'قدرات إنتاج مواقع أوسع', 'Team Workspace حتى 3 أعضاء'] },
      { name: 'Business', price: '$49', period: 'شهرياً', desc: 'للفرق وأعمال العملاء والإنتاج بحجم أكبر.', features: ['حتى 50 مشروع Website Builder', 'حتى 100 صفحة لكل موقع', 'أدوات Business مع أعلى حدود الخطة', 'تسليم العملاء وسير عمل إنتاج متقدم', 'Team Workspace حتى 10 أعضاء'] },
    ],
  },
  sv: {
    eyebrow: 'Planer',
    title: 'Välj planen som passar hur du arbetar.',
    description: 'Varje konto innehåller Tayar-arbetsytan och åtkomst till Webbplatsbyggaren. Uppgradera när du behöver högre gränser, fler verktyg och större teamkapacitet.',
    popular: 'Mest populär',
    cta: 'Kom igång',
    includedTitle: 'Ingår med varje konto',
    included: ['Tayar-arbetsyta', 'Åtkomst till Webbplatsbyggaren', 'Engelskt · arabiskt · svenskt gränssnitt', 'Verktygsåtkomst och användningsgränser per plan'],
    note: 'Free startar utan betalkort. Betalda planer bekräftas säkert via Stripe efter inloggning. Verktygsåtkomst och användningsgränser styrs av din aktiva plan.',
    plans: [
      { name: 'Free', price: '$0', period: 'för alltid', desc: 'För att utforska Tayar och slutföra ditt första lilla projekt.', features: ['1 Website Builder-projekt', 'Upp till 3 sidor per webbplats', 'Free-verktyg med Free-planens användningsgränser', 'Personlig arbetsyta och projektsparning', 'Inget betalkort krävs'] },
      { name: 'Pro', price: '$19', period: 'månad', desc: 'För frilansare och professionella som behöver mer kapacitet.', features: ['Upp till 10 Website Builder-projekt', 'Upp till 25 sidor per webbplats', 'Pro-verktyg med högre användningsgränser', 'Utökade funktioner för webbproduktion', 'Team Workspace för upp till 3 medlemmar'] },
      { name: 'Business', price: '$49', period: 'månad', desc: 'För team, kundarbete och produktion i större skala.', features: ['Upp till 50 Website Builder-projekt', 'Upp till 100 sidor per webbplats', 'Business-verktyg med planens högsta gränser', 'Kundleverans och avancerade produktionsflöden', 'Team Workspace för upp till 10 medlemmar'] },
    ],
  },
} as const;

export default function Pricing({ onGetStarted }: PricingProps) {
  const { prefs } = usePreferences();
  const c = pricingCopy[prefs.language];

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

        <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-3">
          {c.plans.map((plan, index) => {
            const highlighted = index === 1;
            return (
              <article key={plan.name} className={`relative rounded-2xl border p-6 sm:p-7 ${highlighted ? 'border-violet-400/35 bg-gradient-to-b from-violet-500/[0.12] to-white/[0.025] shadow-[0_24px_70px_rgba(76,29,149,0.18)]' : 'border-white/[0.07] bg-white/[0.025]'}`}>
                {highlighted && <div className="absolute -top-3 start-6 inline-flex items-center gap-1 rounded-full bg-violet-600 px-3 py-1 text-[11px] font-bold text-white"><Sparkles className="h-3 w-3" />{c.popular}</div>}
                <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                <p className="mt-1.5 min-h-[44px] text-sm leading-6 text-gray-500">{plan.desc}</p>
                <div className="mt-5 flex items-end gap-2"><span className="text-4xl font-black tracking-tight text-white">{plan.price}</span><span className="pb-1 text-sm text-gray-500">/ {plan.period}</span></div>
                <button type="button" onClick={onGetStarted} className={`mt-6 min-h-11 w-full rounded-xl py-3 text-sm font-bold transition-all ${highlighted ? 'bg-violet-600 text-white hover:bg-violet-500' : 'border border-white/10 bg-white/[0.035] text-white hover:bg-white/[0.06]'}`}>{c.cta}</button>
                <ul className="mt-6 space-y-3">
                  {plan.features.map(feature => <li key={feature} className="flex items-start gap-2.5 text-sm leading-5 text-gray-400"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><span>{feature}</span></li>)}
                </ul>
              </article>
            );
          })}
        </div>
        <p className="mx-auto mt-6 max-w-2xl text-center text-xs leading-5 text-gray-600">{c.note}</p>
      </div>
    </section>
  );
}
