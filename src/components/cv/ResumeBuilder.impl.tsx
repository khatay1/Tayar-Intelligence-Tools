import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, ChevronDown, Copy, Download, FileDown, FileText, History, Loader2, Mail, Palette, Redo2, Sparkles, Undo2, Wand2, X, Zap, ZoomIn, ZoomOut } from 'lucide-react';
import { AI_ACTIONS, AIAction, calculateResumeScore, generateSuggestions } from '@/lib/cv-ai';
import { CVData, TEMPLATES, TemplateId, uid } from '@/lib/cv-types';
import { exportToDOCX, exportToPDF, exportToTXT } from '@/lib/cv-export';
import { createAIService, AIError } from '@/lib/ai/service';
import { supabase } from '@/lib/supabase';
import { useLocalizer } from '@/lib/ui-localization';
import { useAuth } from '@/context/AuthContext';
import { usePreferences } from '@/context/PreferencesContext';
import { useToast } from '@/components/ui/Toast';
import { useProjects } from '@/lib/use-projects';
import CVPreview from './CVPreview';
import AIScorePanel from './AIScorePanel';
import { CVBuilderPanel, CVBuilderShell } from './core/CVBuilderShell';
import { useCVBuilderIntegration } from './core/use-cv-builder-integration';
import { useCVEditor } from './core/use-cv-editor';
import { useCVKeyboard } from './core/use-cv-keyboard';
import { createAchievementProposals, createSkillProposals, CVProposal } from './ai/cv-proposals';

interface ResumeBuilderProps { onBack: () => void; }
type Phase = 'template-select' | 'builder';
type EditSection = 'personal' | 'summary' | 'experience' | 'education' | 'skills' | 'languages' | 'projects' | 'certificates' | 'awards';

const editSections: { id: EditSection; label: string }[] = [
  { id: 'personal', label: 'Personal Info' }, { id: 'summary', label: 'Summary' }, { id: 'experience', label: 'Experience' },
  { id: 'education', label: 'Education' }, { id: 'skills', label: 'Skills' }, { id: 'languages', label: 'Languages' },
  { id: 'projects', label: 'Projects' }, { id: 'certificates', label: 'Certifications' }, { id: 'awards', label: 'Awards' },
];
const panels: { id: CVBuilderPanel; label: string; icon: React.ElementType }[] = [
  { id: 'edit', label: 'Edit', icon: FileText }, { id: 'design', label: 'Design', icon: Palette }, { id: 'ai', label: 'AI Assistant', icon: Sparkles },
  { id: 'job', label: 'Job Match', icon: Zap }, { id: 'versions', label: 'History', icon: History },
];

