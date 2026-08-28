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
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600/20 to-fuchsia-600/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
          <Icon className="w-6 h-6 text-violet-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white">{title}</h1>
            {badge && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 font-medium">
                {badge}
              </span>
            )}
          </div>
          <p className="text-gray-500 text-sm mt-0.5">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

interface ToolInputPanelProps {
  children: ReactNode;
}

export function ToolInputPanel({ children }: ToolInputPanelProps) {
  return (
    <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-5 space-y-4">
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
    <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-5 min-h-[200px]">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
            <p className="text-gray-500 text-sm">{l('Generating...')}</p>
          </div>
        </div>
      ) : hasContent ? (
        children
      ) : (
        empty || (
          <div className="flex items-center justify-center py-12 text-center">
            <p className="text-gray-600 text-sm">{l('Your result will appear here.')}</p>
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
    <div>
      <label className="text-gray-400 text-xs font-medium mb-1.5 block uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

export const toolInputClass =
  'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-gray-600 focus:border-violet-500/50 focus:outline-none transition-all';

export const toolButtonClass =
  'w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all active:scale-95';

export type ToolComponent = ComponentType<{ darkMode: boolean }>;
