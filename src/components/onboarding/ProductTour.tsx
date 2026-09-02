import { useLocalizer } from '@/lib/ui-localization';
import { useState, useEffect, useRef } from 'react';
import { ArrowRight, ArrowLeft, X, Check, SkipForward } from 'lucide-react';
import { useOnboarding } from '@/context/OnboardingContext';
import { TOUR_STEPS } from '@/lib/onboarding-types';

interface ProductTourProps {
  onNavigate: (view: string) => void;
  onComplete: () => void;
}

export default function ProductTour({ onNavigate, onComplete }: ProductTourProps) {
  const l = useLocalizer();
  const { recordTourStep, completeTour, skipTour } = useOnboarding();
  const [stepIdx, setStepIdx] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const step = TOUR_STEPS[stepIdx];

  useEffect(() => {
    function updateTarget() {
      const el = document.querySelector(step.target) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
          const rect = el.getBoundingClientRect();
          setTargetRect(rect);
        }, 400);
      } else {
        setTargetRect(null);
      }
    }
    updateTarget();
    window.addEventListener('resize', updateTarget);
    window.addEventListener('scroll', updateTarget);
    return () => {
      window.removeEventListener('resize', updateTarget);
      window.removeEventListener('scroll', updateTarget);
    };
  }, [stepIdx, step.target]);

  async function next() {
    await recordTourStep(step.id);
    if (stepIdx < TOUR_STEPS.length - 1) {
      setStepIdx(stepIdx + 1);
    } else {
      await completeTour();
      onComplete();
    }
  }

  async function prev() {
    if (stepIdx > 0) setStepIdx(stepIdx - 1);
  }

  async function skip() {
    await skipTour();
    onComplete();
  }

  // Navigate to the view where the tour element lives
  useEffect(() => {
    const viewMap: Record<string, string> = {
      'dashboard': 'dashboard',
      'workspace': 'my-workspace',
      'files': 'my-files',
      'ai-chat': 'ai-chat',
      'cv-builder': 'cv-builder',
    };
    onNavigate(viewMap[step.id] || 'dashboard');
  }, [stepIdx, step.id, onNavigate]);

  const padding = 8;
  const tooltipPos = targetRect
    ? {
        top: targetRect.bottom + window.scrollY + padding,
        left: Math.max(16, Math.min(
          targetRect.left + window.scrollX + targetRect.width / 2 - 180,
          window.innerWidth - 380
        )),
      }
    : { top: window.innerHeight / 2, left: window.innerWidth / 2 - 180 };

  return (
    <div className="fixed inset-0 z-[200]" ref={overlayRef}>
      {/* Spotlight overlay */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'hidden' }}>
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left - padding}
                y={targetRect.top - padding}
                width={targetRect.width + padding * 2}
                height={targetRect.height + padding * 2}
                rx="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(6,6,15,0.85)" mask="url(#tour-mask)" />
      </svg>

      {/* Highlight border around target */}
      {targetRect && (
        <div
          className="absolute pointer-events-none border-2 border-violet-500 rounded-xl transition-all duration-300"
          style={{
            top: targetRect.top - padding,
            left: targetRect.left - padding,
            width: targetRect.width + padding * 2,
            height: targetRect.height + padding * 2,
            boxShadow: '0 0 20px rgba(139,92,246,0.4), 0 0 40px rgba(139,92,246,0.2)',
          }}
        />
      )}

      {/* Tooltip */}
      <div
        className="absolute w-[360px] bg-[#12122a] border border-white/10 rounded-2xl shadow-2xl p-5"
        style={{ ...tooltipPos, animation: 'fadeInUp 0.3s ease-out' }}
      >
        {/* Step indicator */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            {TOUR_STEPS.map((s, i) => (
              <div
                key={s.id}
                className={`h-1.5 rounded-full transition-all ${
                  i === stepIdx ? 'w-6 bg-violet-500' : i < stepIdx ? 'w-1.5 bg-violet-500/50' : 'w-1.5 bg-white/10'
                }`}
              />
            ))}
          </div>
          <button onClick={skip} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <h3 className="text-white font-bold text-base mb-1.5">{l(step.title)}</h3>
        <p className="text-gray-400 text-sm leading-relaxed mb-4">{l(step.description)}</p>

        <div className="flex items-center justify-between">
          <button onClick={skip} className="flex items-center gap-1 text-gray-500 hover:text-white text-xs transition-colors">
            <SkipForward className="w-3 h-3" /> {l('Skip tour')}
          </button>
          <div className="flex items-center gap-2">
            {stepIdx > 0 && (
              <button onClick={prev} className="flex items-center gap-1 text-gray-400 hover:text-white text-xs transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" /> {l('Back')}
              </button>
            )}
            <button
              onClick={next}
              className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              {stepIdx === TOUR_STEPS.length - 1 ? <><Check className="w-3.5 h-3.5" /> {l('Finish')}</> : <>{l('Next')} <ArrowRight className="w-3.5 h-3.5" /></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
