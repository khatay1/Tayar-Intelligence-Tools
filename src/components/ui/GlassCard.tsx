import { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export default function GlassCard({ children, className = '', hover = false }: GlassCardProps) {
  return (
    <div
      className={`bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl ${
        hover ? 'hover:border-violet-500/30 hover:bg-white/[0.05] transition-all duration-300' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}
