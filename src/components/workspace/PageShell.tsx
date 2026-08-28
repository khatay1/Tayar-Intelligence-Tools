import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface PageShellProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function PageShell({ icon: Icon, title, subtitle, children }: PageShellProps) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-violet-400/20 bg-violet-500/10 shadow-lg shadow-violet-950/20">
          <Icon className="h-5 w-5 text-violet-300" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-[-0.025em] text-white sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">{subtitle}</p>}
        </div>
      </div>
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)] sm:p-8">
        {children}
      </div>
    </div>
  );
}

export function PageSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="mb-7 last:mb-0">
      {title && <h2 className="mb-2.5 text-base font-bold text-white">{title}</h2>}
      <div className="space-y-2.5 text-sm leading-7 text-gray-400">{children}</div>
    </section>
  );
}
