import { useMemo, useState } from 'react';
import { Check, Copy, Search, Sparkles } from 'lucide-react';
import { useLocalizer } from '@/lib/ui-localization';
import { ToolField, ToolShell, toolInputClass } from '../shared/ToolShell';
import { searchPrompts } from './prompt-catalog';
import { personalizePrompt } from './prompt-utils';
import { PromptTemplate } from './prompt-types';

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'business', label: 'Business' },
  { id: 'career', label: 'Career' },
  { id: 'writing', label: 'Writing' },
  { id: 'social', label: 'Social' },
] as const;

export default function PromptLibraryTool({ darkMode: _darkMode }: { darkMode: boolean }) {
  const l = useLocalizer();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [selected, setSelected] = useState<PromptTemplate | null>(null);
  const [topic, setTopic] = useState('');
  const [audience, setAudience] = useState('');
  const [goal, setGoal] = useState('');
  const [copied, setCopied] = useState(false);

  const prompts = useMemo(() => searchPrompts(query, category), [query, category]);
  const personalized = selected ? personalizePrompt(selected, { topic, audience, goal }) : '';

  async function copyPrompt() {
    if (!personalized) return;
    try {
      await navigator.clipboard.writeText(personalized);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <ToolShell
      icon={Sparkles}
      title={l('Prompt Library')}
      description={l('Search original Tayar prompt templates and personalize them for your task.')}
      badge="Original library"
    >
      <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 px-4 py-3 text-sm text-violet-100">
        <div className="font-medium">{l('Original Tayar prompts')}</div>
        <div className="text-violet-200/60 text-xs mt-0.5">
          {l('Prompt structures are written for Tayar and organized by workflow. They are not copied prompt packs.')}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={`${toolInputClass} pl-10`}
            placeholder={l('Search prompts')}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setCategory(item.id)}
              className={`px-3 py-2 rounded-xl text-sm border transition-colors ${
                category === item.id
                  ? 'bg-violet-500/20 border-violet-400/30 text-violet-200'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
              }`}
            >
              {l(item.label)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_420px] gap-6 items-start">
        <div className="grid md:grid-cols-2 gap-3">
          {prompts.map((prompt) => (
            <button
              key={prompt.id}
              type="button"
              onClick={() => { setSelected(prompt); setCopied(false); }}
              className={`text-left rounded-xl border p-4 transition-colors ${
                selected?.id === prompt.id
                  ? 'border-violet-400/40 bg-violet-500/10'
                  : 'border-white/10 bg-white/[0.025] hover:bg-white/[0.05]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="text-white font-semibold">{l(prompt.title)}</div>
                <span className="text-[10px] uppercase tracking-wider text-gray-600">{l(prompt.category)}</span>
              </div>
              <div className="text-gray-500 text-sm mt-1.5 leading-relaxed">{l(prompt.description)}</div>
              <div className="flex gap-1.5 flex-wrap mt-3">
                {prompt.tags.map((tag) => (
                  <span key={tag} className="text-[10px] px-2 py-1 rounded-full bg-white/5 text-gray-600">{l(tag)}</span>
                ))}
              </div>
            </button>
          ))}
        </div>

        <div className="xl:sticky xl:top-20 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          {selected ? (
            <div className="space-y-4">
              <div>
                <div className="text-white font-semibold">{l(selected.title)}</div>
                <div className="text-xs text-gray-500 mt-1">{l('Fill what you know. Empty fields remain as placeholders.')}</div>
              </div>

              <ToolField label={l('Topic')}>
                <textarea value={topic} maxLength={500} onChange={(event) => setTopic(event.target.value)} className={`${toolInputClass} min-h-[72px] resize-y`} />
              </ToolField>
              <ToolField label={l('Audience')}>
                <textarea value={audience} maxLength={500} onChange={(event) => setAudience(event.target.value)} className={`${toolInputClass} min-h-[72px] resize-y`} />
              </ToolField>
              <ToolField label={l('Goal')}>
                <textarea value={goal} maxLength={500} onChange={(event) => setGoal(event.target.value)} className={`${toolInputClass} min-h-[72px] resize-y`} />
              </ToolField>

              <div className="rounded-xl border border-white/10 bg-black/10 p-4 text-sm text-gray-300 whitespace-pre-wrap leading-relaxed max-h-[360px] overflow-y-auto">
                {personalized}
              </div>

              <button
                type="button"
                onClick={() => void copyPrompt()}
                className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {l(copied ? 'Copied' : 'Copy Prompt')}
              </button>
            </div>
          ) : (
            <div className="py-16 text-center text-sm text-gray-600">{l('Select a prompt to personalize it.')}</div>
          )}
        </div>
      </div>
    </ToolShell>
  );
}
