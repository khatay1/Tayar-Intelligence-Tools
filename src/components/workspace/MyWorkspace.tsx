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
  'cv': FileText,
  'cover-letter': Mail,
  'document': FileText,
  'writer': FileText,
  'translation': Languages,
  'study': GraduationCap,
  'ai-chat': MessageSquare,
  'project': Folder,
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

  useEffect(() => { load(); }, [load]);

  async function handleCreateProject() {
    if (!user || !projectName.trim()) return;
    const toastId = loading('Creating project...');
    const id = await createProject(user.id, projectName.trim(), 'project', {}, 'active');
    if (id) {
      update(toastId, 'Project created', 'success');
      setProjectName('');
      setShowNewProject(false);
      onNavigate('my-files', id);
      load();
    } else {
      update(toastId, 'Failed to create project', 'error');
    }
  }

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'there';

  if (loadingState) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-violet-500 animate-spin" /></div>;
  }

  return (
    <div className="space-y-8">
      {/* Welcome banner */}
      <div className="relative bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(120,80,255,0.15),transparent_70%)]" />
        <div className="absolute -top-8 -right-8 w-40 h-40 bg-violet-500/10 rounded-full blur-3xl" />
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <span className="text-violet-400 text-xs font-medium uppercase tracking-wider">{t('nav.myWorkspace')}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">{t('workspace.welcome')}, {displayName}</h1>
            <p className="text-gray-400 text-sm">{recentFiles.length} recent files · {favoriteFiles.length} favorites · {pinnedFiles.length} pinned</p>
          </div>
          <button
            onClick={() => setShowNewProject(true)}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all hover:shadow-lg hover:shadow-violet-500/30 active:scale-95 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> {l('New Project')}
          </button>
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-white font-bold text-base mb-3">{t('workspace.quickActions')}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {QUICK_ACTIONS.map(action => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={() => onNavigate(action.view)}
                className="group flex flex-col items-center gap-2 bg-white/[0.03] border border-white/10 rounded-2xl p-4 hover:border-violet-500/30 hover:bg-white/[0.05] transition-all"
              >
                <div className={`w-10 h-10 rounded-xl ${action.bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <Icon className={`w-5 h-5 ${action.color}`} />
                </div>
                <span className="text-white text-xs font-medium">{l(action.label)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Pinned files */}
      {pinnedFiles.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Pin className="w-4 h-4 text-violet-400" />
            <h2 className="text-white font-bold text-base">{t('workspace.pinned')}</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pinnedFiles.map(project => (
              <FileRow key={project.id} project={project} onOpen={() => onNavigate(project.type as ViewId, project.id)} />
            ))}
          </div>
        </div>
      )}

      {/* Two-column: Recent + Favorites */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-sky-400" />
            <h2 className="text-white font-bold text-base">{t('workspace.recentFiles')}</h2>
          </div>
          {recentFiles.length === 0 ? (
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 text-center">
              <Clock className="w-6 h-6 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-500 text-xs">{t('workspace.filesWillAppear')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentFiles.map(project => (
                <FileRow key={project.id} project={project} onOpen={() => onNavigate(project.type as ViewId, project.id)} compact />
              ))}
            </div>
          )}
        </div>

        {/* Favorites */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-4 h-4 text-amber-400" />
            <h2 className="text-white font-bold text-base">{t('workspace.favorites')}</h2>
          </div>
          {favoriteFiles.length === 0 ? (
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 text-center">
              <Star className="w-6 h-6 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-500 text-xs">{t('workspace.starFiles')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {favoriteFiles.map(project => (
                <FileRow key={project.id} project={project} onOpen={() => onNavigate(project.type as ViewId, project.id)} compact />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Activity + Storage */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-violet-400" />
            <h2 className="text-white font-bold text-base">{t('workspace.recentActivity')}</h2>
          </div>
          <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-4">
            {activity.length === 0 ? (
              <div className="py-6 text-center">
                <Zap className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-500 text-xs">{t('workspace.noRecentActivity')}</p>
              </div>
            ) : (
              <div className="space-y-1">
                {activity.map((entry, i) => (
                  <div key={entry.id} className={`flex items-start gap-3 py-2.5 ${i !== activity.length - 1 ? 'border-b border-white/5' : ''}`}>
                    <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-xs font-medium">{entry.action}</div>
                      <div className="text-gray-500 text-xs">{entry.tool} · {timeAgo(entry.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <StorageIndicator />
          {!isAdmin && <div className="mt-4 relative bg-gradient-to-br from-violet-600/20 to-fuchsia-600/10 border border-violet-500/20 rounded-2xl p-4 overflow-hidden">
            <div className="absolute -top-4 -right-4 w-20 h-20 bg-violet-500/20 rounded-full blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-1.5">
                <Crown className="w-4 h-4 text-amber-400" />
                <p className="text-white text-sm font-semibold">{t('workspace.upgradePro')}</p>
              </div>
              <p className="text-gray-400 text-xs mb-3">{t('workspace.unlockPro')}</p>
              <button
                onClick={() => onNavigate('subscription')}
                className="w-full bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold py-2 rounded-lg transition-colors"
              >
                {l('Upgrade Now')}
              </button>
            </div>
          </div>}
        </div>
      </div>

      {/* New project modal */}
      {showNewProject && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowNewProject(false)}>
          <div className="bg-[#12122a] border border-white/10 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <Folder className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h3 className="text-white font-bold text-base">{t('workspace.newProject')}</h3>
                <p className="text-gray-500 text-xs">{t('workspace.organizeFiles')}</p>
              </div>
            </div>
            <input
              autoFocus
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateProject()}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-violet-500/50 focus:outline-none transition-all"
              placeholder={t("workspace.projectName")}
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowNewProject(false)} className="flex-1 text-gray-400 hover:text-white text-sm py-2 rounded-lg hover:bg-white/5 transition-colors">{t('workspace.cancel')}</button>
              <button onClick={handleCreateProject} disabled={!projectName.trim()} className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-medium py-2 rounded-lg transition-colors">{t('workspace.create')}</button>
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
      className={`w-full flex items-center gap-3 bg-white/[0.03] border border-white/10 rounded-2xl ${compact ? 'p-3' : 'p-4'} hover:border-violet-500/30 hover:bg-white/[0.05] transition-all text-left`}
    >
      <div className={`w-9 h-9 rounded-lg ${meta.bg} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-4 h-4 ${meta.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-white text-sm font-medium truncate flex items-center gap-1.5">
          {project.title}
          {isPinned && <Pin className="w-3 h-3 text-violet-400 fill-violet-400" />}
          {isFavorite && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
        </div>
        <div className="text-gray-500 text-xs">{l(meta.label)} · {timeAgo(project.updated_at)}</div>
      </div>
      <ArrowUpRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
    </button>
  );
}
