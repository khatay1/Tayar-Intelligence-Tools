import { useLocalizer } from '@/lib/ui-localization';
// Trash View — shows soft-deleted projects with 30-day retention and restore.

import { useState, useEffect } from 'react';
import { Trash2, RotateCcw, Loader2, X, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { getFileMeta, timeAgo } from './workspace-config';
import { EmptyState } from '@/components/ui/EmptyState';

interface TrashItem {
  id: string;
  title: string;
  type: string;
  deleted_at: string;
  created_at: string;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export default function TrashView() {
  const l = useLocalizer();
  const { user } = useAuth();
  const { loading, update } = useToast();
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loadingState, setLoadingState] = useState(true);
  const [confirmPurge, setConfirmPurge] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('projects')
      .select('id, title, type, deleted_at, created_at')
      .eq('user_id', user.id)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
      .then(({ data }) => {
        setItems((data as TrashItem[]) || []);
        setLoadingState(false);
      });
  }, [user]);

  async function handleRestore(id: string) {
    const toastId = loading('Restoring...');
    const { error: err } = await supabase
      .from('projects')
      .update({ deleted_at: null })
      .eq('id', id);
    if (err) {
      update(toastId, 'Failed to restore', 'error');
    } else {
      update(toastId, 'Restored successfully', 'success');
      setItems(prev => prev.filter(i => i.id !== id));
    }
  }

  async function handlePurge(id: string) {
    const toastId = loading('Permanently deleting...');
    const { error: err } = await supabase.from('projects').delete().eq('id', id);
    if (err) {
      update(toastId, 'Failed to delete permanently', 'error');
    } else {
      update(toastId, 'Permanently deleted', 'success');
      setItems(prev => prev.filter(i => i.id !== id));
    }
  }

  async function handleEmptyTrash() {
    if (!user) return;
    setConfirmPurge(false);
    const toastId = loading('Emptying trash...');
    const { error: err } = await supabase.from('projects').delete().not('deleted_at', 'is', null).eq('user_id', user.id);
    if (err) {
      update(toastId, 'Failed to empty trash', 'error');
    } else {
      update(toastId, 'Trash emptied', 'success');
      setItems([]);
    }
  }

  function daysRemaining(deletedAt: string): number {
    const elapsed = Date.now() - new Date(deletedAt).getTime();
    return Math.max(0, Math.ceil((THIRTY_DAYS_MS - elapsed) / (24 * 60 * 60 * 1000)));
  }

  if (loadingState) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-violet-500 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">{l('Trash')}</h1>
          <p className="text-gray-500 text-sm">{l('Deleted items are kept for 30 days before being permanently removed.')}</p>
        </div>
        {items.length > 0 && (
          <button
            onClick={() => setConfirmPurge(true)}
            className="flex items-center gap-2 text-red-400 hover:text-red-300 text-sm font-medium px-4 py-2 rounded-xl hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" /> {l('Empty Trash')}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Trash2}
          title="Trash is empty"
          description="When you delete files or projects, they'll appear here for 30 days before being permanently removed."
          variant="trash"
        />
      ) : (
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
          {items.map((item, i) => {
            const meta = getFileMeta(item.type);
            const days = daysRemaining(item.deleted_at);
            return (
              <div
                key={item.id}
                className={`flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors ${i !== items.length - 1 ? 'border-b border-white/5' : ''}`}
              >
                <div className={`w-9 h-9 rounded-lg ${meta.bg} flex items-center justify-center flex-shrink-0 opacity-60`}>
                  <div className={`w-4 h-4 rounded ${meta.color.replace('text-', 'bg-')}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium truncate">{item.title}</div>
                  <div className="text-gray-500 text-xs">{meta.label} · Deleted {timeAgo(item.deleted_at)}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs px-2 py-1 rounded-full ${days < 7 ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>
                    {days} days left
                  </span>
                  <button
                    onClick={() => handleRestore(item.id)}
                    className="flex items-center gap-1.5 text-violet-400 hover:text-violet-300 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-violet-500/10 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />{l('Restore')}</button>
                  <button
                    onClick={() => handlePurge(item.id)}
                    className="text-red-400/60 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm empty trash */}
      {confirmPurge && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setConfirmPurge(false)}>
          <div className="bg-[#12122a] border border-white/10 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-bold text-base">{l('Empty Trash?')}</h3>
                <p className="text-gray-500 text-xs">{l('This cannot be undone.')}</p>
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-4">All {items.length} items will be permanently deleted.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmPurge(false)} className="flex-1 text-gray-400 hover:text-white text-sm py-2.5 rounded-lg hover:bg-white/5 transition-colors">{l('Cancel')}</button>
              <button onClick={handleEmptyTrash} className="flex-1 bg-red-600 hover:bg-red-500 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">{l('Delete All')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
