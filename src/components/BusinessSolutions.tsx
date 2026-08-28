import { ArrowRight, BarChart3, Globe2, Users } from 'lucide-react';
import { useLandingCopy } from '@/lib/landing-copy';

export default function BusinessSolutions() {
  const c = useLandingCopy().business;
  const icons = [Globe2, Users, BarChart3];
  return (
    <section id="business" className="site-section bg-[#06060e]/45 backdrop-blur-[2px]">
      <div className="site-container">
        <div className="section-heading">
          <span className="eyebrow">{c.eyebrow}</span>
          <h2>{c.title}</h2>
          <p>{c.description}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {c.items.map((item, index) => {
            const Icon = icons[index];
            return (
              <article key={item[0]} className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.035] to-white/[0.015] p-6 sm:p-7">
                <div className="absolute end-0 top-0 h-32 w-32 rounded-full bg-violet-500/[0.06] blur-3xl" />
                <div className="relative">
                  <div className="mb-5 grid h-11 w-11 place-items-center rounded-xl border border-violet-400/20 bg-violet-500/10 text-violet-300"><Icon className="h-5 w-5" /></div>
                  <h3 className="text-lg font-bold text-white">{item[0]}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-500">{item[1]}</p>
                  <a href="#pricing" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-violet-300 hover:text-violet-200">{c.link}<ArrowRight className="h-4 w-4" /></a>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
