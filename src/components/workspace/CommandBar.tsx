import { useLocalizer } from '@/lib/ui-localization';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, ArrowRight, Search } from 'lucide-react';
import { matchCommand, AICommand } from '@/lib/ai-commands';
import { ViewId } from './workspace-config';

interface CommandBarProps {
  darkMode: boolean;
  onNavigate: (view: ViewId, projectId?: string) => void;
}

export default function CommandBar({ darkMode, onNavigate }: CommandBarProps) {
  const l = useLocalizer();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const matches = matchCommand(query);

  useEffect(() => { setSelectedIndex(0); }, [query]);
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setFocused(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const executeCommand = useCallback((cmd: AICommand) => {
    onNavigate(cmd.view);
    setQuery('');
    setFocused(false);
    inputRef.current?.blur();
  }, [onNavigate]);

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, matches.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && matches[selectedIndex]) { e.preventDefault(); executeCommand(matches[selectedIndex]); }
    if (e.key === 'Escape') { setFocused(false); inputRef.current?.blur(); }
  }

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1 max-w-2xl">
      <div className={`flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2.5 transition-all sm:gap-2.5 sm:px-3.5 ${focused ? 'border-violet-500/40 ring-2 ring-violet-500/20' : darkMode ? 'border-white/10' : 'border-gray-200'} ${darkMode ? 'bg-white/5' : 'bg-gray-100'}`}>
        <Sparkles className={`h-4 w-4 shrink-0 ${focused ? 'text-violet-400' : darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={handleKey}
          placeholder={l("Ask AI to do anything... e.g. 'Create a CV', 'Analyze this PDF', 'Translate text'")}
          className={`min-w-0 flex-1 bg-transparent text-sm placeholder:text-gray-500 focus:outline-none ${darkMode ? 'text-white' : 'text-gray-900'}`}
        />
        {focused && query && <span className={`hidden shrink-0 text-xs md:block ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{l('Enter to open')}</span>}
      </div>

      {focused && query && matches.length > 0 && (
        <div className={`absolute top-full left-0 right-0 z-50 mt-2 max-h-[min(24rem,55dvh)] overflow-hidden rounded-xl border shadow-2xl shadow-black/50 ${darkMode ? 'bg-[#12122a] border-white/10' : 'bg-white border-gray-200'}`} style={{ animation: 'fadeInUp 0.15s ease-out' }}>
          <div className="flex items-center gap-1.5 px-3 py-2">
            <Search className={`h-3 w-3 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`} />
            <span className={`text-xs font-medium ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{l('AI Commands')}</span>
          </div>
          <div className="max-h-[min(20rem,48dvh)] overflow-y-auto overflow-x-hidden overscroll-contain p-1.5">
            {matches.map((cmd, i) => {
              const Icon = cmd.icon;
              const active = i === selectedIndex;
              return (
                <button
                  key={cmd.id}
                  onClick={() => executeCommand(cmd)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={`flex min-h-12 w-full min-w-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${active ? 'bg-violet-600/15' : darkMode ? 'hover:bg-white/5' : 'hover:bg-gray-100'}`}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10"><Icon className="h-4 w-4 text-violet-400" /></div>
                  <div className="min-w-0 flex-1">
                    <div className={`truncate text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{cmd.label}</div>
                    <div className="line-clamp-2 text-xs leading-5 text-gray-500">{cmd.description}</div>
                  </div>
                  <ArrowRight className={`h-4 w-4 shrink-0 transition-opacity ${active ? 'text-violet-400 opacity-100' : 'opacity-0 sm:opacity-0'}`} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {focused && query && matches.length === 0 && (
        <div className={`absolute top-full left-0 right-0 z-50 mt-2 rounded-xl border p-4 shadow-2xl shadow-black/50 ${darkMode ? 'bg-[#12122a] border-white/10' : 'bg-white border-gray-200'}`} style={{ animation: 'fadeInUp 0.15s ease-out' }}>
          <p className="break-words text-center text-sm text-gray-500">{l('No matching AI command. Try Create a CV or Translate text.')}</p>
        </div>
      )}
    </div>
  );
}
