import React from 'react';
import { AlertCircle, Check, CheckCircle2, Loader2, Target, TrendingUp } from 'lucide-react';
import { CVATSReport } from '../quality/cv-ats';

interface Props {
  jobDescription: string;
  setJobDescription: (value: string) => void;
  report: CVATSReport;
  loading?: boolean;
  onAnalyze?: () => void;
}

export function CVJobMatchPanel({ jobDescription, setJobDescription, report, loading, onAnalyze }: Props) {
  const total = report.keywords.length;
  const matched = report.matchedKeywords.length;
  const percent = total ? Math.round((matched / total) * 100) : 0;
  return <div className="space-y-4">
    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3"><div className="flex items-center gap-2 mb-1"><Target className="w-4 h-4 text-blue-400" /><h3 className="text-white text-sm font-semibold">Job Match Analysis</h3></div><p className="text-gray-400 text-xs">Compare your CV with a target job description. Missing terms are review prompts, not claims about your experience.</p></div>
    <textarea className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white min-h-[150px] resize-y outline-none focus:border-blue-500/50" value={jobDescription} onChange={e => setJobDescription(e.target.value)} placeholder="Paste the job description here..." />
    <button onClick={onAnalyze} disabled={loading || !jobDescription.trim()} className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />} Analyze Match</button>
    {!!total && <><div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 text-center"><div className="text-3xl font-bold text-white">{percent}%</div><div className="text-gray-400 text-xs mt-1">Keyword coverage ({matched}/{total})</div></div>
    {!!report.missingKeywords.length && <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3"><h4 className="text-red-400 text-xs font-semibold mb-2 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> Verify relevant missing keywords</h4><div className="flex flex-wrap gap-1.5">{report.missingKeywords.map(keyword => <span key={keyword} className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded px-2 py-0.5">{keyword}</span>)}</div></div>}
    {!!report.matchedKeywords.length && <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3"><h4 className="text-emerald-400 text-xs font-semibold mb-2 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Matched keywords</h4><div className="flex flex-wrap gap-1.5">{report.matchedKeywords.map(keyword => <span key={keyword} className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-0.5">{keyword}</span>)}</div></div>}
    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3"><h4 className="text-white text-xs font-semibold mb-2 flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-violet-400" />Safe tailoring guidance</h4><div className="text-gray-400 text-xs flex items-start gap-2"><Check className="w-3 h-3 text-violet-400 mt-0.5" />Only add missing keywords when they truthfully describe your skills or experience.</div></div></>}
  </div>;
}
