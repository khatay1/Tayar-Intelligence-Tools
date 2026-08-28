import { ArrowRight, Check, FileText, Globe2, Rocket, Users } from 'lucide-react';
import { useLandingCopy } from '@/lib/landing-copy';

interface HeroProps {
  onGetStarted?: () => void;
}

const STARS = Array.from({ length: 54 }, (_, index) => ({
  left: `${(index * 37 + 11) % 100}%`,
  top: `${(index * 61 + 7) % 100}%`,
  size: `${1 + (index % 3) * 0.55}px`,
  opacity: 0.12 + (index % 6) * 0.08,
}));

export default function Hero({ onGetStarted }: HeroProps) {
  const c = useLandingCopy().hero;

  const cards = [
    { icon: Globe2, title: c.builder, desc: c.builderDesc, badge: 'V1' },
    { icon: Users, title: c.team, desc: c.teamDesc, badge: 'Roles' },
    { icon: FileText, title: c.documents, desc: c.documentsDesc, badge: 'Workspace' },
  ];

  return (
    <section id="top" className="relative overflow-hidden bg-[#06060e]/70 pt-16">
      <div className="absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_68%_10%,rgba(124,58,237,0.22),transparent_34%),radial-gradient(circle_at_15%_70%,rgba(79,70,229,0.12),transparent_30%)]" />
        <div className="absolute inset-0 opacity-80">
          {STARS.map((star, index) => (
            <span key={index} className="absolute rounded-full bg-white" style={{ left: star.left, top: star.top, width: star.size, height: star.size, opacity: star.opacity }} />
          ))}
        </div>
        <div className="absolute left-1/2 top-20 h-[520px] w-[520px] -translate-x-1/2 rounded-full border border-violet-300/[0.04]" />
        <div className="absolute left-1/2 top-36 h-[390px] w-[390px] -translate-x-1/2 rounded-full border border-violet-300/[0.05]" />
      </div>

      <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-14 px-4 py-20 sm:px-6 lg:grid-cols-[1.02fr_.98fr] lg:px-8 lg:py-24">
        <div className="max-w-2xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/[0.08] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
            <Rocket className="h-3.5 w-3.5" /> {c.eyebrow}
          </div>
          <h1 className="text-balance text-4xl font-black leading-[1.06] tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl xl:text-7xl">
            {c.titleA}{' '}
            <span className="bg-gradient-to-r from-violet-300 via-violet-400 to-fuchsia-300 bg-clip-text text-transparent">{c.titleB}</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-gray-400 sm:text-lg">{c.description}</p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={onGetStarted} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-bold text-white shadow-xl shadow-violet-950/40 transition-all hover:-translate-y-0.5 hover:bg-violet-500 active:translate-y-0">
              {c.primary} <ArrowRight className="h-4 w-4" />
            </button>
            <a href="#tools" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.025] px-6 py-3 text-sm font-semibold text-white transition-all hover:border-white/20 hover:bg-white/[0.05]">
              {c.secondary}
            </a>
          </div>

          <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-400">
            {c.points.map(point => (
              <span key={point} className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-400" />{point}</span>
            ))}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
          <div className="absolute -inset-6 rounded-[2rem] bg-violet-600/10 blur-3xl" aria-hidden="true" />
          <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0b0b18]/95 shadow-[0_32px_90px_rgba(0,0,0,0.45)]">
            <div className="flex items-center justify-between border-b border-white/[0.07] bg-white/[0.025] px-5 py-4">
              <div>
                <p className="text-sm font-bold text-white">{c.workspaceTitle}</p>
                <p className="mt-0.5 text-xs text-gray-500">{c.workspaceSubtitle}</p>
              </div>
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-300">{c.status}</span>
            </div>

            <div className="grid gap-3 p-4 sm:p-5">
              {cards.map(({ icon: Icon, title, desc, badge }, index) => (
                <div key={title} className="group rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 transition-all hover:border-violet-400/20 hover:bg-white/[0.04] sm:p-5">
                  <div className="flex items-start gap-4">
                    <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border ${index === 0 ? 'border-violet-400/20 bg-violet-500/10 text-violet-300' : index === 1 ? 'border-cyan-400/20 bg-cyan-500/10 text-cyan-300' : 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300'}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="text-sm font-bold text-white sm:text-base">{title}</h2>
                        <span className="rounded-md bg-white/[0.05] px-2 py-1 text-[10px] font-medium text-gray-400">{badge}</span>
                      </div>
                      <p className="mt-1.5 text-xs leading-5 text-gray-500 sm:text-sm">{desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
