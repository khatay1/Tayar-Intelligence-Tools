import { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, ArrowRight, Search, Loader2 } from 'lucide-react';
import { AI_COMMANDS, matchCommand, AICommand } from '@/lib/ai-commands';
import { ViewId } from './workspace-config';

interface CommandBarProps {
  darkMode: boolean;
  onNavigate: (view: ViewId, projectId?: string) => void;
}

export default function CommandBar({ darkMode, onNavigate }: CommandBarProps) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const matches = matchCommand(query);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
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
    <div ref={containerRef} className="relative flex-1 max-w-2xl">
      <div className={`flex items-center gap-2.5 rounded-xl border transition-all ${focused ? 'border-violet-500/40 ring-2 ring-violet-500/20' : darkMode ? 'border-white/10' : 'border-gray-200'} ${darkMode ? 'bg-white/5' : 'bg-gray-100'} px-3.5 py-2.5`}>
        <Sparkles className={`w-4 h-4 flex-shrink-0 ${focused ? 'text-violet-400' : darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={handleKey}
          placeholder="Ask AI to do anything... e.g. 'Create a CV', 'Analyze this PDF', 'Translate text'"
          className={`flex-1 bg-transparent text-sm placeholder:text-gray-500 focus:outline-none ${darkMode ? 'text-white' : 'text-gray-900'}`}
        />
        {focused && query && (
          <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'} hidden sm:block`}>Enter to open</span>
        )}
      </div>

      {focused && query && matches.length > 0 && (
        <div
          className={`absolute top-full left-0 right-0 mt-2 ${darkMode ? 'bg-[#12122a]' : 'bg-white'} border ${darkMode ? 'border-white/10' : 'border-gray-200'} rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden`}
          style={{ animation: 'fadeInUp 0.15s ease-out' }}
        >
          <div className="px-3 py-2 flex items-center gap-1.5">
            <Search className={`w-3 h-3 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`} />
            <span className={`text-xs font-medium ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>AI Commands</span>
          </div>
          <div className="max-h-72 overflow-y-auto p-1.5">
            {matches.map((cmd, i) => {
              const Icon = cmd.icon;
              const active = i === selectedIndex;
              return (
                <button
                  key={cmd.id}
                  onClick={() => executeCommand(cmd)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${active ? 'bg-violet-600/15' : darkMode ? 'hover:bg-white/5' : 'hover:bg-gray-100'}`}
                >
                  <div className={`w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-4 h-4 text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{cmd.label}</div>
                    <div className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{cmd.description}</div>
                  </div>
                  <ArrowRight className={`w-4 h-4 flex-shrink-0 transition-opacity ${active ? 'text-violet-400 opacity-100' : 'opacity-0'}`} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {focused && query && matches.length === 0 && (
        <div
          className={`absolute top-full left-0 right-0 mt-2 ${darkMode ? 'bg-[#12122a]' : 'bg-white'} border ${darkMode ? 'border-white/10' : 'border-gray-200'} rounded-xl shadow-2xl shadow-black/50 z-50 p-4`}
          style={{ animation: 'fadeInUp 0.15s ease-out' }}
        >
          <p className={`text-sm text-center ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
            No matching AI command. Try "Create a CV" or "Translate text".
          </p>
        </div>
      )}
    </div>
  );
}
