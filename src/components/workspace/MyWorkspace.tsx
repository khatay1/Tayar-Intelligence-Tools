// {t('nav.myWorkspace')} — the central hub combining recent activity, favorites, pinned files,
// project shortcuts, storage, and quick actions.

import { useState, useEffect, useCallback } from 'react';
import {
  Sparkles, Clock, Star, Pin, Folder, FileText, Mail, MessageSquare,
  Languages, GraduationCap, ArrowUpRight, Plus, Loader2,
  Zap, Crown, Activity,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAdmin } from '@/context/AdminContext';
import { supabase } from '@/lib/supabase';
import { useProjects, Project } from '@/lib/use-projects';
import { getFileMeta, timeAgo, ViewId } from './workspace-config';
import { useToast } from '@/components/ui/Toast';
import { StorageIndicator } from './StorageIndicator';
import { useTranslation } from '@/lib/i18n';
import { useLocalizer } from '@/lib/ui-localization';

interface MyWorkspaceProps {
  onNavigate: (view: ViewId, projectId?: string) => void;
}

interface ActivityEntry {
  id: string;
  action: string;
  tool: string;
  created_at: string;
}

const QUICK_ACTIONS = [
  { icon: FileText, label: 'New Resume', view: 'cv-builder' as ViewId, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { icon: Mail, label: 'Cover Letter', view: 'cover-letter' as ViewId, color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/10' },
  { icon: MessageSquare, label: 'AI Chat', view: 'ai-chat' as ViewId, color: 'text-violet-400', bg: 'bg-violet-500/10' },
  { icon: Languages, label: 'Translate', view: 'translator' as ViewId, color: 'text-sky-400', bg: 'bg-sky-500/10' },
  { icon: GraduationCap, label: 'Study Notes', view: 'study-assistant' as ViewId, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { icon: FileText, label: 'Document AI', view: 'document-ai' as ViewId, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
];

const TYPE_ICONS: Record<string, typeof FileText> = {
  cv: FileText,
  'cover-letter': Mail,
  document: FileText,
  writer: FileText,
  translation: Languages,
  study: GraduationCap,
  'ai-chat': MessageSquare,
  project: Folder,
};

export default function MyWorkspace({ onNavigate }: MyWorkspaceProps) {
  const { t } = useTranslation();
  const l = useLocalizer();
  const { user, profile } = useAuth();
  const { isAdmin } = useAdmin();
  const { createProject } = useProjects();
  const { loading, update } = useToast();
  const [recentFiles, setRecentFiles] = useState<Project[]>([]);
  const [favoriteFiles, setFavoriteFiles] = useState<Project[]>([]);
  const [pinnedFiles, setPinnedFiles] = useState<Project[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loadingState, setLoadingState] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [projectName, setProjectName] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(50);
    const all = (data as Project[]) || [];
    setRecentFiles(all.slice(0, 6));
    setFavoriteFiles(all.filter(p => (p as Project & { favorite?: boolean }).favorite).slice(0, 6));
    setPinnedFiles(all.filter(p => (p as Project & { pinned?: boolean }).pinned).slice(0, 6));

    const { data: actData } = await supabase
      .from('activity_log')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(8);
    setActivity((actData as ActivityEntry[]) || []);
    setLoadingState(false);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!showNewProject) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [showNewProject]);

  async function handleCreateProject() {
    if (!user || !projectName.trim()) return;
    const toastId = loading('Creating project...');
    const id = await createProject(user.id, projectName.trim(), 'project', {}, 'active');
    if (id) {
      update(toastId, 'Project created', 'success');
      setProjectName('');
      setShowNewProject(false);
      onNavigate('my-files', id);
      void load();
    } else {
      update(toastId, 'Failed to create project', 'error');
    }
  }

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'there';

  if (loadingState) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-violet-500 animate-spin" /></div>;
  }

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden sm:space-y-8">
      <div className="relative min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(120,80,255,0.15),transparent_70%)]" />
        <div className="absolute -top-8 -right-8 w-40 h-40 bg-violet-500/10 rounded-full blur-3xl" />
        <div className="relative z-10 flex min-w-0 flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <div className="mb-2 flex min-w-0 items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-violet-400" />
              <span className="truncate text-xs font-medium uppercase tracking-wider text-violet-400">{t('nav.myWorkspace')}</span>
            </div>
            <h1 className="mb-1 break-words text-2xl font-bold leading-tight text-white sm:text-3xl">{t('workspace.welcome')}, {displayName}</h1>
            <p className="break-words text-sm leading-6 text-gray-400">{recentFiles.length} recent files · {favoriteFiles.length} favorites · {pinnedFiles.length} pinned</p>
          </div>
          <button
            onClick={() => setShowNewProject(true)}
            className="flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-violet-500 hover:shadow-lg hover:shadow-violet-500/30 active:scale-[0.98] sm:w-auto"
          >
            <Plus className="w-4 h-4" /> {l('New Project')}
          </button>
        </div>
      </div>

      <div className="min-w-0">
        <h2 className="mb-3 text-base font-bold text-white">{t('workspace.quickActions')}</h2>
        <div className="grid min-w-0 grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
          {QUICK_ACTIONS.map(action => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={() => onNavigate(action.view)}
                className="group flex min-h-24 min-w-0 flex-col items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-center transition-all hover:border-violet-500/30 hover:bg-white/[0.05] sm:p-4"
              >
                <div className={`w-10 h-10 shrink-0 rounded-xl ${action.bg} flex items-center justify-center group-hover:scale-110 transition-transform`}><Icon className={`w-5 h-5 ${action.color}`} /></div>
                <span className="max-w-full break-words text-xs font-medium leading-4 text-white">{l(action.label)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {pinnedFiles.length > 0 && (
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-3"><Pin className="w-4 h-4 text-violet-400" /><h2 className="text-white font-bold text-base">{t('workspace.pinned')}</h2></div>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">{pinnedFiles.map(project => <FileRow key={project.id} project={project} onOpen={() => onNavigate(project.type as ViewId, project.id)} />)}</div>
        </div>
      )}

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-3"><Clock className="w-4 h-4 text-sky-400" /><h2 className="text-white font-bold text-base">{t('workspace.recentFiles')}</h2></div>
          {recentFiles.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center"><Clock className="w-6 h-6 text-gray-600 mx-auto mb-2" /><p className="text-gray-500 text-xs">{t('workspace.filesWillAppear')}</p></div>
          ) : <div className="min-w-0 space-y-2">{recentFiles.map(project => <FileRow key={project.id} project={project} onOpen={() => onNavigate(project.type as ViewId, project.id)} compact />)}</div>}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-3"><Star className="w-4 h-4 text-amber-400" /><h2 className="text-white font-bold text-base">{t('workspace.favorites')}</h2></div>
          {favoriteFiles.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center"><Star className="w-6 h-6 text-gray-600 mx-auto mb-2" /><p className="text-gray-500 text-xs">{t('workspace.starFiles')}</p></div>
          ) : <div className="min-w-0 space-y-2">{favoriteFiles.map(project => <FileRow key={project.id} project={project} onOpen={() => onNavigate(project.type as ViewId, project.id)} compact />)}</div>}
        </div>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <div className="flex items-center gap-2 mb-3"><Activity className="w-4 h-4 text-violet-400" /><h2 className="text-white font-bold text-base">{t('workspace.recentActivity')}</h2></div>
          <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur-xl sm:p-4">
            {activity.length === 0 ? (
              <div className="py-6 text-center"><Zap className="w-6 h-6 text-gray-600 mx-auto mb-2" /><p className="text-gray-500 text-xs">{t('workspace.noRecentActivity')}</p></div>
            ) : (
              <div className="space-y-1">
                {activity.map((entry, i) => (
                  <div key={entry.id} className={`flex min-w-0 items-start gap-3 py-2.5 ${i !== activity.length - 1 ? 'border-b border-white/5' : ''}`}>
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/10"><div className="h-2 w-2 rounded-full bg-violet-400" /></div>
                    <div className="min-w-0 flex-1"><div className="break-words text-xs font-medium text-white">{entry.action}</div><div className="mt-0.5 break-words text-xs leading-5 text-gray-500">{entry.tool} · {timeAgo(entry.created_at)}</div></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0">
          <StorageIndicator />
          {!isAdmin && <div className="relative mt-4 min-w-0 overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-600/20 to-fuchsia-600/10 p-4">
            <div className="absolute -top-4 -right-4 w-20 h-20 bg-violet-500/20 rounded-full blur-2xl" />
            <div className="relative min-w-0"><div className="mb-1.5 flex items-center gap-2"><Crown className="w-4 h-4 shrink-0 text-amber-400" /><p className="break-words text-sm font-semibold text-white">{t('workspace.upgradePro')}</p></div><p className="mb-3 break-words text-xs leading-5 text-gray-400">{t('workspace.unlockPro')}</p><button onClick={() => onNavigate('subscription')} className="min-h-11 w-full rounded-lg bg-violet-600 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-500">{l('Upgrade Now')}</button></div>
          </div>}
        </div>
      </div>

      {showNewProject && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setShowNewProject(false)}>
          <div className="w-full max-w-sm max-h-[85dvh] overflow-y-auto rounded-t-2xl border border-white/10 bg-[#12122a] p-4 sm:rounded-2xl sm:p-6" onClick={e => e.stopPropagation()} style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
            <div className="mb-4 flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10"><Folder className="w-5 h-5 text-violet-400" /></div>
              <div className="min-w-0"><h3 className="break-words text-base font-bold text-white">{t('workspace.newProject')}</h3><p className="break-words text-xs leading-5 text-gray-500">{t('workspace.organizeFiles')}</p></div>
            </div>
            <input
              autoFocus
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && void handleCreateProject()}
              className="min-h-11 w-full min-w-0 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white transition-all focus:border-violet-500/50 focus:outline-none"
              placeholder={t('workspace.projectName')}
            />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => setShowNewProject(false)} className="min-h-11 rounded-lg text-sm text-gray-400 transition-colors hover:bg-white/5 hover:text-white">{t('workspace.cancel')}</button>
              <button onClick={() => void handleCreateProject()} disabled={!projectName.trim()} className="min-h-11 rounded-lg bg-violet-600 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-60">{t('workspace.create')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FileRow({ project, onOpen, compact }: { project: Project; onOpen: () => void; compact?: boolean }) {
  const l = useLocalizer();
  const meta = getFileMeta(project.type);
  const Icon = TYPE_ICONS[project.type] || FileText;
  const isFavorite = (project as Project & { favorite?: boolean }).favorite;
  const isPinned = (project as Project & { pinned?: boolean }).pinned;

  return (
    <button
      onClick={onOpen}
      className={`w-full min-w-0 flex items-center gap-3 bg-white/[0.03] border border-white/10 rounded-2xl ${compact ? 'p-3' : 'p-4'} hover:border-violet-500/30 hover:bg-white/[0.05] transition-all text-left`}
    >
      <div className={`w-9 h-9 rounded-lg ${meta.bg} flex items-center justify-center flex-shrink-0`}><Icon className={`w-4 h-4 ${meta.color}`} /></div>
      <div className="flex-1 min-w-0">
        <div className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-white"><span className="min-w-0 truncate">{project.title}</span>{isPinned && <Pin className="w-3 h-3 shrink-0 text-violet-400 fill-violet-400" />}{isFavorite && <Star className="w-3 h-3 shrink-0 text-amber-400 fill-amber-400" />}</div>
        <div className="truncate text-xs text-gray-500">{l(meta.label)} · {timeAgo(project.updated_at)}</div>
      </div>
      <ArrowUpRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
    </button>
  );
}
