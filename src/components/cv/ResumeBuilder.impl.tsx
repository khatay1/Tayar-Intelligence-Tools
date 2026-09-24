import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronDown, Copy, Download, FileText, History, Loader2, Mail, Palette, Redo2, Sparkles, Undo2, Wand2, X, Zap, ZoomIn, ZoomOut } from 'lucide-react';
import { AI_ACTIONS, AIAction, calculateResumeScore, generateSuggestions } from '@/lib/cv-ai';
import { TEMPLATES, TemplateId, uid } from '@/lib/cv-types';
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
  const [aiLoading, setAiLoading] = useState<AIAction | null>(null);
  const [coverLetter, setCoverLetter] = useState<string | null>(null);
  const [coverLetterCompany, setCoverLetterCompany] = useState('');
  const [showCoverLetter, setShowCoverLetter] = useState(false);

  const builder = useCVBuilderIntegration({ supabase, projects, userId: user?.id, enabled: phase === 'builder' });
  const score = useMemo(() => calculateResumeScore(builder.cv), [builder.cv]);
  const suggestions = useMemo(() => generateSuggestions(builder.cv), [builder.cv]);
  const setAtsScore = builder.setAtsScore;
  const loadVersions = builder.versions.load;

  useEffect(() => { setAtsScore(score.ats); }, [score.ats, setAtsScore]);
  useEffect(() => { if (activePanel === 'versions') void loadVersions(); }, [activePanel, loadVersions]);
  useCVKeyboard({ enabled: phase === 'builder', undo: builder.undo, redo: builder.redo, save: builder.flushAutosave });

  const chooseTemplate = (template: TemplateId) => {
    builder.setTemplate(template);
    setPhase('builder');
    toast.success(l('Template selected'));
  };

  const addTextProposal = useCallback((proposal: Omit<CVProposal, 'id' | 'requiresVerification'>) => {
    builder.proposals.addProposals([{ ...proposal, id: uid(), requiresVerification: true }]);
  }, [builder.proposals.addProposals]);

  async function handleAIAction(action: AIAction) {
    if (aiLoading) return;
    if (action === 'match-job') { setActivePanel('job'); return; }
    setAiLoading(action);
    const ai = createAIService('cv-builder');
    try {
      if (action === 'suggest-skills') {
        const res = await ai.complete({ action, jobTitle: builder.cv.personal.jobTitle, skills: builder.cv.skills.map(s => s.name), experiences: builder.cv.experience });
        builder.proposals.addProposals(createSkillProposals(builder.cv, res.content.split(/,|\n/)));
      } else if (action === 'generate-achievements') {
        const exp = builder.cv.experience[0];
        if (!exp) throw new Error(l('Add an experience entry first'));
        const res = await ai.complete({ action, jobTitle: builder.cv.personal.jobTitle, company: exp.company, description: exp.description });
        builder.proposals.addProposals(createAchievementProposals(exp.id, res.content.split('\n').map(v => v.replace(/^[-•*]\s*/, ''))));
      } else if (action === 'optimize-ats') {
        const res = await ai.complete({ action, summary: builder.cv.summary, jobTitle: builder.cv.personal.jobTitle });
        addTextProposal({ kind: 'text-rewrite', section: 'summary', before: builder.cv.summary, proposed: res.content.trim(), reason: l('AI ATS rewrite. Verify that every statement remains accurate.') });
      } else if (action === 'generate-cover-letter') {
        const res = await ai.complete({ action, cv: builder.cv, company: coverLetterCompany });
        setCoverLetter(res.content);
        setShowCoverLetter(true);
      } else if (action === 'rewrite-experience' || action === 'shorten-text' || action === 'expand-text' || action === 'improve-grammar') {
        const exp = builder.cv.experience[0];
        if (!exp) throw new Error(l('Add experience first'));
        const res = await ai.complete(action === 'rewrite-experience' ? { action, experiences: builder.cv.experience } : { action, text: exp.description });
        addTextProposal({ kind: 'text-rewrite', section: 'experience', itemId: exp.id, before: exp.description, proposed: res.content.trim(), reason: l('AI rewrite. Verify every detail before applying.') });
      }
    } catch (error) {
      toast.error(error instanceof AIError ? error.message : error instanceof Error ? error.message : l('AI request failed'));
    } finally { setAiLoading(null); }
  }

  async function doExport(format: 'pdf' | 'docx' | 'txt') {
    if (exporting) return;
    setExporting(true); setExportMenu(false);
    try {
      if (format === 'pdf') exportToPDF();
      else if (format === 'docx') exportToDOCX(builder.cv, builder.template, builder.colorTheme, prefs.language);
      else exportToTXT(builder.cv, prefs.language);
      toast.success(`${format.toUpperCase()} ${l('exported')}`);
    } catch (error) { toast.error(error instanceof Error ? error.message : l('Export failed')); }
    finally { setExporting(false); }
  }

  if (phase === 'template-select') return <div className="min-h-full p-6"><div className="max-w-5xl mx-auto"><button type="button" onClick={onBack} className="text-gray-400 hover:text-white text-sm mb-6 flex items-center gap-2"><ArrowLeft className="w-4 h-4" />{l('Back to Tools')}</button><div className="text-center mb-8"><h1 className="text-3xl font-bold text-white">{l('Choose a Template')}</h1><p className="text-gray-400 mt-2">{l('Select a starting design. You can change it later.')}</p></div><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{TEMPLATES.map(template => <button type="button" key={template.id} onClick={() => chooseTemplate(template.id)} className="text-left bg-white/[0.03] border border-white/10 hover:border-violet-500/40 rounded-2xl p-5 transition"><div className="h-40 rounded-xl bg-white mb-4 flex items-center justify-center text-gray-800 font-bold">{l(template.name)}</div><h3 className="text-white font-semibold">{l(template.name)}</h3><p className="text-gray-500 text-xs mt-1">{l(template.description)}</p></button>)}</div></div></div>;

  return <div className="h-full flex flex-col bg-[#09090f]">
    <header className="h-14 border-b border-white/10 flex items-center px-4 gap-3 flex-shrink-0"><button type="button" aria-label={l('Back to Tools')} onClick={onBack} className="text-gray-400 hover:text-white"><ArrowLeft className="w-5 h-5" /></button><div className="text-white font-semibold flex-1">{builder.cv.personal.fullName || l('Untitled Resume')}</div><span className="text-[10px] text-gray-500" role="status">{l(builder.saveStatus)}</span><button type="button" aria-label={l('Undo')} disabled={!builder.canUndo} onClick={builder.undo}><Undo2 className="w-4 h-4" /></button><button type="button" aria-label={l('Redo')} disabled={!builder.canRedo} onClick={builder.redo}><Redo2 className="w-4 h-4" /></button><button type="button" aria-label={l('Zoom out')} onClick={() => setZoom(v => Math.max(.5, v - .1))}><ZoomOut className="w-4 h-4" /></button><span className="text-xs text-gray-400">{Math.round(zoom * 100)}%</span><button type="button" aria-label={l('Zoom in')} onClick={() => setZoom(v => Math.min(1.5, v + .1))}><ZoomIn className="w-4 h-4" /></button><div className="relative"><button type="button" aria-expanded={exportMenu} onClick={() => setExportMenu(v => !v)} className="bg-violet-600 text-white text-xs px-3 py-2 rounded-lg flex gap-1.5"><Download className="w-3.5 h-3.5" /> {l('Export')} <ChevronDown className="w-3 h-3" /></button>{exportMenu && <div className="absolute right-0 mt-2 w-40 rounded-xl border border-white/10 bg-[#171722] shadow-xl z-50">{(['pdf','docx','txt'] as const).map(f => <button type="button" key={f} disabled={exporting} onClick={() => void doExport(f)} className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/5">{l('Export')} {f.toUpperCase()}</button>)}</div>}</div></header>
    <div className="flex-1 flex min-h-0"><aside className="w-16 border-r border-white/10 flex flex-col items-center py-3 gap-2">{panels.map(p => { const Icon=p.icon; const label=l(p.label); return <button type="button" title={label} aria-label={label} aria-pressed={activePanel===p.id} key={p.id} onClick={() => setActivePanel(p.id)} className={`w-10 h-10 rounded-xl flex items-center justify-center ${activePanel===p.id?'bg-violet-600 text-white':'text-gray-500 hover:bg-white/5'}`}><Icon className="w-4 h-4" /></button>; })}</aside><aside className="w-[390px] border-r border-white/10 overflow-y-auto p-4"><CVBuilderShell panel={activePanel} cv={builder.cv} editor={builder.editor} editSection={editSection} editSections={editSections.map(section => ({ ...section, label: l(section.label) }))} setEditSection={section => setEditSection(section as EditSection)} sections={builder.sections} sectionsController={builder.sectionsController} template={builder.template} colorTheme={builder.colorTheme} fontId={builder.fontId} setTemplate={builder.setTemplate} setColorTheme={builder.setColorTheme} setFontId={builder.setFontId} ats={builder.quality.ats} jobDescription={builder.jobDescription} setJobDescription={builder.setJobDescription} versions={builder.versions.versions} versionsLoading={builder.versions.loading} onSaveVersion={builder.versions.saveCurrent} onRestoreVersion={builder.versions.restore} proposals={builder.proposals.proposals} onVerifyProposal={builder.proposals.verifyAndApply} onDismissProposal={builder.proposals.dismiss} setCV={builder.setData} />{activePanel==='ai' && <div className="mt-5 border-t border-white/10 pt-4 space-y-2"><h3 className="text-white text-xs font-semibold">{l('AI Actions')}</h3>{AI_ACTIONS.map(a => <button type="button" disabled={!!aiLoading} onClick={() => void handleAIAction(a.id)} key={a.id} className="w-full text-left border border-white/10 rounded-lg p-2.5 text-xs text-gray-300 hover:border-violet-500/30 disabled:opacity-50"><div className="flex items-center gap-2"><Wand2 className="w-3.5 h-3.5 text-violet-400" />{l(a.label)}{aiLoading===a.id && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}</div></button>)}</div>}</aside><main className="flex-1 min-w-0 overflow-auto p-8 bg-black/20"><div className="mx-auto origin-top transition-transform" style={{width:794, transform:`scale(${zoom})`}}><CVPreview data={builder.cv} template={builder.template} colorTheme={builder.colorTheme} sections={builder.sections} fontId={builder.fontId} /></div><div className="max-w-3xl mx-auto mt-8"><AIScorePanel score={score} suggestions={suggestions} /></div></main></div>
    {showCoverLetter && coverLetter && <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"><div role="dialog" aria-modal="true" aria-label={l('Cover Letter')} className="bg-[#171722] border border-white/10 rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col"><div className="p-4 border-b border-white/10 flex items-center"><Mail className="w-4 h-4 text-violet-400 mr-2" /><span className="text-white font-semibold">{l('Cover Letter')}</span><button type="button" aria-label={l('Close cover letter')} className="ml-auto" onClick={() => setShowCoverLetter(false)}><X className="w-4 h-4" /></button></div><div className="p-5 overflow-y-auto whitespace-pre-wrap text-sm text-gray-300">{coverLetter}</div><div className="p-4 border-t border-white/10 flex gap-2"><input aria-label={l('Target company')} value={coverLetterCompany} onChange={e=>setCoverLetterCompany(e.target.value)} placeholder={l('Company')} className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 text-sm text-white" /><button type="button" onClick={() => void navigator.clipboard.writeText(coverLetter)} className="px-3 py-2 border border-white/10 rounded-lg text-xs text-gray-300 flex gap-1"><Copy className="w-3.5 h-3.5" />{l('Copy')}</button><button type="button" disabled={!!aiLoading} onClick={() => void handleAIAction('generate-cover-letter')} className="px-3 py-2 bg-violet-600 rounded-lg text-xs text-white disabled:opacity-50">{l('Regenerate')}</button></div></div></div>}
  </div>;
}
