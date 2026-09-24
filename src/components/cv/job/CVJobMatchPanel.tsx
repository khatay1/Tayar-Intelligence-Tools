import React from 'react';
import { AlertCircle, Check, CheckCircle2, Loader2, Target, TrendingUp } from 'lucide-react';
import { CVATSReport } from '../quality/cv-ats';
import { useCVText } from '../i18n/use-cv-text';

interface Props { jobDescription: string; setJobDescription: (value: string) => void; report: CVATSReport; loading?: boolean; onAnalyze?: () => void; }

export function CVJobMatchPanel({ jobDescription, setJobDescription, report, loading, onAnalyze }: Props) {
  const t = useCVText();
  const total = report.keywords.length;
  const matched = report.matchedKeywords.length;
  const percent = total ? Math.round((matched / total) * 100) : 0;
  const canAnalyze = !!jobDescription.trim() && !loading;
  return <div className="space-y-4">
    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3"><div className="flex items-center gap-2 mb-1"><Target aria-hidden="true" className="w-4 h-4 text-blue-400" /><h3 className="text-white text-sm font-semibold">{t('Job Match Analysis')}</h3></div><p className="text-gray-400 text-xs">{t('Compare your CV with a target job description. Missing terms are review prompts, not claims about your experience.')}</p></div>
    <textarea aria-label={t('Target job description')} className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white min-h-[150px] resize-y outline-none focus:border-blue-500/50" value={jobDescription} onChange={e => setJobDescription(e.target.value)} placeholder={t('Paste the job description here...')} />
    {onAnalyze && <button type="button" onClick={onAnalyze} disabled={!canAnalyze} className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl">{loading ? <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin" /> : <Target aria-hidden="true" className="w-4 h-4" />} {t('Analyze Match')}</button>}
    {!total && jobDescription.trim() && !onAnalyze && <p className="text-gray-500 text-xs" role="status">{t('Analysis updates automatically as you edit the job description or CV.')}</p>}
    {!!total && <><div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 text-center" role="status" aria-label={`${percent}% keyword coverage, ${matched} of ${total} keywords matched`}><div className="text-3xl font-bold text-white">{percent}%</div><div className="text-gray-400 text-xs mt-1">{t('Keyword coverage')} ({matched}/{total})</div></div>
    {!!report.missingKeywords.length && <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3"><h4 className="text-red-400 text-xs font-semibold mb-2 flex items-center gap-1.5"><AlertCircle aria-hidden="true" className="w-3.5 h-3.5" /> {t('Verify relevant missing keywords')}</h4><div className="flex flex-wrap gap-1.5">{report.missingKeywords.map(keyword => <span key={keyword} className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded px-2 py-0.5">{keyword}</span>)}</div></div>}
    {!!report.matchedKeywords.length && <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3"><h4 className="text-emerald-400 text-xs font-semibold mb-2 flex items-center gap-1.5"><CheckCircle2 aria-hidden="true" className="w-3.5 h-3.5" /> {t('Matched keywords')}</h4><div className="flex flex-wrap gap-1.5">{report.matchedKeywords.map(keyword => <span key={keyword} className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-0.5">{keyword}</span>)}</div></div>}
    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3"><h4 className="text-white text-xs font-semibold mb-2 flex items-center gap-1.5"><TrendingUp aria-hidden="true" className="w-3.5 h-3.5 text-violet-400" />{t('Safe tailoring guidance')}</h4><div className="text-gray-400 text-xs flex items-start gap-2"><Check aria-hidden="true" className="w-3 h-3 text-violet-400 mt-0.5" />{t('Only add missing keywords when they truthfully describe your skills or experience.')}</div></div></>}
  </div>;
}