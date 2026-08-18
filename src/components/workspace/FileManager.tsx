// Upgraded File Manager — search, filter, sort, rename, duplicate, move, delete,
// favorites, pin, grid/list views, storage indicator, beautiful empty states.

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, Grid3x3, List, Star, Trash2, FileText, Loader2, FolderOpen,
  MoreVertical, Copy, Edit2, X, Pin, ArrowUpDown, Folder, Heart,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useProjects, Project } from '@/lib/use-projects';
import { useToast } from '@/components/ui/Toast';
import { getFileMeta, timeAgo, ViewId } from './workspace-config';
import { EmptyState } from '@/components/ui/EmptyState';
import { StorageIndicator } from './StorageIndicator';

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
  const { user } = useAuth();
  const { deleteProject, renameProject, duplicateProject } = useProjects();
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

  useEffect(() => {
    if (!user) return;
    refreshProjects();
    supabase
      .from('projects')
      .select('id, title')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .is('parent_project_id', null)
      .order('title')
      .then(({ data }) => setParentProjects((data as Project[]) || []));
  }, [user]);

  const refreshProjects = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });
    setProjects((data as Project[]) || []);
    setLoading(false);
  }, [user]);

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
    if (ok) {
      setProjects(prev => prev.map(p => p.id === renaming ? { ...p, title: renameValue.trim() } : p));
    }
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">My Files</h1>
        <p className="text-gray-500 text-sm">All your generated documents, CVs, translations, chats and projects in one place.</p>
      </div>

      {/* Stats + Storage */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-4">
          <div className="text-2xl font-bold text-white">{projects.length}</div>
          <div className="text-gray-500 text-xs mt-0.5">Total Files</div>
        </div>
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-4">
          <div className="text-2xl font-bold text-emerald-400">{projects.filter(p => p.status === 'completed').length}</div>
          <div className="text-gray-500 text-xs mt-0.5">Completed</div>
        </div>
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-4">
          <div className="text-2xl font-bold text-amber-400">{projects.filter(p => p.status === 'draft').length}</div>
          <div className="text-gray-500 text-xs mt-0.5">Drafts</div>
        </div>
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-4">
          <div className="text-2xl font-bold text-violet-400">{favoriteCount}</div>
          <div className="text-gray-500 text-xs mt-0.5">Favorites</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search files..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm placeholder:text-gray-600 focus:border-violet-500/50 focus:outline-none transition-all"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Favorites toggle */}
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all border ${
              showFavoritesOnly ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
            }`}
          >
            <Heart className={`w-4 h-4 ${showFavoritesOnly ? 'fill-amber-400' : ''}`} /> <span className="hidden sm:inline">Favorites</span>
          </button>
          {/* Pinned toggle */}
          <button
            onClick={() => setShowPinnedOnly(!showPinnedOnly)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all border ${
              showPinnedOnly ? 'bg-violet-500/10 border-violet-500/20 text-violet-400' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
            }`}
          >
            <Pin className={`w-4 h-4 ${showPinnedOnly ? 'fill-violet-400' : ''}`} /> <span className="hidden sm:inline">Pinned</span>
          </button>
          {/* Type filter */}
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none cursor-pointer"
          >
            {TYPE_FILTERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          {/* Sort */}
          <div className="flex items-center bg-white/5 border border-white/10 rounded-xl">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortBy)}
              className="bg-transparent px-3 py-2.5 text-white text-sm focus:outline-none cursor-pointer"
            >
              {SORT_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <button
              onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
              className="px-2 py-2.5 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>
          </div>
          {/* View toggle */}
          <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-0.5">
            <button onClick={() => setView('grid')} className={`p-2 rounded-lg transition-colors ${view === 'grid' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              <Grid3x3 className="w-4 h-4" />
            </button>
            <button onClick={() => setView('list')} className={`p-2 rounded-lg transition-colors ${view === 'list' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Pinned section */}
      {pinnedCount > 0 && !showPinnedOnly && !search && filter === 'all' && !showFavoritesOnly && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Pin className="w-4 h-4 text-violet-400" />
            <h2 className="text-white font-bold text-base">Pinned</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {projects.filter(p => (p as Project & { pinned?: boolean }).pinned).map((project, i) => (
              <FileCard key={project.id} project={project} view="grid" index={i} onOpen={() => onNavigate(project.type as ViewId, project.id)} menuOpen={menuOpen} setMenuOpen={setMenuOpen} onDelete={handleDelete} onDuplicate={handleDuplicate} onRename={startRename} onToggleFavorite={handleToggleFavorite} onTogglePin={handleTogglePin} onMove={setMovingItem} />
            ))}
          </div>
        </div>
      )}

      {/* Files */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-violet-500 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title={search ? 'No matching files' : 'No files yet'}
          description={search ? 'Try a different search term.' : 'Create documents with any AI tool and they\'ll appear here automatically.'}
          variant="files"
        />
      ) : view === 'grid' ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((project, i) => (
            <FileCard
              key={project.id}
              project={project}
              view="grid"
              index={i}
              onOpen={() => onNavigate(project.type as ViewId, project.id)}
              menuOpen={menuOpen}
              setMenuOpen={setMenuOpen}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
              onRename={startRename}
              onToggleFavorite={handleToggleFavorite}
              onTogglePin={handleTogglePin}
              onMove={setMovingItem}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
          {filtered.map((project, i) => (
            <FileCard
              key={project.id}
              project={project}
              view="list"
              index={i}
              isFirst={i === 0}
              isLast={i === filtered.length - 1}
              onOpen={() => onNavigate(project.type as ViewId, project.id)}
              menuOpen={menuOpen}
              setMenuOpen={setMenuOpen}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
              onRename={startRename}
              onToggleFavorite={handleToggleFavorite}
              onTogglePin={handleTogglePin}
              onMove={setMovingItem}
            />
          ))}
        </div>
      )}

      {/* Storage */}
      <StorageIndicator />

      {/* Rename modal */}
      {renaming && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setRenaming(null)}>
          <div className="bg-[#12122a] border border-white/10 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-bold text-base mb-4">Rename</h3>
            <input
              autoFocus
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && confirmRename()}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-violet-500/50 focus:outline-none transition-all"
              placeholder="File name"
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setRenaming(null)} className="flex-1 text-gray-400 hover:text-white text-sm py-2 rounded-lg hover:bg-white/5 transition-colors">Cancel</button>
              <button onClick={confirmRename} className="flex-1 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium py-2 rounded-lg transition-colors">Rename</button>
            </div>
          </div>
        </div>
      )}

      {/* Move modal */}
      {movingItem && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setMovingItem(null)}>
          <div className="bg-[#12122a] border border-white/10 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-bold text-base mb-4">Move "{movingItem.title}" to...</h3>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              <button
                onClick={() => handleMove(movingItem.id, null)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-300 hover:bg-white/5 rounded-lg transition-colors text-left"
              >
                <FolderOpen className="w-4 h-4 text-gray-500" /> Root (no project)
              </button>
              {parentProjects.filter(p => p.id !== movingItem.id).map(p => (
                <button
                  key={p.id}
                  onClick={() => handleMove(movingItem.id, p.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-300 hover:bg-white/5 rounded-lg transition-colors text-left"
                >
                  <Folder className="w-4 h-4 text-amber-400" /> {p.title}
                </button>
              ))}
            </div>
            <button onClick={() => setMovingItem(null)} className="w-full mt-4 text-gray-400 hover:text-white text-sm py-2 rounded-lg hover:bg-white/5 transition-colors">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// File Card component
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

function FileCard({ project, view, index, isFirst, isLast, onOpen, menuOpen, setMenuOpen, onDelete, onDuplicate, onRename, onToggleFavorite, onTogglePin, onMove }: FileCardProps) {
  const meta = getFileMeta(project.type);
  const isFavorite = (project as Project & { favorite?: boolean }).favorite;
  const isPinned = (project as Project & { pinned?: boolean }).pinned;

  if (view === 'list') {
    return (
      <div className={`relative flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors group ${!isLast ? 'border-b border-white/5' : ''}`}>
        <button onClick={onOpen} className="flex items-center gap-3 flex-1 min-w-0 text-left">
          <div className={`w-9 h-9 rounded-lg ${meta.bg} flex items-center justify-center flex-shrink-0`}>
            <FileText className={`w-4 h-4 ${meta.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm font-medium truncate flex items-center gap-1.5">
              {project.title}
              {isPinned && <Pin className="w-3 h-3 text-violet-400 fill-violet-400" />}
            </div>
            <div className="text-gray-500 text-xs">{meta.label} · {timeAgo(project.updated_at)}</div>
          </div>
        </button>
        <div className="flex items-center gap-1 flex-shrink-0">
          {isFavorite && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
          <span className={`text-xs px-2 py-0.5 rounded-full ${project.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
            {project.status === 'completed' ? 'Completed' : 'Draft'}
          </span>
          <FileMenu isOpen={menuOpen === project.id} onToggle={() => setMenuOpen(menuOpen === project.id ? null : project.id)} onDelete={() => onDelete(project.id)} onDuplicate={() => onDuplicate(project)} onRename={() => onRename(project)} onToggleFavorite={() => onToggleFavorite(project)} onTogglePin={() => onTogglePin(project)} onMove={() => onMove(project)} />
        </div>
      </div>
    );
  }

  return (
    <div
      className="group relative bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-5 hover:border-violet-500/30 transition-all duration-300"
      style={{ animation: 'fadeInUp 0.3s ease-out both', animationDelay: `${index * 0.04}s` }}
    >
      <div className="flex items-start justify-between mb-3">
        <button onClick={onOpen} className={`w-11 h-11 rounded-xl ${meta.bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
          <FileText className={`w-5 h-5 ${meta.color}`} />
        </button>
        <div className="flex items-center gap-1">
          {isFavorite && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
          {isPinned && <Pin className="w-3.5 h-3.5 text-violet-400 fill-violet-400" />}
          <FileMenu isOpen={menuOpen === project.id} onToggle={() => setMenuOpen(menuOpen === project.id ? null : project.id)} onDelete={() => onDelete(project.id)} onDuplicate={() => onDuplicate(project)} onRename={() => onRename(project)} onToggleFavorite={() => onToggleFavorite(project)} onTogglePin={() => onTogglePin(project)} onMove={() => onMove(project)} />
        </div>
      </div>
      <button onClick={onOpen} className="block w-full text-left">
        <h3 className="text-white text-sm font-semibold truncate mb-1">{project.title}</h3>
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
          <span className={meta.color}>{meta.label}</span>
          <span>·</span>
          <span>{timeAgo(project.updated_at)}</span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${project.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
          {project.status === 'completed' ? 'Completed' : 'Draft'}
        </span>
      </button>
    </div>
  );
}

function FileMenu({
  isOpen, onToggle, onDelete, onDuplicate, onRename, onToggleFavorite, onTogglePin, onMove,
}: {
  isOpen: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onRename: () => void;
  onToggleFavorite: () => void;
  onTogglePin: () => void;
  onMove: () => void;
}) {
  return (
    <div className="relative flex-shrink-0">
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors opacity-0 group-hover:opacity-100"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-[#12122a] border border-white/10 rounded-xl p-1.5 w-44 shadow-2xl shadow-black/50 z-50" onClick={e => e.stopPropagation()}>
          <button onClick={onRename} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-300 hover:bg-white/5 rounded-lg transition-colors">
            <Edit2 className="w-3.5 h-3.5" /> Rename
          </button>
          <button onClick={onDuplicate} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-300 hover:bg-white/5 rounded-lg transition-colors">
            <Copy className="w-3.5 h-3.5" /> Duplicate
          </button>
          <button onClick={onMove} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-300 hover:bg-white/5 rounded-lg transition-colors">
            <Folder className="w-3.5 h-3.5" /> Move
          </button>
          <div className="h-px bg-white/5 my-1" />
          <button onClick={onToggleFavorite} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-300 hover:bg-white/5 rounded-lg transition-colors">
            <Star className="w-3.5 h-3.5" /> Favorite
          </button>
          <button onClick={onTogglePin} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-300 hover:bg-white/5 rounded-lg transition-colors">
            <Pin className="w-3.5 h-3.5" /> Pin
          </button>
          <div className="h-px bg-white/5 my-1" />
          <button onClick={onDelete} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
