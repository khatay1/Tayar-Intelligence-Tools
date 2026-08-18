// Global Search — searches across projects, files, AI chats, documents, CVs.
// Opens as a modal overlay with keyboard navigation.

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, FileText, Mail, MessageSquare, Languages, GraduationCap, Folder, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { getFileMeta, timeAgo, ViewId } from './workspace-config';

interface SearchResult {
  id: string;
  title: string;
  type: string;
  subtitle: string;
  updated_at: string;
  view: ViewId;
}

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (view: ViewId, projectId?: string) => void;
}

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

export default function GlobalSearch({ open, onClose, onNavigate }: GlobalSearchProps) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  const search = useCallback(async (q: string) => {
    if (!user || q.trim().length < 1) { setResults([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from('projects')
      .select('id, title, type, status, updated_at')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .ilike('title', `%${q}%`)
      .order('updated_at', { ascending: false })
      .limit(20);

    const mapped: SearchResult[] = (data || []).map((row: { id: string; title: string; type: string; status: string; updated_at: string }) => {
      const meta = getFileMeta(row.type);
      return {
        id: row.id,
        title: row.title,
        type: row.type,
        subtitle: `${meta.label} · ${row.status === 'draft' ? 'Draft' : 'Completed'}`,
        updated_at: row.updated_at,
        view: row.type as ViewId,
      };
    });
    setResults(mapped);
    setSelectedIndex(0);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 250);
    return () => clearTimeout(timer);
  }, [query, search]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, results.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
      if (e.key === 'Enter' && results[selectedIndex]) {
        const r = results[selectedIndex];
        onNavigate(r.view, r.id);
        onClose();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, results, selectedIndex, onClose, onNavigate]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh] px-4" onClick={onClose}>
      <div
        className="w-full max-w-xl bg-[#0a0a1a]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'fadeInUp 0.2s ease-out' }}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/5">
          <Search className="w-5 h-5 text-gray-500 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search projects, files, chats, documents..."
            className="flex-1 bg-transparent text-white text-sm placeholder:text-gray-600 focus:outline-none"
          />
          {loading && <Loader2 className="w-4 h-4 text-violet-500 animate-spin" />}
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {query.trim().length === 0 ? (
            <div className="py-10 text-center">
              <Search className="w-8 h-8 text-gray-700 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">Start typing to search across all your content</p>
            </div>
          ) : results.length === 0 && !loading ? (
            <div className="py-10 text-center">
              <p className="text-gray-500 text-sm">No results for "{query}"</p>
              <p className="text-gray-600 text-xs mt-1">Try a different search term.</p>
            </div>
          ) : (
            results.map((result, i) => {
              const Icon = TYPE_ICONS[result.type] || FileText;
              const meta = getFileMeta(result.type);
              const active = i === selectedIndex;
              return (
                <button
                  key={result.id}
                  onClick={() => { onNavigate(result.view, result.id); onClose(); }}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left ${active ? 'bg-violet-600/15' : 'hover:bg-white/5'}`}
                >
                  <div className={`w-9 h-9 rounded-lg ${meta.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-4 h-4 ${meta.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium truncate">{result.title}</div>
                    <div className="text-gray-500 text-xs">{result.subtitle} · {timeAgo(result.updated_at)}</div>
                  </div>
                  <ArrowRight className={`w-4 h-4 flex-shrink-0 transition-opacity ${active ? 'text-violet-400 opacity-100' : 'text-gray-700 opacity-0'}`} />
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-white/5 flex items-center justify-between text-xs text-gray-600">
          <span>Use ↑↓ to navigate · Enter to open</span>
          <span>{results.length} results</span>
        </div>
      </div>
    </div>
  );
}
