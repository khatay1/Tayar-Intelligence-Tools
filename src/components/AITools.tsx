import { ArrowRight, BookOpen, FileText, Globe2, Languages, Mail, PenLine, Users, GraduationCap } from 'lucide-react';
import { useLandingCopy } from '@/lib/landing-copy';

interface AIToolsProps { onGetStarted?: () => void; }

export default function AITools({ onGetStarted }: AIToolsProps) {
  const c = useLandingCopy().tools;
  const items = [
    { icon: Globe2, copy: c.items.website, tone: 'violet' },
    { icon: Users, copy: c.items.team, tone: 'cyan' },
    { icon: FileText, copy: c.items.cv, tone: 'blue' },
    { icon: Mail, copy: c.items.cover, tone: 'fuchsia' },
    { icon: BookOpen, copy: c.items.document, tone: 'emerald' },
    { icon: PenLine, copy: c.items.writer, tone: 'orange' },
    { icon: Languages, copy: c.items.translator, tone: 'sky' },
    { icon: GraduationCap, copy: c.items.study, tone: 'amber' },
  ];
  const toneClass: Record<string, string> = {
    violet: 'border-violet-400/20 bg-violet-500/10 text-violet-300', cyan: 'border-cyan-400/20 bg-cyan-500/10 text-cyan-300',
    blue: 'border-blue-400/20 bg-blue-500/10 text-blue-300', fuchsia: 'border-fuchsia-400/20 bg-fuchsia-500/10 text-fuchsia-300',
    emerald: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300', orange: 'border-orange-400/20 bg-orange-500/10 text-orange-300',
    sky: 'border-sky-400/20 bg-sky-500/10 text-sky-300', amber: 'border-amber-400/20 bg-amber-500/10 text-amber-300',
  };

  return (
    <section id="tools" className="site-section bg-[#080811]">
      <div className="site-container">
        <div className="section-heading">
          <span className="eyebrow">{c.eyebrow}</span>
          <h2>{c.title}</h2>
          <p>{c.description}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {items.map(({ icon: Icon, copy, tone }) => (
            <article key={copy[0]} className="group rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-violet-400/20 hover:bg-white/[0.04]">
              <div className={`mb-5 grid h-11 w-11 place-items-center rounded-xl border ${toneClass[tone]}`}><Icon className="h-5 w-5" /></div>
              <h3 className="text-base font-bold text-white">{copy[0]}</h3>
              <p className="mt-2 min-h-[60px] text-sm leading-6 text-gray-500">{copy[1]}</p>
              <button type="button" onClick={onGetStarted} className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-violet-300 transition-all group-hover:gap-2.5 group-hover:text-violet-200">
                {c.open} <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
