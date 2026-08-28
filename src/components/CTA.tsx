import { ArrowRight } from 'lucide-react';
import { useLandingCopy } from '@/lib/landing-copy';

interface CTAProps { onGetStarted?: () => void; }

export default function CTA({ onGetStarted }: CTAProps) {
  const c = useLandingCopy().cta;
  return (
    <section className="bg-[#06060e] px-4 py-16 sm:px-6 sm:py-20">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-violet-400/20 bg-gradient-to-br from-violet-600/[0.16] via-[#0d0d1b] to-fuchsia-600/[0.08] p-8 text-center shadow-[0_30px_90px_rgba(49,20,92,0.24)] sm:p-12 lg:p-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(167,139,250,0.14),transparent_45%)]" aria-hidden="true" />
        <div className="relative">
          <span className="eyebrow">{c.eyebrow}</span>
          <h2 className="mx-auto mt-5 max-w-3xl text-3xl font-black tracking-[-0.03em] text-white sm:text-4xl">{c.title}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-gray-400 sm:text-base">{c.description}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <button type="button" onClick={onGetStarted} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-bold text-white hover:bg-violet-500">{c.primary}<ArrowRight className="h-4 w-4" /></button>
            <a href="#pricing" className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-6 py-3 text-sm font-semibold text-white hover:bg-white/[0.06]">{c.secondary}</a>
          </div>
        </div>
      </div>
    </section>
  );
}
