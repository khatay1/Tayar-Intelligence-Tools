import { Check, Sparkles } from 'lucide-react';
import { useLandingCopy } from '@/lib/landing-copy';

interface PricingProps { onGetStarted?: () => void; }

export default function Pricing({ onGetStarted }: PricingProps) {
  const c = useLandingCopy().pricing;
  const plans = [c.free, c.pro, c.business];
  return (
    <section id="pricing" className="site-section bg-[#07070f]/55 backdrop-blur-[2px]/55 backdrop-blur-[2px]">
      <div className="site-container">
        <div className="section-heading">
          <span className="eyebrow">{c.eyebrow}</span>
          <h2>{c.title}</h2>
          <p>{c.description}</p>
        </div>
        <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-3">
          {plans.map((plan, index) => {
            const highlighted = index === 1;
            return (
              <article key={plan.name} className={`relative rounded-2xl border p-6 sm:p-7 ${highlighted ? 'border-violet-400/35 bg-gradient-to-b from-violet-500/[0.12] to-white/[0.025] shadow-[0_24px_70px_rgba(76,29,149,0.18)]' : 'border-white/[0.07] bg-white/[0.025]'}`}>
                {highlighted && <div className="absolute -top-3 start-6 inline-flex items-center gap-1 rounded-full bg-violet-600 px-3 py-1 text-[11px] font-bold text-white"><Sparkles className="h-3 w-3" />{c.popular}</div>}
                <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                <p className="mt-1.5 min-h-[44px] text-sm leading-6 text-gray-500">{plan.desc}</p>
                <div className="mt-5 flex items-end gap-2"><span className="text-4xl font-black tracking-tight text-white">{plan.price}</span><span className="pb-1 text-sm text-gray-500">/ {plan.period}</span></div>
                <button type="button" onClick={onGetStarted} className={`mt-6 w-full rounded-xl py-3 text-sm font-bold transition-all ${highlighted ? 'bg-violet-600 text-white hover:bg-violet-500' : 'border border-white/10 bg-white/[0.035] text-white hover:bg-white/[0.06]'}`}>{c.cta}</button>
                <ul className="mt-6 space-y-3">
                  {plan.features.map(feature => <li key={feature} className="flex items-start gap-2.5 text-sm leading-5 text-gray-400"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />{feature}</li>)}
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
