import { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import AstronautLogo from '@/components/ui/AstronautLogo';

interface AuthLayoutProps {
  children: ReactNode;
  onBack: () => void;
}

export default function AuthLayout({ children, onBack }: AuthLayoutProps) {
  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-12 overflow-hidden bg-[#06060f]">
      {/* Starfield */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,rgba(120,80,255,0.25),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_100%_100%,rgba(80,40,180,0.15),transparent_50%)]" />
        {[...Array(60)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: Math.random() * 2 + 1 + 'px',
              height: Math.random() * 2 + 1 + 'px',
              top: Math.random() * 100 + '%',
              left: Math.random() * 100 + '%',
              opacity: Math.random() * 0.6 + 0.1,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo + Back */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2.5">
            <AstronautLogo size={36} />
            <span className="text-white font-bold text-base">Tayar Intelligence</span>
          </div>
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        </div>

        {/* Glass card */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl shadow-black/50">
          {children}
        </div>
      </div>
    </div>
  );
}
