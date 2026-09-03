// Premium AI Loading Component
// Displays animated loading states while AI is generating content.

import { Sparkles } from 'lucide-react';
import { useLocalizer } from '@/lib/ui-localization';

interface AILoadingProps {
  label?: string;
  variant?: 'inline' | 'full' | 'minimal';
}

export function AILoading({ label, variant = 'inline' }: AILoadingProps) {
  const l = useLocalizer();
  const displayLabel = label ?? l('AI is thinking');
  if (variant === 'minimal') {
    return (
      <div className="flex items-center gap-2 text-violet-400 text-sm">
        <div className="relative w-4 h-4">
          <div className="absolute inset-0 rounded-full border-2 border-violet-500/20" />
          <div className="absolute inset-0 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
        </div>
        <span>{displayLabel}...</span>
      </div>
    );
  }

  if (variant === 'full') {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full bg-violet-600/10 animate-pulse" />
          <div className="absolute inset-0 rounded-full border-2 border-violet-500/20" />
          <div className="absolute inset-0 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" style={{ animationDuration: '0.8s' }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-violet-400 animate-pulse" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-white text-sm font-medium">{displayLabel}...</p>
          <div className="flex items-center justify-center gap-1 mt-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 text-violet-400 text-sm py-2">
      <div className="relative w-5 h-5">
        <div className="absolute inset-0 rounded-full border-2 border-violet-500/20" />
        <div className="absolute inset-0 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" style={{ animationDuration: '0.8s' }} />
      </div>
      <span>{displayLabel}...</span>
      <span className="flex gap-0.5">
        <span className="w-1 h-1 rounded-full bg-violet-400 animate-pulse" />
        <span className="w-1 h-1 rounded-full bg-violet-400 animate-pulse" style={{ animationDelay: '200ms' }} />
        <span className="w-1 h-1 rounded-full bg-violet-400 animate-pulse" style={{ animationDelay: '400ms' }} />
      </span>
    </div>
  );
}

// Streaming text indicator — shows while text is being streamed
export function AIStreamingIndicator() {
  return (
    <span className="inline-flex items-center gap-1 ml-0.5">
      <span className="w-0.5 h-3.5 bg-violet-400 animate-pulse" />
    </span>
  );
}

// Shimmer effect for loading placeholders
export function AIShimmer({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 rounded-lg bg-gradient-to-r from-white/5 via-white/10 to-white/5 animate-pulse"
          style={{ width: `${100 - i * 15}%`, animationDelay: `${i * 100}ms` }}
        />
      ))}
    </div>
  );
}
