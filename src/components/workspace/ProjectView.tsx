import { useLocalizer } from '@/lib/ui-localization';
// Project View — shows a project's contents and allows adding items to it.

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, FileText, Mail, MessageSquare, Languages, GraduationCap, Folder, Loader2, Trash2, Star, Pin } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { getFileMeta, timeAgo, ViewId } from './workspace-config';
import { EmptyState } from '@/components/ui/EmptyState';

interface ProjectItem {
  id: string;
  item_type: string;
  item_id: string | null;
  title: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface ProjectViewProps {
  projectId: string;
  onBack: () => void;
  onNavigate: (view: ViewId) => void;
}

const ITEM_ICONS: Record<string, typeof FileText> = {
  'cv': FileText,
  'cover-letter': Mail,
  'document': FileText,
  'ai-chat': MessageSquare,
  'translation': Languages,
  'study-note': GraduationCap,
};

const ADD_OPTIONS = [
  { type: 'cv', label: 'Resume', icon: FileText, view: 'cv-builder' as ViewId },
  { type: 'cover-letter', label: 'Cover Letter', icon: Mail, view: 'cover-letter' as ViewId },
  { type: 'document', label: 'Document', icon: FileText, view: 'document-ai' as ViewId },
  { type: 'ai-chat', label: 'AI Chat', icon: MessageSquare, view: 'ai-chat' as ViewId },
  { type: 'translation', label: 'Translation', icon: Languages, view: 'translator' as ViewId },
  { type: 'study-note', label: 'Study Notes', icon: GraduationCap, view: 'study-assistant' as ViewId },
];

export default function ProjectView({ projectId, onBack, onNavigate }: ProjectViewProps) {
  const l = useLocalizer();
  const { user } = useAuth();
  const { success, error: showError, loading, update } = useToast();
  const [project, setProject] = useState<{ id: string; title: string; type: string; favorite: boolean; pinned: boolean } | null>(null);
  const [items, setItems] = useState<ProjectItem[]>([]);
  const [loadingState, setLoadingState] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: proj }, { data: itemData }] = await Promise.all([
      supabase.from('projects').select('id, title, type, favorite, pinned').eq('id', projectId).single(),
      supabase.from('project_items').select('*').eq('project_id', projectId).order('sort_order', { ascending: true }),
    ]);
    setProject(proj as typeof project);
    setItems((itemData as ProjectItem[]) || []);
    setLoadingState(false);
  }, [user, projectId]);

  useEffect(() => { load(); }, [load]);

  async function addItem(type: string, label: string, view: ViewId) {
    if (!user) return;
    const toastId = loading('Adding to project...');
    const { error: err } = await supabase.from('project_items').insert({
      project_id: projectId,
      user_id: user.id,
      item_type: type,
      title: `New ${label}`,
      sort_order: items.length,
    });
    if (err) {
      update(toastId, 'Failed to add item', 'error');
    } else {
      update(toastId, 'Added to project', 'success');
      setShowAdd(false);
      load();
      onNavigate(view);
    }
  }

  async function deleteItem(id: string) {
    const { error: err } = await supabase.from('project_items').delete().eq('id', id);
    if (err) { showError('Failed to remove item'); return; }
    setItems(prev => prev.filter(i => i.id !== id));
    success('Item removed');
  }

  async function toggleFavorite() {
    if (!project) return;
    const newVal = !project.favorite;
    setProject({ ...project, favorite: newVal });
    await supabase.from('projects').update({ favorite: newVal }).eq('id', projectId);
  }

  async function togglePin() {
    if (!project) return;
    const newVal = !project.pinned;
    setProject({ ...project, pinned: newVal });
    await supabase.from('projects').update({ pinned: newVal }).eq('id', projectId);
  }

  async function confirmRename() {
    if (!renameValue.trim() || !project) return;
    const { error: err } = await supabase.from('projects').update({ title: renameValue.trim() }).eq('id', projectId);
    if (err) { showError('Failed to rename'); return; }
    setProject({ ...project, title: renameValue.trim() });
    setRenaming(false);
    success('Project renamed');
  }

  if (loadingState) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-violet-500 animate-spin" /></div>;
  }

  if (!project) {
    return <EmptyState icon={Folder} title={l("Project not found")} description="This project may have been deleted." onAction={onBack} actionLabel="Go Back" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          {renaming ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && confirmRename()}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-white text-lg font-bold focus:border-violet-500/50 focus:outline-none"
              />
              <button onClick={confirmRename} className="text-violet-400 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-violet-500/10">{l('Save')}</button>
              <button onClick={() => setRenaming(false)} className="text-gray-500 text-sm px-3 py-1.5 rounded-lg hover:bg-white/5">{l('Cancel')}</button>
            </div>
          ) : (
            <h1 className="text-2xl font-bold text-white cursor-pointer hover:text-violet-300 transition-colors" onClick={() => { setRenaming(true); setRenameValue(project.title); }}>
              {project.title}
            </h1>
          )}
          <p className="text-gray-500 text-sm mt-0.5">{items.length} items · {getFileMeta(project.type).label}</p>
        </div>
        <button onClick={togglePin} className={`p-2 rounded-lg transition-colors ${project.pinned ? 'text-amber-400' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>
          <Pin className="w-5 h-5" />
        </button>
        <button onClick={toggleFavorite} className={`p-2 rounded-lg transition-colors ${project.favorite ? 'text-amber-400' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>
          <Star className={`w-5 h-5 ${project.favorite ? 'fill-amber-400' : ''}`} />
        </button>
      </div>

      {/* Add button */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" /> {l('Add Item')}
        </button>
      </div>

      {/* Add options */}
      {showAdd && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {ADD_OPTIONS.map(opt => {
            const Icon = opt.icon;
            const meta = getFileMeta(opt.type);
            return (
              <button
                key={opt.type}
                onClick={() => addItem(opt.type, opt.label, opt.view)}
                className="group flex flex-col items-center gap-2 bg-white/[0.03] border border-white/10 rounded-2xl p-4 hover:border-violet-500/30 hover:bg-white/[0.05] transition-all"
              >
                <div className={`w-10 h-10 rounded-xl ${meta.bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <Icon className={`w-5 h-5 ${meta.color}`} />
                </div>
                <span className="text-white text-xs font-medium">{l(opt.label)}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Items */}
      {items.length === 0 ? (
        <EmptyState
          icon={Folder}
          title={l('No items in this project')}
          description={l('Add resumes, cover letters, notes, AI chats and more to organize your work.')}
          actionLabel={l('Add First Item')}
          onAction={() => setShowAdd(true)}
          variant="projects"
        />
      ) : (
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
          {items.map((item, i) => {
            const Icon = ITEM_ICONS[item.item_type] || FileText;
            const meta = getFileMeta(item.item_type);
            return (
              <div
                key={item.id}
                className={`group flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors ${i !== items.length - 1 ? 'border-b border-white/5' : ''}`}
              >
                <div className={`w-9 h-9 rounded-lg ${meta.bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-4 h-4 ${meta.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium truncate">{item.title}</div>
                  <div className="text-gray-500 text-xs">{meta.label} · {timeAgo(item.updated_at)}</div>
                </div>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="text-red-400/40 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
