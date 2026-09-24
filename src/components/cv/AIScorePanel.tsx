import { useLocalizer } from '@/lib/ui-localization';
import { ResumeScore } from '@/lib/cv-types';
import { AISuggestion } from '@/lib/cv-ai';
import { AlertCircle, CheckCircle2, Info, Lightbulb } from 'lucide-react';

interface AIScorePanelProps {
  score: ResumeScore;
  suggestions: AISuggestion[];
}

function normalizeScore(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0;
}

function ScoreRing({ score, label, size = 80 }: { score: number; label: string; size?: number }) {
  const safeScore = normalizeScore(score);
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safeScore / 100) * circumference;
  const color = safeScore >= 80 ? '#10b981' : safeScore >= 60 ? '#f59e0b' : safeScore >= 40 ? '#f97316' : '#ef4444';

  return (
    <div className="flex flex-col items-center gap-1" role="meter" aria-label={`${label} score`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={safeScore}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg aria-hidden="true" width={size} height={size} className="transform -rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth="6" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center"><span className="text-lg font-bold text-white">{safeScore}</span></div>
      </div>
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  );
}

export default function AIScorePanel({ score, suggestions }: AIScorePanelProps) {
  const l = useLocalizer();
  const overall = normalizeScore(score.overall);
  const overallColor = overall >= 80 ? 'text-emerald-400' : overall >= 60 ? 'text-amber-400' : overall >= 40 ? 'text-orange-400' : 'text-red-400';
  const overallLabel = overall >= 80 ? 'Excellent' : overall >= 60 ? 'Good' : overall >= 40 ? 'Needs Work' : 'Poor';

  return <div className="space-y-4">
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4"><h3 className="text-white font-semibold text-sm">{l('Resume Score')}</h3><span className={`text-xs font-medium ${overallColor}`}>{l(overallLabel)}</span></div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <ScoreRing score={score.ats} label="ATS" size={68} /><ScoreRing score={score.grammar} label={l('Grammar')} size={68} /><ScoreRing score={score.completeness} label={l('Complete')} size={68} /><ScoreRing score={score.professionalism} label={l('Prof.')} size={68} /><ScoreRing score={score.readability} label={l('Readable')} size={68} /><ScoreRing score={overall} label={l('Overall')} size={68} />
      </div>
    </div>
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3"><Lightbulb aria-hidden="true" className="w-4 h-4 text-violet-400" /><h3 className="text-white font-semibold text-sm">{l('AI Suggestions')}</h3><span className="text-xs text-gray-500 ml-auto" aria-label={`${suggestions.length} suggestions`}>{suggestions.length}</span></div>
      {suggestions.length === 0 ? <div className="flex items-center gap-2 text-sm text-emerald-400 py-2" role="status"><CheckCircle2 aria-hidden="true" className="w-4 h-4" />{l('Your resume looks great! No issues found.')}</div> : <div className="space-y-2 max-h-64 overflow-y-auto pr-1">{suggestions.map((s, i) => {
        const config = { high: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/5', border: 'border-red-500/20' }, medium: { icon: Info, color: 'text-amber-400', bg: 'bg-amber-500/5', border: 'border-amber-500/20' }, low: { icon: Info, color: 'text-sky-400', bg: 'bg-sky-500/5', border: 'border-sky-500/20' } };
        const c = config[s.severity] ?? config.low;
        const Icon = c.icon;
        return <div key={`${s.title}-${s.description}-${i}`} className={`flex items-start gap-2 p-3 rounded-xl ${c.bg} border ${c.border}`}><Icon aria-hidden="true" className={`w-4 h-4 ${c.color} flex-shrink-0 mt-0.5`} /><div className="flex-1 min-w-0"><p className="text-white text-xs font-medium">{s.title}</p><p className="text-gray-400 text-xs mt-0.5 leading-relaxed">{s.description}</p></div></div>;
      })}</div>}
    </div>
  </div>;
}
