import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, FileText, Folder, ArrowRight, Loader2, Command, Settings, Bell,
  CreditCard, LayoutDashboard, FolderOpen, Trash2, FileBarChart,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLocalizer } from '@/lib/ui-localization';
import { getFileMeta, timeAgo, ViewId, NAV_ITEMS } from './workspace-config';
import { AI_COMMANDS, matchCommand } from '@/lib/ai-commands';
import { toolRegistry } from '@/modules/registry';

interface PaletteResult {
  id: string;
  label: string;
  subtitle?: string;
  icon: typeof Search;
  view: ViewId;
  projectId?: string;
  group: 'navigation' | 'ai' | 'recent' | 'search';
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (view: ViewId, projectId?: string) => void;
  darkMode: boolean;
}

const NAV_ICONS: Record<string, typeof Search> = {
  'dashboard': LayoutDashboard,
  'my-workspace': LayoutDashboard,
  'my-files': FolderOpen,
  'my-projects': Folder,
  'trash': Trash2,
  'ai-usage': FileBarChart,
  'settings': Settings,
  'subscription': CreditCard,
  'support': Bell,
};

export default function CommandPalette({ open, onClose, onNavigate, darkMode: _darkMode }: CommandPaletteProps) {
  const l = useLocalizer();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PaletteResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
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

  const buildResults = useCallback(async (q: string) => {
    const trimmed = q.toLowerCase().trim();

    const navResults: PaletteResult[] = [];
    const aiResults: PaletteResult[] = [];

    if (!trimmed) {
      for (const item of NAV_ITEMS) {
        const Icon = NAV_ICONS[item.id] || item.icon;
        navResults.push({
          id: `nav-${item.id}`, label: item.label, icon: Icon,
          view: item.id, group: 'navigation',
        });
      }
      for (const cmd of AI_COMMANDS) {
        aiResults.push({
          id: `ai-${cmd.id}`, label: cmd.label, subtitle: cmd.description,
          icon: cmd.icon, view: cmd.view, group: 'ai',
        });
      }
      // Recent projects
      if (user) {
        setLoading(true);
        const { data } = await supabase
          .from('projects')
          .select('id, title, type, updated_at')
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .order('updated_at', { ascending: false })
          .limit(5);
        setLoading(false);
        const recentResults: PaletteResult[] = (data || []).map((p: { id: string; title: string; type: string; updated_at: string }) => {
          const meta = getFileMeta(p.type);
          return {
            id: `recent-${p.id}`, label: p.title, subtitle: `${l(meta.label)} · ${timeAgo(p.updated_at)}`,
            icon: FileText, view: p.type as ViewId, projectId: p.id, group: 'recent',
          };
        });
        setResults([...navResults, ...aiResults, ...recentResults]);
        return;
      }
      setResults([...navResults, ...aiResults]);
      return;
    }

    // Filter nav items
    for (const item of NAV_ITEMS) {
      if (item.label.toLowerCase().includes(trimmed) || l(item.label).toLowerCase().includes(trimmed)) {
        const Icon = NAV_ICONS[item.id] || item.icon;
        navResults.push({
          id: `nav-${item.id}`, label: item.label, icon: Icon,
          view: item.id, group: 'navigation',
        });
      }
    }

    // Filter AI commands
    const matchedCmds = matchCommand(trimmed);
    for (const cmd of matchedCmds) {
      aiResults.push({
        id: `ai-${cmd.id}`, label: cmd.label, subtitle: cmd.description,
        icon: cmd.icon, view: cmd.view, group: 'ai',
      });
    }

    // Filter tools from registry
    const tools = toolRegistry.search(trimmed).filter(t => t.status !== 'soon');
    for (const tool of tools) {
      if (!aiResults.find(r => r.view === tool.id)) {
        aiResults.push({
          id: `tool-${tool.id}`, label: tool.name, subtitle: tool.description,
          icon: tool.icon, view: tool.id as ViewId, group: 'ai',
        });
      }
    }

    // Search projects from DB
    let searchResults: PaletteResult[] = [];
    if (user && trimmed.length >= 1) {
      setLoading(true);
      const { data } = await supabase
        .from('projects')
        .select('id, title, type, updated_at')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .ilike('title', `%${trimmed}%`)
        .order('updated_at', { ascending: false })
        .limit(8);
      setLoading(false);
      searchResults = (data || []).map((p: { id: string; title: string; type: string; updated_at: string }) => {
        const meta = getFileMeta(p.type);
        return {
          id: `search-${p.id}`, label: p.title, subtitle: `${l(meta.label)} · ${timeAgo(p.updated_at)}`,
          icon: FileText, view: p.type as ViewId, projectId: p.id, group: 'search',
        };
      });
    }

    setResults([...aiResults, ...navResults, ...searchResults]);
    setSelectedIndex(0);
  }, [user, l]);

  useEffect(() => {
    const timer = setTimeout(() => buildResults(query), 200);
    return () => clearTimeout(timer);
  }, [query, buildResults]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, results.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
      if (e.key === 'Enter' && results[selectedIndex]) {
        const r = results[selectedIndex];
        onNavigate(r.view, r.projectId);
        onClose();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, results, selectedIndex, onClose, onNavigate]);

  if (!open) return null;

  const grouped: { label: string; group: string; items: PaletteResult[] }[] = [];
  const groupLabels: Record<string, string> = {
    'ai': 'AI Actions',
    'navigation': 'Navigation',
    'recent': 'Recent Projects',
    'search': 'Search Results',
  };
  const groupOrder = ['ai', 'navigation', 'recent', 'search'];
  for (const g of groupOrder) {
    const items = results.filter(r => r.group === g);
    if (items.length > 0) grouped.push({ label: groupLabels[g], group: g, items });
  }

  let runningIndex = -1;

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[12vh] px-4" onClick={onClose}>
      <div
        className="w-full max-w-xl bg-[#0a0a1a]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'fadeInUp 0.2s ease-out' }}
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/5">
          <Command className="w-5 h-5 text-violet-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={l('Type a command or search...')}
            className="flex-1 bg-transparent text-white text-sm placeholder:text-gray-600 focus:outline-none"
          />
          {loading && <Loader2 className="w-4 h-4 text-violet-500 animate-spin" />}
          <kbd className="text-[10px] text-gray-600 bg-white/5 border border-white/10 rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-2">
          {grouped.length === 0 && !loading ? (
            <div className="py-10 text-center">
              <Search className="w-8 h-8 text-gray-700 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">{l('No results for "{query}"').replace('{query}', query)}</p>
            </div>
          ) : (
            grouped.map(group => (
              <div key={group.group} className="mb-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-600 px-3 py-1.5">{l(group.label)}</div>
                {group.items.map(item => {
                  runningIndex++;
                  const idx = runningIndex;
                  const Icon = item.icon;
                  const active = idx === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { onNavigate(item.view, item.projectId); onClose(); }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left ${active ? 'bg-violet-600/15' : 'hover:bg-white/5'}`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-violet-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm font-medium truncate">{item.group === 'navigation' || item.group === 'ai' ? l(item.label) : item.label}</div>
                        {item.subtitle && <div className="text-gray-500 text-xs truncate">{item.group === 'ai' ? l(item.subtitle) : item.subtitle}</div>}
                      </div>
                      {active && <ArrowRight className="w-4 h-4 text-violet-400 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-white/5 flex items-center justify-between text-xs text-gray-600">
          <span className="flex items-center gap-2">
            <kbd className="bg-white/5 border border-white/10 rounded px-1.5 py-0.5">↑↓</kbd> {l('navigate')}
            <kbd className="bg-white/5 border border-white/10 rounded px-1.5 py-0.5">↵</kbd> {l('open')}
          </span>
          <span>{l('{count} results').replace('{count}', String(results.length))}</span>
        </div>
      </div>
    </div>
  );
}
