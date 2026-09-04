import { useLocalizer } from '@/lib/ui-localization';
// Upgraded File Manager — search, filter, sort, rename, duplicate, move, delete,
// favorites, pin, grid/list views, storage indicator, beautiful empty states.

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, Grid3x3, List, Star, Trash2, FileText, Loader2, FolderOpen,
  MoreVertical, Copy, Edit2, Pin, ArrowUpDown, Folder, Heart,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useProjects, Project } from '@/lib/use-projects';
import { useToast } from '@/components/ui/Toast';
import { getFileMeta, timeAgo, ViewId } from './workspace-config';
import { EmptyState } from '@/components/ui/EmptyState';
import { StorageIndicator } from './StorageIndicator';
import { normalizePublishedSiteUrl } from '@/lib/published-site-url';

type SortBy = 'updated' | 'created' | 'name' | 'size';
type SortDir = 'asc' | 'desc';

const TYPE_FILTERS = [
  { value: 'all', label: 'All Files' },
  { value: 'cv', label: 'CVs' },
  { value: 'cover-letter', label: 'Cover Letters' },
  { value: 'document', label: 'Documents' },
  { value: 'writer', label: 'Articles' },
  { value: 'translation', label: 'Translations' },
  { value: 'study', label: 'Study Notes' },
  { value: 'ai-chat', label: 'AI Chats' },
  { value: 'project', label: 'Projects' },
  { value: 'website-builder', label: 'Websites' },
];

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'updated', label: 'Last Updated' },
  { value: 'created', label: 'Date Created' },
  { value: 'name', label: 'Name (A-Z)' },
  { value: 'size', label: 'Size' },
];

interface FileManagerProps {
  onNavigate: (view: ViewId, projectId?: string) => void;
}

