import { useLocalizer } from '@/lib/ui-localization';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft, Save, Download, Eye, Plus, Trash2, GripVertical,
  Sparkles, Loader2, FileText, FileDown, ZoomIn, ZoomOut,
  Briefcase, Target, Check, X, History, Palette, ChevronDown,
  PenLine, CheckCircle2, Minimize2, Maximize2, Award, Wand2, Mail, Copy,
  Type, ChevronRight, FolderOpen, AlertCircle, Zap, TrendingUp,
} from 'lucide-react';
import {
  CVData, TemplateId, ColorTheme, SectionConfig, ResumeVersion,
  uid, createEmptyCV, DEFAULT_SECTIONS, TEMPLATES, COLOR_THEMES, FONT_OPTIONS,
} from '@/lib/cv-types';
import { calculateResumeScore, generateSuggestions, matchJobDescription, AI_ACTIONS, AIAction } from '@/lib/cv-ai';
import { exportToPDF, exportToTXT, exportToDOCX } from '@/lib/cv-export';
import CVPreview from './CVPreview';
import AIScorePanel from './AIScorePanel';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import { createAIService, AIError } from '@/lib/ai/service';
import { useProjects } from '@/lib/use-projects';

interface ResumeBuilderProps {
  onBack: () => void;
}

type Phase = 'template-select' | 'builder';
type Panel = 'edit' | 'design' | 'ai' | 'job' | 'versions';
type EditSection = 'personal' | 'summary' | 'experience' | 'education' | 'skills' | 'languages' | 'projects' | 'certificates' | 'awards';

const SKILL_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
const PROFICIENCY = ['Basic', 'Conversational', 'Fluent', 'Native'];

const inputClass = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-violet-500/50 focus:outline-none transition-colors';
const labelClass = 'text-gray-400 text-xs font-medium mb-1 block';

