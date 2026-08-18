// Reusable EmptyState component with premium illustrations and CTA buttons.
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: 'default' | 'search' | 'trash' | 'files' | 'projects';
}

const VARIANT_STYLES: Record<string, { bg: string; glow: string; iconColor: string }> = {
  default: { bg: 'bg-white/5', glow: 'from-violet-500/10', iconColor: 'text-gray-600' },
  search: { bg: 'bg-sky-500/5', glow: 'from-sky-500/10', iconColor: 'text-sky-500/60' },
  trash: { bg: 'bg-red-500/5', glow: 'from-red-500/10', iconColor: 'text-red-500/60' },
  files: { bg: 'bg-violet-500/5', glow: 'from-violet-500/10', iconColor: 'text-violet-500/60' },
  projects: { bg: 'bg-amber-500/5', glow: 'from-amber-500/10', iconColor: 'text-amber-500/60' },
};

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction, variant = 'default' }: EmptyStateProps) {
  const style = VARIANT_STYLES[variant] || VARIANT_STYLES.default;
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="relative mb-5">
        <div className={`absolute inset-0 bg-gradient-to-br ${style.glow} to-transparent rounded-full blur-2xl scale-150`} />
        <div className={`relative w-20 h-20 rounded-3xl ${style.bg} backdrop-blur-xl border border-white/10 flex items-center justify-center`}>
          <Icon className={`w-10 h-10 ${style.iconColor}`} />
        </div>
      </div>
      <h3 className="text-white text-lg font-bold mb-2">{title}</h3>
      <p className="text-gray-500 text-sm max-w-sm mb-5 leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all hover:shadow-lg hover:shadow-violet-500/30 active:scale-95"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
