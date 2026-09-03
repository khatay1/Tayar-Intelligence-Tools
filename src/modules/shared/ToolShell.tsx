import { useLocalizer } from '@/lib/ui-localization';
import { ComponentType, ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface ToolShellProps {
  icon: LucideIcon;
  title: string;
  description: string;
  badge?: string;
  children: ReactNode;
}

export function ToolShell({ icon: Icon, title, description, badge, children }: ToolShellProps) {
  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      <div className="flex min-w-0 items-start gap-3 sm:gap-4">
        <div className="h-11 w-11 flex-shrink-0 rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-600/20 to-fuchsia-600/10 flex items-center justify-center sm:h-12 sm:w-12">
          <Icon className="h-5 w-5 text-violet-400 sm:h-6 sm:w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="min-w-0 break-words text-xl font-bold text-white sm:text-2xl">{title}</h1>
            {badge && (
              <span className="max-w-full break-words rounded-full bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-400">
                {badge}
              </span>
            )}
          </div>
          <p className="mt-1 break-words text-sm leading-5 text-gray-500 sm:mt-0.5">{description}</p>
        </div>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

interface ToolInputPanelProps {
  children: ReactNode;
}

export function ToolInputPanel({ children }: ToolInputPanelProps) {
  return (
    <div className="min-w-0 space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl sm:p-5">
      {children}
    </div>
  );
}

interface ToolOutputPanelProps {
  children: ReactNode;
  loading?: boolean;
  empty?: ReactNode;
  hasContent?: boolean;
}

export function ToolOutputPanel({ children, loading, empty, hasContent }: ToolOutputPanelProps) {
  const l = useLocalizer();
  return (
    <div className="min-h-[200px] min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl sm:p-5">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-500" />
            <p className="text-sm text-gray-500">{l('Generating...')}</p>
          </div>
        </div>
      ) : hasContent ? (
        children
      ) : (
        empty || (
          <div className="flex items-center justify-center py-12 text-center">
            <p className="text-sm text-gray-600">{l('Your result will appear here.')}</p>
          </div>
        )
      )}
    </div>
  );
}

export function ToolField({
  label, children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label className="mb-1.5 block break-words text-xs font-medium uppercase tracking-wider text-gray-400">{label}</label>
      {children}
    </div>
  );
}

export const toolInputClass =
  'w-full min-w-0 min-h-11 bg-white/5 border border-white/10 rounded-xl px-3 sm:px-4 py-2.5 text-white text-sm placeholder:text-gray-600 focus:border-violet-500/50 focus:outline-none transition-all';

export const toolButtonClass =
  'w-full min-h-11 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all active:scale-[0.98]';

export type ToolComponent = ComponentType<{ darkMode: boolean }>;