export default function ResumeBuilder({ onBack }: ResumeBuilderProps) {
  const l = useLocalizer();
  const { user } = useAuth();
  const toast = useToast();
  const { createProject, saveProject, createFileEntry, logActivity } = useProjects();
  const [phase, setPhase] = useState<Phase>('template-select');
  const [cv, setCv] = useState<CVData>(createEmptyCV());
  const [template, setTemplate] = useState<TemplateId>('modern');
  const [colorTheme, setColorTheme] = useState<ColorTheme>('violet');
  const [fontId, setFontId] = useState('inter');
  const [sections, setSections] = useState<SectionConfig[]>(DEFAULT_SECTIONS);
  const [activePanel, setActivePanel] = useState<Panel>('edit');
  const [editSection, setEditSection] = useState<EditSection>('personal');
  const [zoom, setZoom] = useState(1);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [cvId, setCvId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [jobMatch, setJobMatch] = useState<ReturnType<typeof matchJobDescription> | null>(null);
  const [exportMenu, setExportMenu] = useState(false);
  const [draggedSection, setDraggedSection] = useState<number | null>(null);
  const [coverLetter, setCoverLetter] = useState<string | null>(null);
  const [coverLetterLoading, setCoverLetterLoading] = useState(false);
  const [coverLetterCompany, setCoverLetterCompany] = useState('');
  const [showCoverLetter, setShowCoverLetter] = useState(false);
  const [exporting, setExporting] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const score = calculateResumeScore(cv);
  const suggestions = generateSuggestions(cv);

  // Dual auto-save: cvs table + projects table (My Files + Recent Projects)
  const doSave = useCallback(async () => {
    if (!user) return;
    setSaveStatus('saving');
    try {
      const title = cv.personal.fullName || 'Untitled Resume';
      if (!cvId) {
        const { data } = await supabase
          .from('cvs')
          .insert({ user_id: user.id, title, data: cv, template, ats_score: score.ats })
          .select('id')
          .single();
        if (data) setCvId(data.id);
      } else {
        await supabase
          .from('cvs')
          .update({ data: cv, template, ats_score: score.ats, title, updated_at: new Date().toISOString() })
          .eq('id', cvId);
      }
      // Also save to projects table for My Files + Recent Projects
      if (!projectId) {
        const pid = await createProject(user.id, title, 'cv', { cv, template, colorTheme, fontId, sections } as unknown as Record<string, unknown>, 'draft');
        if (pid) {
          setProjectId(pid);
          await createFileEntry(user.id, pid, `${title}.pdf`, 'cv');
          await logActivity(`Created resume: ${title}`, 'cv-builder');
        }
      } else {
        await saveProject(projectId, {
          title,
          content: { cv, template, colorTheme, fontId, sections } as unknown as Record<string, unknown>,
          status: 'draft',
        });
      }
      setSaveStatus('saved');
    } catch {
      setSaveStatus('idle');
    }
  }, [user, cv, cvId, projectId, template, colorTheme, fontId, sections, score, createProject, saveProject, createFileEntry, logActivity]);

  useEffect(() => {
    if (!user || phase !== 'builder') return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus('idle');
    saveTimer.current = setTimeout(() => doSave(), 2500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [cv, template, colorTheme, fontId, sections, user, phase, doSave]);

  // Load versions
  const loadVersions = useCallback(async () => {
    if (!cvId || !user) return;
    const { data } = await supabase
      .from('cv_versions')
      .select('*')
      .eq('cv_id', cvId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setVersions(data as ResumeVersion[]);
  }, [cvId, user]);

  const saveVersion = useCallback(async () => {
    if (!cvId || !user) return;
    const versionNum = versions.length + 1;
    await supabase.from('cv_versions').insert({
      cv_id: cvId, user_id: user.id, version_label: `v${versionNum}`, data: cv, template,
    });
    loadVersions();
    toast.success('Version saved');
  }, [cvId, user, cv, template, versions.length, loadVersions, toast]);

  function restoreVersion(version: ResumeVersion) {
    setCv(version.data);
    setTemplate(version.template as TemplateId);
    toast.success(`Restored ${version.version_label}`);
  }

  // AI handlers
  async function handleAIAction(action: AIAction, targetText?: string) {
    setAiLoading(action);
    const ai = createAIService('cv-builder');
    try {
      switch (action) {
        case 'rewrite-experience': {
          if (cv.experience.length === 0) { toast.error('Add at least one experience entry first'); break; }
          const res = await ai.complete({ action, experiences: cv.experience });
          const blocks = res.content.trim().split(/\n\s*\n/);
          setCv({ ...cv, experience: cv.experience.map((exp, i) => ({ ...exp, description: blocks[i]?.trim() || exp.description })) });
          toast.success('Experience rewritten with stronger action verbs');
          break;
        }
        case 'improve-grammar': {
          const text = [cv.summary, ...cv.experience.map(e => e.description)].join('\n\n');
          if (!text.trim()) { toast.error('Add some content first'); break; }
          const res = await ai.complete({ action, text });
          const parts = res.content.trim().split(/\n\s*\n/);
          const newSummary = parts.shift() || cv.summary;
          setCv({ ...cv, summary: newSummary, experience: cv.experience.map((exp, i) => ({ ...exp, description: parts[i]?.trim() || exp.description })) });
          toast.success('Grammar improved');
          break;
        }
        case 'shorten-text': {
          if (cv.experience.length === 0) { toast.error('Add experience first'); break; }
          const text = cv.experience.map(e => e.description).join('\n\n');
          const res = await ai.complete({ action, text });
          const parts = res.content.trim().split(/\n\s*\n/);
          setCv({ ...cv, experience: cv.experience.map((exp, i) => ({ ...exp, description: parts[i]?.trim() || exp.description })) });
          toast.success('Text shortened');
          break;
        }
        case 'expand-text': {
          if (cv.experience.length === 0) { toast.error('Add experience first'); break; }
          const text = cv.experience.map(e => e.description).join('\n\n');
          const res = await ai.complete({ action, text });
          const parts = res.content.trim().split(/\n\s*\n/);
          setCv({ ...cv, experience: cv.experience.map((exp, i) => ({ ...exp, description: parts[i]?.trim() || exp.description })) });
          toast.success('Text expanded');
          break;
        }
        case 'generate-achievements': {
          if (cv.experience.length === 0) { toast.error('Add an experience entry first'); break; }
          const res = await ai.complete({ action, jobTitle: cv.personal.jobTitle, company: cv.experience[0]?.company, description: cv.experience[0]?.description });
          const bullets = res.content.trim().split('\n').filter(l => l.trim().startsWith('•') || l.trim().startsWith('-'));
          if (cv.experience.length > 0) {
            setCv({ ...cv, experience: cv.experience.map((exp, i) => i === 0 ? { ...exp, description: exp.description + '\n' + bullets.join('\n') } : exp) });
          }
          toast.success(`${bullets.length} achievements generated`);
          break;
        }
        case 'suggest-skills': {
          const res = await ai.complete({ action, jobTitle: cv.personal.jobTitle, skills: cv.skills.map(s => s.name), experiences: cv.experience });
          const suggested = res.content.split(',').map(s => s.trim()).filter(Boolean);
          const existing = cv.skills.map(s => s.name.toLowerCase());
          const toAdd = suggested.filter(s => !existing.includes(s.toLowerCase()));
          setCv({ ...cv, skills: [...cv.skills, ...toAdd.slice(0, 8).map(s => ({ id: uid(), name: s, level: 'Intermediate' }))] });
          toast.success(`Added ${Math.min(toAdd.length, 8)} skills`);
          break;
        }
        case 'optimize-ats': {
          const res = await ai.complete({ action, summary: cv.summary, jobTitle: cv.personal.jobTitle });
          setCv({ ...cv, summary: res.content.trim() });
          toast.success('Summary optimized for ATS');
          break;
        }
        case 'match-job': {
          if (!targetText || !targetText.trim()) { toast.error('Paste a job description first'); break; }
          try {
            const res = await ai.complete({ action, cv, jobDescription: targetText });
            const parsed = JSON.parse(res.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
            setJobMatch(parsed);
            setJobDescription(targetText);
            toast.success('Job match analyzed');
          } catch {
            const result = matchJobDescription(cv, targetText);
            setJobMatch(result);
            setJobDescription(targetText);
            toast.success('Job match analyzed');
          }
          break;
        }
        case 'generate-cover-letter': {
          setCoverLetterLoading(true);
          const res = await ai.complete({ action, cv, jobDescription: targetText || jobDescription, company: coverLetterCompany });
          setCoverLetter(res.content.trim());
          setShowCoverLetter(true);
          toast.success('Cover letter generated');
          setCoverLetterLoading(false);
          break;
        }
      }
    } catch (err) {
      if (err instanceof AIError) toast.error(err.message);
      else toast.error('AI request failed. Please try again.');
    }
    setAiLoading(null);
  }

  // Drag & drop section reordering
  function handleDragStart(idx: number) { setDraggedSection(idx); }
  function handleDragOver(e: React.DragEvent) { e.preventDefault(); }
  function handleDrop(idx: number) {
    if (draggedSection === null || draggedSection === idx) return;
    const newSections = [...sections];
    const [moved] = newSections.splice(draggedSection, 1);
    newSections.splice(idx, 0, moved);
    setSections(newSections);
    setDraggedSection(null);
  }

  function toggleSectionVisible(secId: string) {
    setSections(sections.map(s => s.id === secId ? { ...s, visible: !s.visible } : s));
  }

  // Export handlers
  async function handleExport(format: 'pdf' | 'docx' | 'txt') {
    setExportMenu(false);
    setExporting(true);
    try {
      if (format === 'pdf') await exportToPDF();
      else if (format === 'docx') exportToDOCX(cv, template, colorTheme);
      else exportToTXT(cv);
      toast.success(`Exported as ${format.toUpperCase()}`);
      if (user && projectId) {
        await logActivity(`Exported resume as ${format.toUpperCase()}`, 'cv-builder');
      }
    } catch {
      toast.error(`Failed to export as ${format.toUpperCase()}`);
    }
    setExporting(false);
  }

  // Update helpers
  function updatePersonal(field: keyof CVData['personal'], value: string) {
    setCv({ ...cv, personal: { ...cv.personal, [field]: value } });
  }
  function addExperience() {
    setCv({ ...cv, experience: [...cv.experience, { id: uid(), jobTitle: '', company: '', location: '', startDate: '', endDate: '', current: false, description: '' }] });
  }
  function updateExperience(id: string, field: string, value: string | boolean) {
    setCv({ ...cv, experience: cv.experience.map(e => e.id === id ? { ...e, [field]: value } : e) });
  }
  function deleteExperience(id: string) {
    setCv({ ...cv, experience: cv.experience.filter(e => e.id !== id) });
  }
  function addEducation() {
    setCv({ ...cv, education: [...cv.education, { id: uid(), degree: '', institution: '', location: '', startDate: '', endDate: '', description: '' }] });
  }
  function updateEducation(id: string, field: string, value: string) {
    setCv({ ...cv, education: cv.education.map(e => e.id === id ? { ...e, [field]: value } : e) });
  }
  function deleteEducation(id: string) {
    setCv({ ...cv, education: cv.education.filter(e => e.id !== id) });
  }
  function addSkill() {
    setCv({ ...cv, skills: [...cv.skills, { id: uid(), name: '', level: 'Intermediate' }] });
  }
  function updateSkill(id: string, field: string, value: string) {
    setCv({ ...cv, skills: cv.skills.map(s => s.id === id ? { ...s, [field]: value } : s) });
  }
  function deleteSkill(id: string) {
    setCv({ ...cv, skills: cv.skills.filter(s => s.id !== id) });
  }
  function addLanguage() {
    setCv({ ...cv, languages: [...cv.languages, { id: uid(), name: '', proficiency: 'Fluent' }] });
  }
  function updateLanguage(id: string, field: string, value: string) {
    setCv({ ...cv, languages: cv.languages.map(l => l.id === id ? { ...l, [field]: value } : l) });
  }
  function deleteLanguage(id: string) {
    setCv({ ...cv, languages: cv.languages.filter(l => l.id !== id) });
  }
  function addProject() {
    setCv({ ...cv, projects: [...cv.projects, { id: uid(), name: '', description: '', link: '' }] });
  }
  function updateProject(id: string, field: string, value: string) {
    setCv({ ...cv, projects: cv.projects.map(p => p.id === id ? { ...p, [field]: value } : p) });
  }
  function deleteProject(id: string) {
    setCv({ ...cv, projects: cv.projects.filter(p => p.id !== id) });
  }
  function addCertificate() {
    setCv({ ...cv, certificates: [...cv.certificates, { id: uid(), name: '', issuer: '', date: '' }] });
  }
  function updateCertificate(id: string, field: string, value: string) {
    setCv({ ...cv, certificates: cv.certificates.map(c => c.id === id ? { ...c, [field]: value } : c) });
  }
  function deleteCertificate(id: string) {
    setCv({ ...cv, certificates: cv.certificates.filter(c => c.id !== id) });
  }
  function addAward() {
    setCv({ ...cv, awards: [...cv.awards, { id: uid(), title: '', issuer: '', date: '', description: '' }] });
  }
  function updateAward(id: string, field: string, value: string) {
    setCv({ ...cv, awards: cv.awards.map(a => a.id === id ? { ...a, [field]: value } : a) });
  }
  function deleteAward(id: string) {
    setCv({ ...cv, awards: cv.awards.filter(a => a.id !== id) });
  }

  // ===== TEMPLATE SELECTION PHASE =====
  if (phase === 'template-select') {
    return (
      <div className="min-h-screen bg-[#06060f] text-white">
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-fuchsia-600/8 rounded-full blur-[100px]" />
        </div>

        <header className="relative z-10 flex items-center justify-between px-4 sm:px-8 py-4 border-b border-white/5 bg-[#0a0a1a]/80 backdrop-blur-xl sticky top-0">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-bold text-base">{l('Choose a Template')}</h1>
              <p className="text-gray-500 text-xs">{l('Pick a design — you can change it anytime')}</p>
            </div>
          </div>
        </header>

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-8 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {TEMPLATES.map((t, idx) => (
              <button
                key={t.id}
                onClick={() => { setTemplate(t.id); setPhase('builder'); toast.success(`${t.name} template selected`); }}
                className="group text-left rounded-2xl border border-white/10 hover:border-violet-500/40 bg-white/[0.02] hover:bg-violet-600/5 overflow-hidden transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-violet-500/10"
                style={{ animation: `fadeInUp 0.3s ease-out ${idx * 0.05}s both` }}
              >
                {/* Mini preview */}
                <div className="aspect-[3/4] bg-white relative overflow-hidden p-3">
                  <MiniPreview templateId={t.id} />
                  <div className="absolute inset-0 bg-gradient-to-t from-violet-600/0 to-transparent group-hover:from-violet-600/10 transition-colors" />
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-white text-sm font-semibold">{t.name}</h3>
                    <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-violet-400 group-hover:translate-x-1 transition-all" />
                  </div>
                  <p className="text-gray-500 text-xs mt-1 leading-relaxed">{t.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ===== BUILDER PHASE =====
  const navItems: { id: Panel; label: string; icon: typeof FileText }[] = [
    { id: 'edit', label: 'Edit', icon: FileText },
    { id: 'design', label: 'Design', icon: Palette },
    { id: 'ai', label: 'AI Assistant', icon: Sparkles },
    { id: 'job', label: 'Job Match', icon: Briefcase },
    { id: 'versions', label: 'History', icon: History },
  ];

  const editSections: { id: EditSection; label: string }[] = [
    { id: 'personal', label: 'Personal Info' },
    { id: 'summary', label: 'Summary' },
    { id: 'experience', label: 'Experience' },
    { id: 'education', label: 'Education' },
    { id: 'skills', label: 'Skills' },
    { id: 'languages', label: 'Languages' },
    { id: 'projects', label: 'Projects' },
    { id: 'certificates', label: 'Certifications' },
    { id: 'awards', label: 'Awards' },
  ];

  return (
    <div className="min-h-screen bg-[#06060f] flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#0a0a1a]/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button onClick={() => setPhase('template-select')} className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-white font-bold text-sm">{l('Resume Builder')}</h1>
            <p className="text-gray-500 text-xs flex items-center gap-1.5">
              {saveStatus === 'saving' && <><Loader2 className="w-3 h-3 animate-spin" /> {l('Saving...')}</>}
              {saveStatus === 'saved' && <><CheckCircle2 className="w-3 h-3 text-emerald-400" /> {l('All changes saved')}</>}
              {saveStatus === 'idle' && <><CheckCircle2 className="w-3 h-3 text-gray-600" /> {l('Auto-save on')}</>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={saveVersion} className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg transition-colors">
            <History className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{l('Save Version')}</span>
          </button>
          <div className="relative">
            <button onClick={() => setExportMenu(!exportMenu)} disabled={exporting} className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50">
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Export <ChevronDown className="w-3 h-3" />
            </button>
            {exportMenu && (
              <div className="absolute top-full right-0 mt-1 bg-[#12122a] border border-white/10 rounded-xl p-1.5 w-40 shadow-2xl z-50" onClick={() => setExportMenu(false)}>
                <button onClick={() => handleExport('pdf')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                  <FileText className="w-4 h-4" /> PDF
                </button>
                <button onClick={() => handleExport('docx')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                  <FileDown className="w-4 h-4" /> DOCX
                </button>
                <button onClick={() => handleExport('txt')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                  <FileText className="w-4 h-4" /> TXT
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        <div className="w-[420px] flex-shrink-0 border-r border-white/5 flex flex-col">
          {/* Panel tabs */}
          <div className="flex gap-1 p-2 border-b border-white/5 bg-[#0a0a1a]/50">
            {navItems.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActivePanel(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all flex-1 justify-center ${
                    activePanel === item.id ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">{l(item.label)}</span>
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {/* EDIT PANEL */}
            {activePanel === 'edit' && (
              <div>
                <div className="flex flex-wrap gap-1 mb-4">
                  {editSections.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setEditSection(s.id)}
                      className={`text-xs px-3 py-1.5 rounded-lg transition-all ${
                        editSection === s.id ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30' : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {/* Personal Info */}
                {editSection === 'personal' && (
                  <div className="space-y-3">
                    <Field label={l('Full Name')}><input className={inputClass} value={cv.personal.fullName} onChange={e => updatePersonal('fullName', e.target.value)} placeholder={l('John Doe')} /></Field>
                    <Field label={l('Job Title')}><input className={inputClass} value={cv.personal.jobTitle} onChange={e => updatePersonal('jobTitle', e.target.value)} placeholder={l('Software Engineer')} /></Field>
                    <Field label={l('Email')}><input className={inputClass} value={cv.personal.email} onChange={e => updatePersonal('email', e.target.value)} placeholder="john@example.com" /></Field>
                    <Field label={l('Phone')}><input className={inputClass} value={cv.personal.phone} onChange={e => updatePersonal('phone', e.target.value)} placeholder="+1 234 567 890" /></Field>
                    <Field label={l('Address')}><input className={inputClass} value={cv.personal.address} onChange={e => updatePersonal('address', e.target.value)} placeholder={l('Stockholm, Sweden')} /></Field>
                    <Field label={l('LinkedIn')}><input className={inputClass} value={cv.personal.linkedin} onChange={e => updatePersonal('linkedin', e.target.value)} placeholder="linkedin.com/in/johndoe" /></Field>
                    <Field label={l('Portfolio')}><input className={inputClass} value={cv.personal.portfolio} onChange={e => updatePersonal('portfolio', e.target.value)} placeholder="johndoe.com" /></Field>
                  </div>
                )}

                {/* Summary */}
                {editSection === 'summary' && (
                  <div>
                    <Field label={l('Professional Summary')}>
                      <textarea className={inputClass + ' min-h-[200px] resize-y'} value={cv.summary} onChange={e => setCv({ ...cv, summary: e.target.value })} placeholder={l('Write a 2-3 sentence summary highlighting your experience, key skills, and career goals...')} />
                    </Field>
                    <button onClick={() => handleAIAction('optimize-ats')} disabled={aiLoading !== null} className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 mt-2 disabled:opacity-50">
                      {aiLoading === 'optimize-ats' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                      Improve with AI
                    </button>
                  </div>
                )}

                {/* Experience */}
                {editSection === 'experience' && (
                  <div className="space-y-4">
                    {cv.experience.length === 0 && <EmptyState icon={Briefcase} label="No experience yet" hint="Add your work history to get started" />}
                    {cv.experience.map((exp, i) => (
                      <div key={exp.id} className="bg-white/[0.02] border border-white/10 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">Experience {i + 1}</span>
                          <button onClick={() => deleteExperience(exp.id)} className="text-red-400/60 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                        <Field label={l('Job Title')}><input className={inputClass} value={exp.jobTitle} onChange={e => updateExperience(exp.id, 'jobTitle', e.target.value)} /></Field>
                        <Field label={l('Company')}><input className={inputClass} value={exp.company} onChange={e => updateExperience(exp.id, 'company', e.target.value)} /></Field>
                        <Field label={l('Location')}><input className={inputClass} value={exp.location} onChange={e => updateExperience(exp.id, 'location', e.target.value)} /></Field>
                        <div className="grid grid-cols-2 gap-2">
                          <Field label={l('Start')}><input className={inputClass} value={exp.startDate} onChange={e => updateExperience(exp.id, 'startDate', e.target.value)} placeholder={l('Jan 2022')} /></Field>
                          <Field label={l('End')}><input className={inputClass} value={exp.endDate} onChange={e => updateExperience(exp.id, 'endDate', e.target.value)} placeholder={l('Present')} disabled={exp.current} /></Field>
                        </div>
                        <label className="flex items-center gap-2 text-xs text-gray-400">
                          <input type="checkbox" checked={exp.current} onChange={e => updateExperience(exp.id, 'current', e.target.checked)} className="accent-violet-600" /> Current role
                        </label>
                        <Field label={l('Description')}><textarea className={inputClass + ' min-h-[100px] resize-y'} value={exp.description} onChange={e => updateExperience(exp.id, 'description', e.target.value)} placeholder={l('Describe your achievements...')} /></Field>
                      </div>
                    ))}
                    <AddButton label="Add Experience" onClick={addExperience} />
                  </div>
                )}

                {/* Education */}
                {editSection === 'education' && (
                  <div className="space-y-4">
                    {cv.education.length === 0 && <EmptyState icon={FileText} label="No education yet" hint="Add your academic background" />}
                    {cv.education.map((edu, i) => (
                      <div key={edu.id} className="bg-white/[0.02] border border-white/10 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">Education {i + 1}</span>
                          <button onClick={() => deleteEducation(edu.id)} className="text-red-400/60 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                        <Field label={l('Degree')}><input className={inputClass} value={edu.degree} onChange={e => updateEducation(edu.id, 'degree', e.target.value)} /></Field>
                        <Field label={l('Institution')}><input className={inputClass} value={edu.institution} onChange={e => updateEducation(edu.id, 'institution', e.target.value)} /></Field>
                        <Field label={l('Location')}><input className={inputClass} value={edu.location} onChange={e => updateEducation(edu.id, 'location', e.target.value)} /></Field>
                        <div className="grid grid-cols-2 gap-2">
                          <Field label={l('Start')}><input className={inputClass} value={edu.startDate} onChange={e => updateEducation(edu.id, 'startDate', e.target.value)} /></Field>
                          <Field label={l('End')}><input className={inputClass} value={edu.endDate} onChange={e => updateEducation(edu.id, 'endDate', e.target.value)} /></Field>
                        </div>
                        <Field label={l('Description')}><input className={inputClass} value={edu.description} onChange={e => updateEducation(edu.id, 'description', e.target.value)} /></Field>
                      </div>
                    ))}
                    <AddButton label="Add Education" onClick={addEducation} />
                  </div>
                )}

                {/* Skills */}
                {editSection === 'skills' && (
                  <div className="space-y-2">
                    {cv.skills.length === 0 && <EmptyState icon={Zap} label="No skills yet" hint="Add your technical and soft skills" />}
                    {cv.skills.map(skill => (
                      <div key={skill.id} className="flex gap-2 items-center">
                        <input className={inputClass + ' flex-1'} value={skill.name} onChange={e => updateSkill(skill.id, 'name', e.target.value)} placeholder={l('Skill name')} />
                        <select className={inputClass + ' w-28'} value={skill.level} onChange={e => updateSkill(skill.id, 'level', e.target.value)}>
                          {SKILL_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                        <button onClick={() => deleteSkill(skill.id)} className="text-red-400/60 hover:text-red-400 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                    <AddButton label="Add Skill" onClick={addSkill} />
                    <button onClick={() => handleAIAction('suggest-skills')} disabled={aiLoading !== null} className="w-full flex items-center justify-center gap-1.5 text-xs text-violet-400 border border-violet-500/20 hover:bg-violet-600/10 py-2.5 rounded-xl transition-colors disabled:opacity-50 mt-2">
                      {aiLoading === 'suggest-skills' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      Suggest Skills with AI
                    </button>
                  </div>
                )}

                {/* Languages */}
                {editSection === 'languages' && (
                  <div className="space-y-2">
                    {cv.languages.length === 0 && <EmptyState icon={Type} label="No languages yet" hint="Add languages you speak" />}
                    {cv.languages.map(lang => (
                      <div key={lang.id} className="flex gap-2 items-center">
                        <input className={inputClass + ' flex-1'} value={lang.name} onChange={e => updateLanguage(lang.id, 'name', e.target.value)} placeholder={l('Language')} />
                        <select className={inputClass + ' w-32'} value={lang.proficiency} onChange={e => updateLanguage(lang.id, 'proficiency', e.target.value)}>
                          {PROFICIENCY.map(p => <option key={l(p)} value={l(p)}>{l(p)}</option>)}
                        </select>
                        <button onClick={() => deleteLanguage(lang.id)} className="text-red-400/60 hover:text-red-400 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                    <AddButton label="Add Language" onClick={addLanguage} />
                  </div>
                )}

                {/* Projects */}
                {editSection === 'projects' && (
                  <div className="space-y-3">
                    {cv.projects.length === 0 && <EmptyState icon={FolderOpen} label="No projects yet" hint="Showcase your work" />}
                    {cv.projects.map(proj => (
                      <div key={proj.id} className="bg-white/[0.02] border border-white/10 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">{l('Project')}</span>
                          <button onClick={() => deleteProject(proj.id)} className="text-red-400/60 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                        <Field label={l('Name')}><input className={inputClass} value={proj.name} onChange={e => updateProject(proj.id, 'name', e.target.value)} /></Field>
                        <Field label={l('Description')}><textarea className={inputClass + ' min-h-[80px] resize-y'} value={proj.description} onChange={e => updateProject(proj.id, 'description', e.target.value)} /></Field>
                        <Field label={l('Link')}><input className={inputClass} value={proj.link} onChange={e => updateProject(proj.id, 'link', e.target.value)} /></Field>
                      </div>
                    ))}
                    <AddButton label="Add Project" onClick={addProject} />
                  </div>
                )}

                {/* Certificates */}
                {editSection === 'certificates' && (
                  <div className="space-y-3">
                    {cv.certificates.length === 0 && <EmptyState icon={Award} label="No certificates yet" hint="Add your certifications" />}
                    {cv.certificates.map(cert => (
                      <div key={cert.id} className="bg-white/[0.02] border border-white/10 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">{l('Certificate')}</span>
                          <button onClick={() => deleteCertificate(cert.id)} className="text-red-400/60 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                        <Field label={l('Name')}><input className={inputClass} value={cert.name} onChange={e => updateCertificate(cert.id, 'name', e.target.value)} /></Field>
                        <Field label={l('Issuer')}><input className={inputClass} value={cert.issuer} onChange={e => updateCertificate(cert.id, 'issuer', e.target.value)} /></Field>
                        <Field label={l('Date')}><input className={inputClass} value={cert.date} onChange={e => updateCertificate(cert.id, 'date', e.target.value)} /></Field>
                      </div>
                    ))}
                    <AddButton label="Add Certificate" onClick={addCertificate} />
                  </div>
                )}

                {/* Awards */}
                {editSection === 'awards' && (
                  <div className="space-y-3">
                    {cv.awards.length === 0 && <EmptyState icon={Award} label="No awards yet" hint="Add your achievements" />}
                    {cv.awards.map(award => (
                      <div key={award.id} className="bg-white/[0.02] border border-white/10 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">{l('Award')}</span>
                          <button onClick={() => deleteAward(award.id)} className="text-red-400/60 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                        <Field label={l('Title')}><input className={inputClass} value={award.title} onChange={e => updateAward(award.id, 'title', e.target.value)} /></Field>
                        <Field label={l('Issuer')}><input className={inputClass} value={award.issuer} onChange={e => updateAward(award.id, 'issuer', e.target.value)} /></Field>
                        <Field label={l('Date')}><input className={inputClass} value={award.date} onChange={e => updateAward(award.id, 'date', e.target.value)} /></Field>
                        <Field label={l('Description')}><input className={inputClass} value={award.description} onChange={e => updateAward(award.id, 'description', e.target.value)} /></Field>
                      </div>
                    ))}
                    <AddButton label="Add Award" onClick={addAward} />
                  </div>
                )}
              </div>
            )}

            {/* DESIGN PANEL */}
            {activePanel === 'design' && (
              <div className="space-y-6">
                {/* Templates */}
                <div>
                  <h3 className="text-white text-sm font-semibold mb-3">{l('Resume Template')}</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {TEMPLATES.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setTemplate(t.id)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          template === t.id ? 'border-violet-500/50 bg-violet-600/10' : 'border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="text-white text-xs font-medium">{t.name}</div>
                        <div className="text-gray-500 text-[10px] mt-0.5 leading-tight">{t.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color themes */}
                <div>
                  <h3 className="text-white text-sm font-semibold mb-3">{l('Color Theme')}</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {COLOR_THEMES.map(c => (
                      <button
                        key={c.id}
                        onClick={() => setColorTheme(c.id)}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all ${
                          colorTheme === c.id ? 'border-violet-500/50 bg-violet-600/10' : 'border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="w-5 h-5 rounded-full" style={{ background: c.primary }} />
                        <span className="text-white text-xs">{c.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font selection */}
                <div>
                  <h3 className="text-white text-sm font-semibold mb-3 flex items-center gap-1.5">
                    <Type className="w-4 h-4 text-gray-500" /> Font Family
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {FONT_OPTIONS.map(f => (
                      <button
                        key={f.id}
                        onClick={() => setFontId(f.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          fontId === f.id ? 'border-violet-500/50 bg-violet-600/10' : 'border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="text-white text-xs font-medium" style={{ fontFamily: f.family }}>{f.name}</div>
                        <div className="text-gray-500 text-[10px] mt-0.5 capitalize">{f.category}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Section reordering */}
                <div>
                  <h3 className="text-white text-sm font-semibold mb-3 flex items-center gap-1.5">
                    <GripVertical className="w-4 h-4 text-gray-500" /> Section Order
                  </h3>
                  <p className="text-gray-500 text-xs mb-2">{l('Drag to reorder sections. Toggle to show/hide.')}</p>
                  <div className="space-y-1.5">
                    {sections.map((sec, idx) => (
                      <div
                        key={sec.id}
                        draggable
                        onDragStart={() => handleDragStart(idx)}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(idx)}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all cursor-move ${
                          draggedSection === idx ? 'border-violet-500/50 bg-violet-600/10 opacity-50' : 'border-white/10 hover:border-white/20 bg-white/[0.02]'
                        }`}
                      >
                        <GripVertical className="w-4 h-4 text-gray-500" />
                        <span className="text-white text-xs flex-1">{sec.label}</span>
                        <button
                          onClick={() => toggleSectionVisible(sec.id)}
                          className={`w-7 h-4 rounded-full transition-colors ${sec.visible ? 'bg-violet-600' : 'bg-white/10'}`}
                        >
                          <span className={`block w-3 h-3 rounded-full bg-white transition-transform ${sec.visible ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* AI ASSISTANT PANEL */}
            {activePanel === 'ai' && (
              <div className="space-y-4">
                <div className="bg-violet-600/10 border border-violet-500/20 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-4 h-4 text-violet-400" />
                    <h3 className="text-white text-sm font-semibold">{l('AI Assistant')}</h3>
                  </div>
                  <p className="text-gray-400 text-xs">{l('Select an action to improve your resume with AI.')}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {AI_ACTIONS.filter(a => a.id !== 'match-job' && a.id !== 'generate-cover-letter').map(action => {
                    const iconMap: Record<string, typeof PenLine> = {
                      pen: PenLine, check: CheckCircle2, minimize: Minimize2, maximize: Maximize2,
                      award: Award, sparkles: Sparkles, target: Target, briefcase: Briefcase,
                    };
                    const Icon = iconMap[action.icon] || Sparkles;
                    return (
                      <button
                        key={action.id}
                        onClick={() => handleAIAction(action.id)}
                        disabled={aiLoading !== null}
                        className="flex flex-col items-start gap-1 p-3 rounded-xl border border-white/10 hover:border-violet-500/30 hover:bg-violet-600/5 transition-all text-left disabled:opacity-50"
                      >
                        <Icon className="w-4 h-4 text-violet-400" />
                        <span className="text-white text-xs font-medium">{l(action.label)}</span>
                        <span className="text-gray-500 text-[10px] leading-tight">{action.description}</span>
                      </button>
                    );
                  })}
                </div>

                {aiLoading && (
                  <div className="flex items-center gap-2 text-violet-400 text-xs bg-violet-600/5 rounded-lg p-2.5">
                    <Loader2 className="w-4 h-4 animate-spin" /> Processing with AI...
                  </div>
                )}

                {/* Cover Letter Generator */}
                <div className="border-t border-white/5 pt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-fuchsia-400" />
                    <h3 className="text-white text-sm font-semibold">{l('Cover Letter')}</h3>
                  </div>
                  <input
                    className={inputClass}
                    value={coverLetterCompany}
                    onChange={e => setCoverLetterCompany(e.target.value)}
                    placeholder={l('Company name (optional)')}
                  />
                  <button
                    onClick={() => handleAIAction('generate-cover-letter', jobDescription)}
                    disabled={aiLoading !== null || coverLetterLoading}
                    className="w-full flex items-center justify-center gap-2 bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
                  >
                    {coverLetterLoading || aiLoading === 'generate-cover-letter' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                    Generate Cover Letter
                  </button>
                  {coverLetter && (
                    <button
                      onClick={() => setShowCoverLetter(true)}
                      className="w-full flex items-center justify-center gap-2 text-fuchsia-400 hover:text-fuchsia-300 text-xs font-medium py-2 rounded-lg border border-fuchsia-500/20 hover:bg-fuchsia-600/10 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" /> View Cover Letter
                    </button>
                  )}
                </div>

                {/* Score panel */}
                <AIScorePanel score={score} suggestions={suggestions} />
              </div>
            )}

            {/* JOB MATCH PANEL */}
            {activePanel === 'job' && (
              <div className="space-y-4">
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Briefcase className="w-4 h-4 text-blue-400" />
                    <h3 className="text-white text-sm font-semibold">{l('Job Match Analysis')}</h3>
                  </div>
                  <p className="text-gray-400 text-xs">{l('Paste a job description to see how well your resume matches.')}</p>
                </div>

                <textarea
                  className={inputClass + ' min-h-[150px] resize-y'}
                  value={jobDescription}
                  onChange={e => setJobDescription(e.target.value)}
                  placeholder={l('Paste the job description here...')}
                />

                <button
                  onClick={() => handleAIAction('match-job', jobDescription)}
                  disabled={aiLoading !== null || !jobDescription.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
                >
                  {aiLoading === 'match-job' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
                  Analyze Match
                </button>

                {aiLoading === 'match-job' && (
                  <div className="flex items-center gap-2 text-blue-400 text-xs bg-blue-600/5 rounded-lg p-2.5">
                    <Loader2 className="w-4 h-4 animate-spin" /> Analyzing your resume against the job description...
                  </div>
                )}

                {jobMatch && (
                  <div className="space-y-3" style={{ animation: 'fadeInUp 0.3s ease-out' }}>
                    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 text-center">
                      <div className="relative inline-flex items-center justify-center">
                        <svg width="100" height="100" className="transform -rotate-90">
                          <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
                          <circle cx="50" cy="50" r="42" fill="none" stroke={jobMatch.matchPercentage >= 70 ? '#10b981' : jobMatch.matchPercentage >= 40 ? '#f59e0b' : '#ef4444'} strokeWidth="6"
                            strokeDasharray={2 * Math.PI * 42}
                            strokeDashoffset={2 * Math.PI * 42 - (jobMatch.matchPercentage / 100) * 2 * Math.PI * 42}
                            strokeLinecap="round"
                            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                          />
                        </svg>
                        <div className="absolute">
                          <span className="text-2xl font-bold text-white">{jobMatch.matchPercentage}%</span>
                        </div>
                      </div>
                      <p className="text-gray-400 text-xs mt-2">{l('Match Score')}</p>
                    </div>

                    {jobMatch.missingSkills.length > 0 && (
                      <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3">
                        <h4 className="text-red-400 text-xs font-semibold mb-2 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5" /> Missing Keywords ({jobMatch.missingSkills.length})
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {jobMatch.missingSkills.map(s => (
                            <span key={s} className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded px-2 py-0.5">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {jobMatch.matchedKeywords.length > 0 && (
                      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
                        <h4 className="text-emerald-400 text-xs font-semibold mb-2 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Matched Keywords ({jobMatch.matchedKeywords.length})
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {jobMatch.matchedKeywords.map(s => (
                            <span key={s} className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-0.5">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3">
                      <h4 className="text-white text-xs font-semibold mb-2 flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-violet-400" /> Suggestions
                      </h4>
                      <ul className="space-y-1.5">
                        {jobMatch.suggestions.map((s, i) => (
                          <li key={i} className="text-gray-400 text-xs flex items-start gap-2">
                            <Check className="w-3 h-3 text-violet-400 mt-0.5 flex-shrink-0" /> {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {!jobMatch && !aiLoading && (
                  <div className="text-center py-6">
                    <Target className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                    <p className="text-gray-500 text-xs">{l('Paste a job description and click "Analyze Match" to see your results.')}</p>
                  </div>
                )}
              </div>
            )}

            {/* VERSIONS PANEL */}
            {activePanel === 'versions' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-white text-sm font-semibold">{l('Version History')}</h3>
                  <button onClick={saveVersion} className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300">
                    <Plus className="w-3.5 h-3.5" /> Save Current
                  </button>
                </div>

                {versions.length === 0 ? (
                  <EmptyState icon={History} label="No versions yet" hint="Click 'Save Current' to create a snapshot you can restore later." />
                ) : (
                  <div className="space-y-2">
                    {versions.map(v => (
                      <div key={v.id} className="bg-white/[0.02] border border-white/10 rounded-xl p-3 flex items-center justify-between">
                        <div>
                          <div className="text-white text-xs font-medium">{v.version_label}</div>
                          <div className="text-gray-500 text-[10px]">{new Date(v.created_at).toLocaleString()}</div>
                        </div>
                        <button
                          onClick={() => restoreVersion(v)}
                          className="text-xs text-violet-400 hover:text-violet-300 border border-violet-500/20 hover:bg-violet-600/10 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Restore
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right preview panel */}
        <div className="flex-1 overflow-hidden flex flex-col bg-[#0a0a14]">
          {/* Zoom controls + ATS score badge */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
            <div className="flex items-center gap-2">
              <button onClick={() => setZoom(Math.max(0.5, zoom - 0.1))} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-gray-400 text-xs w-12 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(Math.min(2, zoom + 0.1))} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
                <ZoomIn className="w-4 h-4" />
              </button>
              <button onClick={() => setZoom(1)} className="text-xs text-gray-500 hover:text-white px-2">{l('Reset')}</button>
            </div>
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                score.ats >= 70 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                score.ats >= 40 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}>
                <Zap className="w-3 h-3" />
                ATS Score: {score.ats}/100
              </div>
              <div className="text-gray-500 text-xs hidden sm:block">{l('A4 Preview')}</div>
            </div>
          </div>

          {/* Preview area */}
          <div className="flex-1 overflow-auto flex items-start justify-center p-8">
            <div
              ref={previewRef}
              className="shadow-2xl shadow-black/50 bg-white print:shadow-none print:scale-100 origin-top transition-transform"
              style={{
                width: '210mm',
                minHeight: '297mm',
                transform: `scale(${zoom})`,
                transformOrigin: 'top center',
              }}
            >
              <CVPreview data={cv} template={template} colorTheme={colorTheme} sections={sections} fontId={fontId} />
            </div>
          </div>
        </div>
      </div>

      {/* Print-only full preview */}
      <div className="hidden print:block">
        <CVPreview data={cv} template={template} colorTheme={colorTheme} sections={sections} fontId={fontId} />
      </div>

      {/* Cover Letter Modal */}
      {showCoverLetter && coverLetter && (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowCoverLetter(false)}>
          <div className="bg-[#0a0a1a] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()} style={{ animation: 'fadeInUp 0.2s ease-out' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-fuchsia-400" />
                <h3 className="text-white font-bold text-base">{l('Cover Letter')}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { navigator.clipboard.writeText(coverLetter); toast.success('Copied to clipboard'); }}
                  className="flex items-center gap-1.5 text-gray-400 hover:text-white text-xs px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy
                </button>
                <button onClick={() => setShowCoverLetter(false)} className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{coverLetter}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center justify-center gap-1.5 text-xs text-violet-400 border border-violet-500/20 hover:bg-violet-600/10 py-2.5 rounded-xl transition-colors">
      <Plus className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

function EmptyState({ icon: Icon, label, hint }: { icon: typeof FileText; label: string; hint: string }) {
  return (
    <div className="text-center py-8">
      <Icon className="w-8 h-8 text-gray-700 mx-auto mb-2" />
      <p className="text-gray-500 text-xs font-medium">{label}</p>
      <p className="text-gray-600 text-xs mt-0.5">{hint}</p>
    </div>
  );
}

// Mini preview for template selection cards
function MiniPreview({ templateId }: { templateId: TemplateId }) {
  const theme = COLOR_THEMES[0];
  const lines = [8, 5, 3, 6, 4, 5, 3, 4];

  if (['modern', 'tech', 'corporate'].includes(templateId)) {
    return (
      <div className="flex h-full">
        <div className="w-1/3 h-full p-2" style={{ background: theme.primaryDark }}>
          <div className="w-8 h-8 rounded-full bg-white/30 mb-2" />
          <div className="h-1.5 bg-white/40 rounded mb-1 w-full" />
          <div className="h-1.5 bg-white/20 rounded mb-1 w-3/4" />
          <div className="h-1.5 bg-white/20 rounded mb-1 w-2/3" />
          <div className="h-1.5 bg-white/30 rounded mb-1 w-full mt-3" />
          <div className="h-1.5 bg-white/15 rounded mb-1 w-5/6" />
          <div className="h-1.5 bg-white/15 rounded mb-1 w-4/5" />
        </div>
        <div className="w-2/3 p-2">
          {lines.slice(0, 6).map((w, i) => (
            <div key={i} className="h-1.5 bg-gray-300 rounded mb-1.5" style={{ width: `${w * 10}%` }} />
          ))}
        </div>
      </div>
    );
  }

  if (['executive', 'finance'].includes(templateId)) {
    return (
      <div className="h-full">
        <div className="h-16 p-2 text-center" style={{ background: theme.primaryDark }}>
          <div className="h-2 bg-white/50 rounded mx-auto w-2/3 mb-1" />
          <div className="h-1.5 bg-white/30 rounded mx-auto w-1/2" />
        </div>
        <div className="p-2">
          {lines.map((w, i) => (
            <div key={i} className="h-1.5 bg-gray-300 rounded mb-1.5" style={{ width: `${w * 10}%` }} />
          ))}
        </div>
      </div>
    );
  }

  if (templateId === 'creative') {
    return (
      <div className="h-full">
        <div className="h-20 p-2" style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` }}>
          <div className="w-6 h-6 rounded-lg bg-white/30 mb-1" />
          <div className="h-2 bg-white/50 rounded w-2/3 mb-1" />
          <div className="h-1.5 bg-white/30 rounded w-1/2" />
        </div>
        <div className="p-2">
          {lines.map((w, i) => (
            <div key={i} className="h-1.5 bg-gray-300 rounded mb-1.5" style={{ width: `${w * 10}%` }} />
          ))}
        </div>
      </div>
    );
  }

  // minimal, professional, ats, healthcare, academic
  return (
    <div className="h-full p-3">
      <div className="h-2 bg-gray-700 rounded w-1/2 mb-2 mx-auto" />
      <div className="h-1.5 bg-gray-400 rounded w-1/3 mb-3 mx-auto" />
      <div className="border-b border-gray-300 mb-2" />
      {lines.map((w, i) => (
        <div key={i} className="h-1.5 bg-gray-300 rounded mb-1.5" style={{ width: `${w * 10}%` }} />
      ))}
    </div>
  );
}