export default function ResumeBuilder({ onBack }: ResumeBuilderProps) {
  const l = useLocalizer();
  const { prefs } = usePreferences();
  const { user } = useAuth();
  const toast = useToast();
  const projectApi = useProjects();
  const projects = useMemo(() => ({ createProject: projectApi.createProject, saveProject: projectApi.saveProject, createFileEntry: projectApi.createFileEntry, logActivity: projectApi.logActivity }), [projectApi.createProject, projectApi.saveProject, projectApi.createFileEntry, projectApi.logActivity]);
  const [phase, setPhase] = useState<Phase>('template-select');
  const [activePanel, setActivePanel] = useState<CVBuilderPanel>('edit');
  const [editSection, setEditSection] = useState<EditSection>('personal');
  const [zoom, setZoom] = useState(1);
  const [exportMenu, setExportMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [coverLetter, setCoverLetter] = useState<string | null>(null);
  const [coverLetterCompany, setCoverLetterCompany] = useState('');
  const [showCoverLetter, setShowCoverLetter] = useState(false);

  const builder = useCVBuilderIntegration({ supabase, projects, userId: user?.id, enabled: phase === 'builder' });
  const editor = useCVEditor(builder.cv, builder.setData);
  const score = useMemo(() => calculateResumeScore(builder.cv), [builder.cv]);
  const suggestions = useMemo(() => generateSuggestions(builder.cv), [builder.cv]);

  useEffect(() => { builder.setAtsScore(score.ats); }, [score.ats, builder.setAtsScore]);
  useEffect(() => { if (activePanel === 'versions') void builder.versions.load(); }, [activePanel, builder.versions.load]);
  useCVKeyboard({ enabled: phase === 'builder', undo: builder.undo, redo: builder.redo, save: builder.flushAutosave });

  const chooseTemplate = (template: TemplateId) => {
    builder.setTemplate(template);
    setPhase('builder');
    toast.success('Template selected');
  };

  const addTextProposal = useCallback((proposal: Omit<CVProposal, 'id' | 'requiresVerification'>) => {
    builder.proposals.addProposals([{ ...proposal, id: uid(), requiresVerification: true }]);
  }, [builder.proposals.addProposals]);

  async function handleAIAction(action: AIAction) {
    if (aiLoading) return;
    setAiLoading(action);
    const ai = createAIService('cv-builder');
    try {
      if (action === 'suggest-skills') {
        const res = await ai.complete({ action, jobTitle: builder.cv.personal.jobTitle, skills: builder.cv.skills.map(s => s.name), experiences: builder.cv.experience });
        builder.proposals.addProposals(createSkillProposals(builder.cv, res.content.split(/,|\n/)));
      } else if (action === 'generate-achievements') {
        const exp = builder.cv.experience[0];
        if (!exp) throw new Error('Add an experience entry first');
        const res = await ai.complete({ action, jobTitle: builder.cv.personal.jobTitle, company: exp.company, description: exp.description });
        builder.proposals.addProposals(createAchievementProposals(exp.id, res.content.split('\n').map(v => v.replace(/^[-•*]\s*/, ''))));
      } else if (action === 'optimize-ats') {
        const res = await ai.complete({ action, summary: builder.cv.summary, jobTitle: builder.cv.personal.jobTitle });
        addTextProposal({ kind: 'text-rewrite', section: 'summary', before: builder.cv.summary, proposed: res.content.trim(), reason: 'AI ATS rewrite. Verify that every statement remains accurate.' });
      } else if (['rewrite-experience', 'shorten-text', 'expand-text'].includes(action)) {
        if (!builder.cv.experience.length) throw new Error('Add experience first');
        const res = await ai.complete(action === 'rewrite-experience' ? { action, experiences: builder.cv.experience } : { action, text: builder.cv.experience.map(e => e.description).join('\n\n') });
        const blocks = res.content.trim().split(/\n\s*\n/);
        builder.proposals.addProposals(builder.cv.experience.map((exp, i) => ({ id: uid(), kind: 'text-rewrite' as const, section: 'experience' as const, itemId: exp.id, before: exp.description, proposed: blocks[i]?.trim() || exp.description, reason: 'AI rewrite. Review wording and factual accuracy before applying.', requiresVerification: true })));
      } else if (action === 'improve-grammar') {
        const text = [builder.cv.summary, ...builder.cv.experience.map(e => e.description)].join('\n\n');
        if (!text.trim()) throw new Error('Add some content first');
        const res = await ai.complete({ action, text });
        const blocks = res.content.trim().split(/\n\s*\n/);
        if (blocks[0]) addTextProposal({ kind: 'text-rewrite', section: 'summary', before: builder.cv.summary, proposed: blocks[0], reason: 'AI grammar edit. Verify meaning before applying.' });
        builder.proposals.addProposals(builder.cv.experience.map((exp, i) => ({ id: uid(), kind: 'text-rewrite' as const, section: 'experience' as const, itemId: exp.id, before: exp.description, proposed: blocks[i + 1]?.trim() || exp.description, reason: 'AI grammar edit. Verify meaning before applying.', requiresVerification: true })));
      }
      setActivePanel('ai');
      toast.success('AI suggestions ready for review');
    } catch (err) {
      toast.error(err instanceof AIError || err instanceof Error ? err.message : 'AI request failed');
    } finally { setAiLoading(null); }
  }

  async function generateCoverLetter() {
    if (aiLoading) return;
    setAiLoading('generate-cover-letter');
    try {
      const res = await createAIService('cv-builder').complete({ action: 'generate-cover-letter', cv: builder.cv, jobDescription: builder.jobDescription, company: coverLetterCompany });
      setCoverLetter(res.content.trim()); setShowCoverLetter(true);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Cover letter generation failed'); }
    finally { setAiLoading(null); }
  }

  async function handleExport(format: 'pdf' | 'docx' | 'txt') {
    if (exporting) return;
    setExportMenu(false); setExporting(true);
    try {
      if (format === 'pdf') await exportToPDF();
      else if (format === 'docx') await Promise.resolve(exportToDOCX(builder.cv, builder.template, builder.colorTheme, prefs.language));
      else await Promise.resolve(exportToTXT(builder.cv, prefs.language));
      if (user && builder.persistence.projectId) await projectApi.logActivity(`Exported resume as ${format.toUpperCase()}`, 'cv-builder');
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch { toast.error(`Failed to export as ${format.toUpperCase()}`); }
    finally { setExporting(false); }
  }

  if (phase === 'template-select') return <div className="min-h-screen bg-[#06060f] text-white"><header className="flex items-center gap-3 px-4 sm:px-8 py-4 border-b border-white/5"><button type="button" aria-label="Back" onClick={onBack} className="p-2 text-gray-400 hover:text-white"><ArrowLeft className="w-5 h-5" /></button><div><h1 className="font-bold">{l('Choose a Template')}</h1><p className="text-gray-500 text-xs">{l('Pick a design — you can change it anytime')}</p></div></header><main className="max-w-6xl mx-auto p-4 sm:p-8"><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{TEMPLATES.map(t => <button type="button" key={t.id} onClick={() => chooseTemplate(t.id)} className="text-left rounded-2xl border border-white/10 hover:border-violet-500/40 bg-white/[0.02] p-5"><div className="aspect-[3/2] rounded-xl bg-gradient-to-br from-white/10 to-violet-500/10 mb-4 flex items-center justify-center"><FileText className="w-12 h-12 text-violet-300/60" /></div><h3 className="font-semibold">{t.name}</h3><p className="text-gray-500 text-xs mt-1">{t.description}</p></button>)}</div></main></div>;

  const saveLabel = builder.saveStatus === 'saving' ? 'Saving…' : builder.saveStatus === 'error' ? 'Save error' : builder.saveStatus === 'dirty' ? 'Unsaved changes' : builder.saveStatus === 'saved' ? 'All changes saved' : 'Auto-save on';
  return <div className="min-h-screen bg-[#06060f] flex flex-col text-white">
    <header className="flex items-center justify-between gap-3 px-3 sm:px-4 py-3 border-b border-white/5 bg-[#0a0a1a]/90 sticky top-0 z-40">
      <div className="flex items-center gap-2 min-w-0"><button type="button" aria-label="Choose template" onClick={() => setPhase('template-select')} className="p-2 text-gray-400 hover:text-white"><ArrowLeft className="w-5 h-5" /></button><div className="min-w-0"><h1 className="font-bold text-sm truncate">{l('Resume Builder')}</h1><p className={`text-xs flex items-center gap-1 ${builder.saveStatus === 'error' ? 'text-red-400' : 'text-gray-500'}`}>{builder.saveStatus === 'saving' ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}{saveLabel}</p></div></div>
      <div className="flex items-center gap-1.5"><button type="button" aria-label="Undo" disabled={!builder.canUndo} onClick={builder.undo} className="p-2 disabled:opacity-30"><Undo2 className="w-4 h-4" /></button><button type="button" aria-label="Redo" disabled={!builder.canRedo} onClick={builder.redo} className="p-2 disabled:opacity-30"><Redo2 className="w-4 h-4" /></button><button type="button" onClick={() => void builder.versions.saveCurrent()} className="hidden sm:flex items-center gap-1 px-3 py-2 border border-white/10 rounded-lg text-xs"><History className="w-3.5 h-3.5" />Save Version</button><div className="relative"><button type="button" disabled={exporting} onClick={() => setExportMenu(v => !v)} className="flex items-center gap-1.5 bg-violet-600 px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-50">{exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}Export<ChevronDown className="w-3 h-3" /></button>{exportMenu && <div className="absolute right-0 mt-1 w-40 bg-[#12122a] border border-white/10 rounded-xl p-1.5 z-50">{(['pdf','docx','txt'] as const).map(format => <button type="button" key={format} onClick={() => void handleExport(format)} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 rounded-lg">{format === 'docx' ? <FileDown className="w-4 h-4" /> : <FileText className="w-4 h-4" />}{format.toUpperCase()}</button>)}</div>}</div></div>
    </header>
    <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
      <aside className="w-full lg:w-[430px] lg:flex-shrink-0 border-b lg:border-b-0 lg:border-r border-white/5 flex flex-col max-h-[55vh] lg:max-h-none">
        <div className="flex gap-1 p-2 overflow-x-auto border-b border-white/5">{panels.map(p => { const Icon=p.icon; return <button type="button" key={p.id} onClick={() => setActivePanel(p.id)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs whitespace-nowrap ${activePanel===p.id?'bg-violet-600':'text-gray-400 hover:bg-white/5'}`}><Icon className="w-3.5 h-3.5" />{l(p.label)}</button>; })}</div>
        <div className="flex-1 overflow-y-auto p-4">
          {activePanel === 'edit' && <div className="flex flex-wrap gap-1 mb-4">{editSections.map(s => <button type="button" key={s.id} onClick={() => setEditSection(s.id)} className={`text-xs px-3 py-1.5 rounded-lg border ${editSection===s.id?'bg-violet-600/20 text-violet-300 border-violet-500/30':'text-gray-400 border-transparent hover:bg-white/5'}`}>{l(s.label)}</button>)}</div>}
          {activePanel === 'ai' && <div className="space-y-3 mb-4"><div className="grid grid-cols-2 gap-2">{AI_ACTIONS.filter(a => !['match-job','generate-cover-letter'].includes(a.id)).map(a => <button type="button" key={a.id} disabled={!!aiLoading} onClick={() => void handleAIAction(a.id)} className="text-left p-3 rounded-xl border border-white/10 hover:border-violet-500/30 disabled:opacity-50"><Wand2 className="w-4 h-4 text-violet-400 mb-1" /><div className="text-xs font-medium">{l(a.label)}</div><div className="text-[10px] text-gray-500">{a.description}</div></button>)}</div>{aiLoading && <div role="status" className="text-xs text-violet-300 flex gap-2"><Loader2 className="w-4 h-4 animate-spin" />Processing with AI…</div>}<div className="border-t border-white/10 pt-3 space-y-2"><input aria-label="Cover letter company" value={coverLetterCompany} onChange={e => setCoverLetterCompany(e.target.value)} placeholder="Company name (optional)" className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm" /><button type="button" disabled={!!aiLoading} onClick={() => void generateCoverLetter()} className="w-full bg-fuchsia-600 rounded-lg py-2 text-sm disabled:opacity-50"><Mail className="inline w-4 h-4 mr-2" />Generate Cover Letter</button></div><AIScorePanel score={score} suggestions={suggestions} /></div>}
          <CVBuilderShell panel={activePanel} editSection={editSection} cv={builder.cv} template={builder.template} colorTheme={builder.colorTheme} fontId={builder.fontId} sections={builder.sections} editor={editor} setCV={builder.setData} setTemplate={builder.setTemplate} setColorTheme={builder.setColorTheme} setFontId={builder.setFontId} sectionsController={builder.sectionsController} jobDescription={builder.jobDescription} setJobDescription={builder.setJobDescription} ats={builder.quality.ats} proposals={builder.proposals.proposals} onVerifyProposal={builder.proposals.verifyAndApply} onDismissProposal={builder.proposals.dismiss} versions={builder.versions.versions} versionsLoading={builder.versions.loading} onSaveVersion={builder.versions.saveCurrent} onRestoreVersion={builder.versions.restore} />
        </div>
      </aside>
      <main className="flex-1 min-w-0 bg-[#0a0a14] flex flex-col min-h-[45vh]">
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/5"><div className="flex items-center gap-1"><button type="button" aria-label="Zoom out" onClick={() => setZoom(v => Math.max(.5, v-.1))} className="p-2"><ZoomOut className="w-4 h-4" /></button><span className="text-xs text-gray-400 w-12 text-center">{Math.round(zoom*100)}%</span><button type="button" aria-label="Zoom in" onClick={() => setZoom(v => Math.min(2, v+.1))} className="p-2"><ZoomIn className="w-4 h-4" /></button><button type="button" onClick={() => setZoom(1)} className="text-xs text-gray-500 px-2">Reset</button></div><div className="text-xs px-2.5 py-1 rounded-full border border-white/10"><Zap className="inline w-3 h-3 mr-1" />ATS {score.ats}/100</div></div>
        <div className="flex-1 overflow-auto p-4 sm:p-8"><div className="mx-auto shadow-2xl bg-white origin-top transition-transform" style={{ width:'210mm', minHeight:'297mm', transform:`scale(${zoom})`, transformOrigin:'top center' }}><CVPreview data={builder.cv} template={builder.template} colorTheme={builder.colorTheme} sections={builder.sections} fontId={builder.fontId} /></div></div>
      </main>
    </div>
    <div className="hidden print:block"><CVPreview data={builder.cv} template={builder.template} colorTheme={builder.colorTheme} sections={builder.sections} fontId={builder.fontId} /></div>
    {showCoverLetter && coverLetter && <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-4" onClick={() => setShowCoverLetter(false)}><div role="dialog" aria-modal="true" className="bg-[#0a0a1a] border border-white/10 rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}><div className="flex justify-between items-center p-4 border-b border-white/10"><h3 className="font-bold">Cover Letter</h3><div><button type="button" onClick={() => void navigator.clipboard.writeText(coverLetter).then(() => toast.success('Copied')).catch(() => toast.error('Copy failed'))} className="p-2"><Copy className="w-4 h-4" /></button><button type="button" aria-label="Close" onClick={() => setShowCoverLetter(false)} className="p-2"><X className="w-4 h-4" /></button></div></div><div className="p-5 overflow-y-auto whitespace-pre-wrap text-sm text-gray-300">{coverLetter}</div></div></div>}
  </div>;
}
