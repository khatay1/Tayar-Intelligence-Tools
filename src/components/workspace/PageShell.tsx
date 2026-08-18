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
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600/20 to-fuchsia-600/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
          <Icon className="w-6 h-6 text-violet-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          {subtitle && <p className="text-gray-500 text-sm mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 sm:p-8">
        {children}
      </div>
    </div>
  );
}

export function PageSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="mb-6 last:mb-0">
      {title && <h2 className="text-white font-semibold text-base mb-2">{title}</h2>}
      <div className="text-gray-400 text-sm leading-relaxed space-y-2">{children}</div>
    </div>
  );
}
