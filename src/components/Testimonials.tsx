import { CheckCircle2, Layers3, PackageCheck } from 'lucide-react';
import { useLandingCopy } from '@/lib/landing-copy';

export default function Testimonials() {
  const c = useLandingCopy().useCases;
  const icons = [Layers3, CheckCircle2, PackageCheck];
  return (
    <section className="site-section bg-[#06060e]/70">
      <div className="site-container">
        <div className="section-heading">
          <span className="eyebrow">{c.eyebrow}</span>
          <h2>{c.title}</h2>
          <p>{c.description}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {c.items.map((item, index) => {
            const Icon = icons[index];
            return <article key={item[0]} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6"><Icon className="h-5 w-5 text-violet-300" /><h3 className="mt-5 text-lg font-bold text-white">{item[0]}</h3><p className="mt-2 text-sm leading-6 text-gray-500">{item[1]}</p></article>;
          })}
        </div>
      </div>
    </section>
  );
}