export default function FileManager({ onNavigate }: FileManagerProps) {
  const l = useLocalizer();
  const { user } = useAuth();
  const userId = user?.id;
  const { renameProject, duplicateProject } = useProjects();
  const { success, error: showError } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SortBy>('updated');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [movingItem, setMovingItem] = useState<Project | null>(null);
  const [parentProjects, setParentProjects] = useState<Project[]>([]);

  const refreshProjects = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });
    setProjects((data as Project[]) || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    void refreshProjects();
    void supabase
      .from('projects')
      .select('id, title')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .is('parent_project_id', null)
      .order('title')
      .then(({ data }) => setParentProjects((data as Project[]) || []));
  }, [refreshProjects, userId]);

  useEffect(() => {
    if (!renaming && !movingItem) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [renaming, movingItem]);

  async function handleDelete(id: string) {
    setMenuOpen(null);
    const { error: err } = await supabase.from('projects').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (err) { showError('Failed to delete'); return; }
    setProjects(prev => prev.filter(p => p.id !== id));
    success('Moved to trash');
  }

  async function handleDuplicate(project: Project) {
    setMenuOpen(null);
    const newId = await duplicateProject(project);
    if (newId) await refreshProjects();
  }

  async function handleToggleFavorite(project: Project) {
    setMenuOpen(null);
    const newVal = !((project as Project & { favorite?: boolean }).favorite);
    await supabase.from('projects').update({ favorite: newVal }).eq('id', project.id);
    setProjects(prev => prev.map(p => p.id === project.id ? { ...p, favorite: newVal } as Project : p));
  }

  async function handleTogglePin(project: Project) {
    setMenuOpen(null);
    const newVal = !((project as Project & { pinned?: boolean }).pinned);
    await supabase.from('projects').update({ pinned: newVal }).eq('id', project.id);
    setProjects(prev => prev.map(p => p.id === project.id ? { ...p, pinned: newVal } as Project : p));
  }

  async function handleMove(projectId: string, parentId: string | null) {
    setMenuOpen(null);
    const { error: err } = await supabase.from('projects').update({ parent_project_id: parentId }).eq('id', projectId);
    if (err) { showError('Failed to move'); return; }
    success('Moved successfully');
    setMovingItem(null);
    await refreshProjects();
  }

  function startRename(project: Project) {
    setMenuOpen(null);
    setRenaming(project.id);
    setRenameValue(project.title);
  }

  async function confirmRename() {
    if (!renaming || !renameValue.trim()) return;
    const ok = await renameProject(renaming, renameValue.trim());
    if (ok) setProjects(prev => prev.map(p => p.id === renaming ? { ...p, title: renameValue.trim() } : p));
    setRenaming(null);
  }

  const filtered = useMemo(() => {
    let result = [...projects];
    if (filter !== 'all') result = result.filter(p => p.type === filter);
    if (showFavoritesOnly) result = result.filter(p => (p as Project & { favorite?: boolean }).favorite);
    if (showPinnedOnly) result = result.filter(p => (p as Project & { pinned?: boolean }).pinned);
    if (search) result = result.filter(p => p.title.toLowerCase().includes(search.toLowerCase()));

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'updated': cmp = new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(); break;
        case 'created': cmp = new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); break;
        case 'name': cmp = a.title.localeCompare(b.title); break;
        case 'size': cmp = JSON.stringify(b.content || {}).length - JSON.stringify(a.content || {}).length; break;
      }
      return sortDir === 'asc' ? -cmp : cmp;
    });
    return result;
  }, [projects, filter, search, sortBy, sortDir, showFavoritesOnly, showPinnedOnly]);

  const pinnedCount = projects.filter(p => (p as Project & { pinned?: boolean }).pinned).length;
  const favoriteCount = projects.filter(p => (p as Project & { favorite?: boolean }).favorite).length;

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <div className="min-w-0">
        <h1 className="mb-1 break-words text-2xl font-bold text-white">{l('My Files')}</h1>
        <p className="break-words text-sm leading-6 text-gray-500">{l('All your generated documents, CVs, translations, chats and projects in one place.')}</p>
      </div>

      <div className="grid min-w-0 grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        {[
          { value: projects.length, label: 'Total Files', color: 'text-white' },
          { value: projects.filter(p => p.status === 'completed').length, label: 'Completed', color: 'text-emerald-400' },
          { value: projects.filter(p => p.status === 'draft').length, label: 'Drafts', color: 'text-amber-400' },
          { value: favoriteCount, label: 'Favorites', color: 'text-violet-400' },
        ].map(item => (
          <div key={item.label} className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur-xl sm:p-4">
            <div className={`truncate text-xl font-bold sm:text-2xl ${item.color}`}>{item.value}</div>
            <div className="mt-0.5 break-words text-xs text-gray-500">{l(item.label)}</div>
          </div>
        ))}
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={l('Search files...')}
            className="min-h-11 w-full min-w-0 rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-4 text-sm text-white transition-all placeholder:text-gray-600 focus:border-violet-500/50 focus:outline-none"
          />
        </div>
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <button onClick={() => setShowFavoritesOnly(!showFavoritesOnly)} className={`flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${showFavoritesOnly ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}><Heart className={`h-4 w-4 shrink-0 ${showFavoritesOnly ? 'fill-amber-400' : ''}`} /><span className="truncate">{l('Favorites')}</span></button>
          <button onClick={() => setShowPinnedOnly(!showPinnedOnly)} className={`flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${showPinnedOnly ? 'bg-violet-500/10 border-violet-500/20 text-violet-400' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}><Pin className={`h-4 w-4 shrink-0 ${showPinnedOnly ? 'fill-violet-400' : ''}`} /><span className="truncate">{l('Pinned')}</span></button>
          <select value={filter} onChange={e => setFilter(e.target.value)} className="min-h-11 min-w-0 w-full rounded-xl border border-white/10 bg-[#111122] px-3 py-2.5 text-sm text-white focus:outline-none sm:w-auto">{TYPE_FILTERS.map(t => <option key={t.value} value={t.value}>{l(t.label)}</option>)}</select>
          <div className="col-span-2 flex min-w-0 items-center rounded-xl border border-white/10 bg-white/5 sm:col-span-1">
            <select value={sortBy} onChange={e => setSortBy(e.target.value as SortBy)} className="min-h-11 min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-white focus:outline-none sm:flex-none"><option value="updated">{l('Last Updated')}</option><option value="created">{l('Date Created')}</option><option value="name">{l('Name (A-Z)')}</option><option value="size">{l('Size')}</option></select>
            <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')} className="flex h-11 w-11 shrink-0 items-center justify-center text-gray-400 transition-colors hover:text-white" aria-label={l('Change sort direction')}><ArrowUpDown className="w-4 h-4" /></button>
          </div>
          <div className="col-span-2 grid min-h-11 grid-cols-2 items-center rounded-xl border border-white/10 bg-white/5 p-0.5 sm:col-span-1 sm:flex">
            <button onClick={() => setView('grid')} className={`flex min-h-10 items-center justify-center rounded-lg px-3 transition-colors ${view === 'grid' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'}`} aria-label={l('Grid view')}><Grid3x3 className="w-4 h-4" /></button>
            <button onClick={() => setView('list')} className={`flex min-h-10 items-center justify-center rounded-lg px-3 transition-colors ${view === 'list' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'}`} aria-label={l('List view')}><List className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {pinnedCount > 0 && !showPinnedOnly && !search && filter === 'all' && !showFavoritesOnly && (
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-3"><Pin className="w-4 h-4 text-violet-400" /><h2 className="text-white font-bold text-base">{l('Pinned')}</h2></div>
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {projects.filter(p => (p as Project & { pinned?: boolean }).pinned).map((project, i) => <FileCard key={project.id} project={project} view="grid" index={i} onOpen={() => onNavigate(project.type as ViewId, project.id)} menuOpen={menuOpen} setMenuOpen={setMenuOpen} onDelete={handleDelete} onDuplicate={handleDuplicate} onRename={startRename} onToggleFavorite={handleToggleFavorite} onTogglePin={handleTogglePin} onMove={setMovingItem} />)}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-violet-500 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={FolderOpen} title={search ? l('No matching files') : l('No files yet')} description={search ? l('Try a different search term.') : l("Create documents with any AI tool and they'll appear here automatically.")} variant="files" />
      ) : view === 'grid' ? (
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((project, i) => <FileCard key={project.id} project={project} view="grid" index={i} onOpen={() => onNavigate(project.type as ViewId, project.id)} menuOpen={menuOpen} setMenuOpen={setMenuOpen} onDelete={handleDelete} onDuplicate={handleDuplicate} onRename={startRename} onToggleFavorite={handleToggleFavorite} onTogglePin={handleTogglePin} onMove={setMovingItem} />)}
        </div>
      ) : (
        <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl">
          {filtered.map((project, i) => <FileCard key={project.id} project={project} view="list" index={i} isFirst={i === 0} isLast={i === filtered.length - 1} onOpen={() => onNavigate(project.type as ViewId, project.id)} menuOpen={menuOpen} setMenuOpen={setMenuOpen} onDelete={handleDelete} onDuplicate={handleDuplicate} onRename={startRename} onToggleFavorite={handleToggleFavorite} onTogglePin={handleTogglePin} onMove={setMovingItem} />)}
        </div>
      )}

      <StorageIndicator />

      {renaming && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setRenaming(null)}>
          <div className="w-full max-w-sm rounded-t-2xl border border-white/10 bg-[#12122a] p-4 sm:rounded-2xl sm:p-6" onClick={e => e.stopPropagation()} style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
            <h3 className="mb-4 break-words text-base font-bold text-white">{l('Rename')}</h3>
            <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && void confirmRename()} className="min-h-11 w-full min-w-0 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white transition-all focus:border-violet-500/50 focus:outline-none" placeholder={l('File name')} />
            <div className="mt-4 grid grid-cols-2 gap-2"><button onClick={() => setRenaming(null)} className="min-h-11 rounded-lg text-sm text-gray-400 transition-colors hover:bg-white/5 hover:text-white">{l('Cancel')}</button><button onClick={() => void confirmRename()} className="min-h-11 rounded-lg bg-violet-600 text-sm font-medium text-white transition-colors hover:bg-violet-500">{l('Rename')}</button></div>
          </div>
        </div>
      )}

      {movingItem && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setMovingItem(null)}>
          <div className="w-full max-w-sm max-h-[85dvh] overflow-y-auto rounded-t-2xl border border-white/10 bg-[#12122a] p-4 sm:rounded-2xl sm:p-6" onClick={e => e.stopPropagation()} style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
            <h3 className="mb-4 break-words text-base font-bold text-white">{l('Move')} "{movingItem.title}" {l('to...')}</h3>
            <div className="max-h-[50dvh] space-y-1 overflow-y-auto overscroll-contain">
              <button onClick={() => void handleMove(movingItem.id, null)} className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-gray-300 transition-colors hover:bg-white/5"><FolderOpen className="w-4 h-4 shrink-0 text-gray-500" /> <span className="min-w-0 break-words">{l('Root (no project)')}</span></button>
              {parentProjects.filter(p => p.id !== movingItem.id).map(p => <button key={p.id} onClick={() => void handleMove(movingItem.id, p.id)} className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-gray-300 transition-colors hover:bg-white/5"><Folder className="w-4 h-4 shrink-0 text-amber-400" /><span className="min-w-0 break-words">{p.title}</span></button>)}
            </div>
            <button onClick={() => setMovingItem(null)} className="mt-4 min-h-11 w-full rounded-lg py-2 text-sm text-gray-400 transition-colors hover:bg-white/5 hover:text-white">{l('Cancel')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

interface FileCardProps {
  project: Project;
  view: 'grid' | 'list';
  index: number;
  isFirst?: boolean;
  isLast?: boolean;
  onOpen: () => void;
  menuOpen: string | null;
  setMenuOpen: (id: string | null) => void;
  onDelete: (id: string) => void;
  onDuplicate: (p: Project) => void;
  onRename: (p: Project) => void;
  onToggleFavorite: (p: Project) => void;
  onTogglePin: (p: Project) => void;
  onMove: (p: Project) => void;
}

function FileCard({ project, view, index, isFirst: _isFirst, isLast, onOpen, menuOpen, setMenuOpen, onDelete, onDuplicate, onRename, onToggleFavorite, onTogglePin, onMove }: FileCardProps) {
  const l = useLocalizer();
  const meta = getFileMeta(project.type);
  const isFavorite = (project as Project & { favorite?: boolean }).favorite;
  const isPinned = (project as Project & { pinned?: boolean }).pinned;
  const isWebsite = project.type === 'website-builder';
  const websiteLive = isWebsite && project.status === 'completed' && Boolean((project.content as { publishedUrl?: unknown } | null)?.publishedUrl);
  const statusLabel = isWebsite ? (websiteLive ? 'Live Website' : 'Website Draft') : (project.status === 'completed' ? 'Completed' : 'Draft');
  const statusClass = websiteLive || (!isWebsite && project.status === 'completed') ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400';
  const liveUrl = websiteLive ? normalizePublishedSiteUrl(String((project.content as { publishedUrl?: unknown } | null)?.publishedUrl || '')) : '';

  if (view === 'list') {
    return (
      <div className={`relative flex min-w-0 flex-wrap items-center gap-3 px-3 py-3 transition-colors hover:bg-white/5 sm:flex-nowrap sm:px-4 ${!isLast ? 'border-b border-white/5' : ''} ${menuOpen === project.id ? 'z-[100]' : 'z-10'}`}>
        <button onClick={onOpen} className="flex min-w-0 flex-[1_1_14rem] items-center gap-3 text-left">
          <div className={`w-9 h-9 rounded-lg ${meta.bg} flex items-center justify-center flex-shrink-0`}><FileText className={`w-4 h-4 ${meta.color}`} /></div>
          <div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-white"><span className="min-w-0 truncate">{project.title}</span>{isPinned && <Pin className="w-3 h-3 shrink-0 text-violet-400 fill-violet-400" />}</div><div className="truncate text-xs text-gray-500">{l(meta.label)} · {timeAgo(project.updated_at)}</div></div>
        </button>
        <div className="flex min-w-0 flex-[1_1_100%] items-center justify-end gap-1 sm:flex-[0_0_auto]">
          {isFavorite && <Star className="w-3.5 h-3.5 shrink-0 text-amber-400 fill-amber-400" />}
          <span className={`max-w-[9rem] truncate rounded-full px-2 py-0.5 text-xs ${statusClass}`}>{l(statusLabel)}</span>
          {liveUrl && <button type="button" onClick={() => window.open(liveUrl, '_blank', 'noopener,noreferrer')} className="hidden text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 sm:inline" title={liveUrl}>{l('Open live ↗')}</button>}
          <FileMenu isOpen={menuOpen === project.id} onToggle={() => setMenuOpen(menuOpen === project.id ? null : project.id)} onDelete={() => onDelete(project.id)} onDuplicate={() => onDuplicate(project)} onRename={() => onRename(project)} onToggleFavorite={() => onToggleFavorite(project)} onTogglePin={() => onTogglePin(project)} onMove={() => onMove(project)} />
        </div>
      </div>
    );
  }

  return (
    <div className={`group relative min-w-0 ${menuOpen === project.id ? 'z-[100]' : 'z-10'} rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-all duration-300 hover:border-violet-500/30 sm:p-5`} style={{ animation: 'fadeInUp 0.3s ease-out both', animationDelay: `${index * 0.04}s` }}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <button onClick={onOpen} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${meta.bg} transition-transform group-hover:scale-105`}><FileText className={`w-5 h-5 ${meta.color}`} /></button>
        <div className="flex min-w-0 items-center gap-1">{isFavorite && <Star className="w-3.5 h-3.5 shrink-0 text-amber-400 fill-amber-400" />}{isPinned && <Pin className="w-3.5 h-3.5 shrink-0 text-violet-400 fill-violet-400" />}<FileMenu isOpen={menuOpen === project.id} onToggle={() => setMenuOpen(menuOpen === project.id ? null : project.id)} onDelete={() => onDelete(project.id)} onDuplicate={() => onDuplicate(project)} onRename={() => onRename(project)} onToggleFavorite={() => onToggleFavorite(project)} onTogglePin={() => onTogglePin(project)} onMove={() => onMove(project)} /></div>
      </div>
      <button onClick={onOpen} className="block min-w-0 w-full text-left"><h3 className="mb-1 truncate text-sm font-semibold text-white">{project.title}</h3><div className="mb-3 flex min-w-0 items-center gap-2 text-xs text-gray-500"><span className={`min-w-0 truncate ${meta.color}`}>{l(meta.label)}</span><span className="shrink-0">·</span><span className="shrink-0">{timeAgo(project.updated_at)}</span></div><span className={`inline-block max-w-full truncate rounded-full px-2 py-0.5 text-xs ${statusClass}`}>{l(statusLabel)}</span></button>
      {liveUrl && <button type="button" onClick={() => window.open(liveUrl, '_blank', 'noopener,noreferrer')} className="mt-3 min-h-11 text-[10px] font-semibold text-emerald-400 hover:text-emerald-300" title={liveUrl}>{l('Open live site ↗')}</button>}
    </div>
  );
}

function FileMenu({ isOpen, onToggle, onDelete, onDuplicate, onRename, onToggleFavorite, onTogglePin, onMove }: { isOpen: boolean; onToggle: () => void; onDelete: () => void; onDuplicate: () => void; onRename: () => void; onToggleFavorite: () => void; onTogglePin: () => void; onMove: () => void; }) {
  const l = useLocalizer();
  return (
    <div className="relative flex-shrink-0">
      <button onClick={(e) => { e.stopPropagation(); onToggle(); }} className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white/10 hover:text-white" aria-label={l('File actions')}><MoreVertical className="w-4 h-4" /></button>
      {isOpen && (
        <div className="absolute right-0 top-full z-[99999] mt-1 w-44 max-w-[calc(100vw-1rem)] rounded-xl border border-white/10 bg-[#12122a] p-1.5 shadow-2xl shadow-black/50" onClick={e => e.stopPropagation()}>
          <button onClick={onRename} className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-white/5"><Edit2 className="w-3.5 h-3.5" /> {l('Rename')}</button>
          <button onClick={onDuplicate} className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-white/5"><Copy className="w-3.5 h-3.5" /> {l('Duplicate')}</button>
          <button onClick={onMove} className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-white/5"><Folder className="w-3.5 h-3.5" /> {l('Move')}</button>
          <div className="h-px bg-white/5 my-1" />
          <button onClick={onToggleFavorite} className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-white/5"><Star className="w-3.5 h-3.5" /> {l('Favorite')}</button>
          <button onClick={onTogglePin} className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-white/5"><Pin className="w-3.5 h-3.5" /> {l('Pin')}</button>
          <div className="h-px bg-white/5 my-1" />
          <button onClick={onDelete} className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10"><Trash2 className="w-3.5 h-3.5" /> {l('Delete')}</button>
        </div>
      )}
    </div>
  );
}
