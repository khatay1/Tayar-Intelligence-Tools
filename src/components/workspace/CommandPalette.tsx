import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, FileText, Folder, ArrowRight, Loader2, Command, Settings, Bell,
  CreditCard, LayoutDashboard, FolderOpen, Trash2, FileBarChart, AlertCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { getFileMeta, timeAgo, ViewId, NAV_ITEMS } from './workspace-config';
import { AI_COMMANDS, matchCommand } from '@/lib/ai-commands';
import { toolRegistry } from '@/modules/registry';
import { useLocalizer } from '@/lib/ui-localization-workspace';

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
  dashboard: LayoutDashboard,
  'my-workspace': LayoutDashboard,
  'my-files': FolderOpen,
  'my-projects': Folder,
  trash: Trash2,
  'ai-usage': FileBarChart,
  settings: Settings,
  subscription: CreditCard,
  support: Bell,
};

export default function CommandPalette({ open, onClose, onNavigate, darkMode: _darkMode }: CommandPaletteProps) {
  const l = useLocalizer();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PaletteResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [projectSearchError, setProjectSearchError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const requestSequenceRef = useRef(0);

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 100);
      return () => {
        window.clearTimeout(focusTimer);
        document.body.style.overflow = previousOverflow;
        previousFocusRef.current?.focus();
        previousFocusRef.current = null;
      };
    }
    requestSequenceRef.current += 1;
    setLoading(false);
    setProjectSearchError(false);
    setQuery('');
    setResults([]);
    setSelectedIndex(0);
    return undefined;
  }, [open]);

  const buildResults = useCallback(async (q: string) => {
    const requestSequence = ++requestSequenceRef.current;
    const trimmed = q.toLocaleLowerCase().trim();
    const navResults: PaletteResult[] = [];
    const aiResults: PaletteResult[] = [];
    setProjectSearchError(false);

    const matchesLocalizedText = (...values: string[]) => values.some((value) =>
      value.toLocaleLowerCase().includes(trimmed) || l(value).toLocaleLowerCase().includes(trimmed),
    );

    if (!trimmed) {
      for (const item of NAV_ITEMS) {
        const Icon = NAV_ICONS[item.id] || item.icon;
        navResults.push({ id: `nav-${item.id}`, label: l(item.label), icon: Icon, view: item.id, group: 'navigation' });
      }
      const staticNavIds = new Set<string>(NAV_ITEMS.map(item => item.id));
      for (const tool of toolRegistry.available()) {
        if (staticNavIds.has(tool.id)) continue;
        navResults.push({
          id: `tool-${tool.id}`,
          label: l(tool.name),
          subtitle: l(tool.description),
          icon: tool.icon,
          view: tool.id as ViewId,
          group: 'navigation',
        });
      }
      for (const cmd of AI_COMMANDS) aiResults.push({ id: `ai-${cmd.id}`, label: l(cmd.label), subtitle: l(cmd.description), icon: cmd.icon, view: cmd.view, group: 'ai' });
      if (user) {
        setLoading(true);
        const { data, error } = await supabase.from('projects').select('id, title, type, updated_at').eq('user_id', user.id).is('deleted_at', null).order('updated_at', { ascending: false }).limit(5);
        if (requestSequenceRef.current !== requestSequence) return;
        setLoading(false);
        setProjectSearchError(Boolean(error));
        const recentResults: PaletteResult[] = (data || []).map((p: { id: string; title: string; type: string; updated_at: string }) => {
          const meta = getFileMeta(p.type);
          return { id: `recent-${p.id}`, label: p.title, subtitle: `${l(meta.label)} · ${timeAgo(p.updated_at)}`, icon: FileText, view: p.type as ViewId, projectId: p.id, group: 'recent' };
        });
        setResults([...navResults, ...aiResults, ...recentResults]);
        return;
      }
      setResults([...navResults, ...aiResults]);
      return;
    }

    for (const item of NAV_ITEMS) {
      if (matchesLocalizedText(item.label)) {
        const Icon = NAV_ICONS[item.id] || item.icon;
        navResults.push({ id: `nav-${item.id}`, label: l(item.label), icon: Icon, view: item.id, group: 'navigation' });
      }
    }

    const matchedCommands = new Map(
      [...matchCommand(trimmed), ...AI_COMMANDS.filter((cmd) => matchesLocalizedText(cmd.label, cmd.description))]
        .map((cmd) => [cmd.id, cmd]),
    );
    for (const cmd of [...matchedCommands.values()].slice(0, 5)) {
      aiResults.push({ id: `ai-${cmd.id}`, label: l(cmd.label), subtitle: l(cmd.description), icon: cmd.icon, view: cmd.view, group: 'ai' });
    }
    const englishToolMatches = new Set(toolRegistry.search(trimmed).map((tool) => tool.id));
    const tools = toolRegistry.available().filter((tool) =>
      englishToolMatches.has(tool.id) ||
      matchesLocalizedText(tool.name, tool.description, tool.category),
    );
    for (const tool of tools) {
      if (!aiResults.find(r => r.view === tool.id)) aiResults.push({ id: `tool-${tool.id}`, label: l(tool.name), subtitle: l(tool.description), icon: tool.icon, view: tool.id as ViewId, group: 'ai' });
    }

    let searchResults: PaletteResult[] = [];
    if (user && trimmed.length >= 1) {
      setLoading(true);
      const { data, error } = await supabase.from('projects').select('id, title, type, updated_at').eq('user_id', user.id).is('deleted_at', null).ilike('title', `%${q.trim()}%`).order('updated_at', { ascending: false }).limit(8);
      if (requestSequenceRef.current !== requestSequence) return;
      setLoading(false);
      setProjectSearchError(Boolean(error));
      searchResults = (data || []).map((p: { id: string; title: string; type: string; updated_at: string }) => {
        const meta = getFileMeta(p.type);
        return { id: `search-${p.id}`, label: p.title, subtitle: `${l(meta.label)} · ${timeAgo(p.updated_at)}`, icon: FileText, view: p.type as ViewId, projectId: p.id, group: 'search' };
      });
    }
    setResults([...aiResults, ...navResults, ...searchResults]);
    setSelectedIndex(0);
  }, [l, user]);

  useEffect(() => {
    if (!open) return undefined;
    const timer = setTimeout(() => void buildResults(query), 200);
    return () => clearTimeout(timer);
  }, [open, query, buildResults]);

  useEffect(() => {
    setSelectedIndex((index) => Math.max(0, Math.min(index, results.length - 1)));
  }, [results.length]);

  useEffect(() => {
    if (!open || !results[selectedIndex]) return;
    document.getElementById(`command-option-${results[selectedIndex].id}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, results, selectedIndex]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('input, button, [href], [tabindex]:not([tabindex="-1"])') || [])
          .filter((element) => !element.hasAttribute('disabled'));
        if (focusable.length > 0) {
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
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

  const groupLabels: Record<string, string> = { ai: 'AI Actions', navigation: 'Navigation', recent: 'Recent Projects', search: 'Search Results' };
  const grouped = ['ai', 'navigation', 'recent', 'search'].map(group => ({ group, label: groupLabels[group], items: results.filter(r => r.group === group) })).filter(group => group.items.length > 0);
  let runningIndex = -1;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-start sm:px-4 sm:pt-[12vh]" onClick={onClose}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={l('Command palette')} className="flex max-h-[calc(100dvh-1rem)] w-full max-w-xl min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a1a]/95 shadow-2xl shadow-black/50 backdrop-blur-2xl sm:max-h-[76dvh]" onClick={e => e.stopPropagation()} style={{ animation: 'fadeInUp 0.2s ease-out' }}>
        <div className="flex min-w-0 items-center gap-2.5 border-b border-white/5 px-3 py-3.5 sm:gap-3 sm:px-4">
          <Command className="h-5 w-5 shrink-0 text-violet-400" />
          <input ref={inputRef} role="combobox" aria-expanded="true" aria-controls="command-palette-results" aria-activedescendant={results[selectedIndex] ? `command-option-${results[selectedIndex].id}` : undefined} value={query} onChange={e => setQuery(e.target.value)} placeholder={l('Type a command or search...')} className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-gray-600 focus:outline-none" />
          {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-violet-500" />}
          <kbd className="hidden rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-gray-600 sm:block">ESC</kbd>
        </div>

        <div id="command-palette-results" role="listbox" className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-2">
          {projectSearchError && (
            <div className="mx-1 mb-2 flex items-start gap-2 rounded-lg border border-amber-400/15 bg-amber-400/[0.06] px-3 py-2 text-xs leading-5 text-amber-200" role="status">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{l('Projects could not be loaded. Tool results are still available.')}</span>
            </div>
          )}
          {grouped.length === 0 && !loading ? (
            <div className="py-10 text-center">
              <Search className="mx-auto mb-2 h-8 w-8 text-gray-700" />
              <p className="break-words px-3 text-sm text-gray-500">{l('No results for')} "{query}"</p>
            </div>
          ) : grouped.map(group => (
            <div key={group.group} className="mb-2 min-w-0">
              <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-600">{l(group.label)}</div>
              {group.items.map(item => {
                runningIndex++;
                const idx = runningIndex;
                const Icon = item.icon;
                const active = idx === selectedIndex;
                return (
                  <button id={`command-option-${item.id}`} role="option" aria-selected={active} key={item.id} onClick={() => { onNavigate(item.view, item.projectId); onClose(); }} onMouseEnter={() => setSelectedIndex(idx)} className={`flex min-h-12 w-full min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${active ? 'bg-violet-600/15' : 'hover:bg-white/5'}`}>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5"><Icon className="h-4 w-4 text-violet-400" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-white">{l(item.label)}</div>
                      {item.subtitle && <div className="line-clamp-2 text-xs leading-5 text-gray-500">{l(item.subtitle)}</div>}
                    </div>
                    {active && <ArrowRight className="h-4 w-4 shrink-0 text-violet-400" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/5 px-3 py-2.5 text-xs text-gray-600 sm:px-4">
          <span className="hidden items-center gap-2 sm:flex"><kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5">↑↓</kbd> {l('navigate')}<kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5">↵</kbd> {l('open')}</span>
          <span className="truncate">{results.length} {l('results')}</span>
          <button type="button" onClick={onClose} className="min-h-9 rounded-lg px-3 text-gray-400 hover:bg-white/5 hover:text-white sm:hidden">{l('Close')}</button>
        </div>
      </div>
    </div>
  );
}
