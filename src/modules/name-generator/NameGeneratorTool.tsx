import { useMemo, useState } from 'react';
import { Check, Copy, RefreshCw, Sparkles, Wand2 } from 'lucide-react';
import { useLocalizer } from '@/lib/ui-localization';
import { ToolField, ToolInputPanel, ToolOutputPanel, ToolShell, toolInputClass } from '../shared/ToolShell';
import { generateNames } from './name-generator';
import { NameTone, NameUseCase } from './name-types';

const USE_CASES: Array<{ value: NameUseCase; label: string }> = [
  { value: 'business', label: 'Business' },
  { value: 'product', label: 'Product' },
  { value: 'brand', label: 'Brand' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'instagram', label: 'Instagram' },
];

const TONES: Array<{ value: NameTone; label: string }> = [
  { value: 'modern', label: 'Modern' },
  { value: 'professional', label: 'Professional' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'bold', label: 'Bold' },
  { value: 'minimal', label: 'Minimal' },
];

export default function NameGeneratorTool({ darkMode: _darkMode }: { darkMode: boolean }) {
  const l = useLocalizer();
  const [keyword, setKeyword] = useState('');
  const [useCase, setUseCase] = useState<NameUseCase>('business');
  const [tone, setTone] = useState<NameTone>('modern');
  const [count, setCount] = useState(18);
  const [nonce, setNonce] = useState(0);
  const [generated, setGenerated] = useState(false);
  const [copied, setCopied] = useState('');

  const results = useMemo(
    () => generated ? generateNames({ keyword, useCase, tone, count, nonce }) : [],
    [generated, keyword, useCase, tone, count, nonce],
  );

  function generate() {
    setGenerated(true);
    setNonce((value) => value + 1);
  }

  async function copyName(name: string) {
    try {
      await navigator.clipboard.writeText(name);
      setCopied(name);
      window.setTimeout(() => setCopied(''), 1500);
    } catch {
      setCopied('');
    }
  }

  return (
    <ToolShell
      icon={Wand2}
      title={l('Name Generator')}
      description={l('Generate original business, product, brand and social-name ideas locally.')}
      badge="No API"
    >
      <div className="grid xl:grid-cols-[340px_minmax(0,1fr)] gap-6 items-start">
        <ToolInputPanel>
          <ToolField label={l('Keyword or idea')}>
            <input
              value={keyword}
              maxLength={40}
              onChange={(event) => { setKeyword(event.target.value); setGenerated(false); }}
              className={toolInputClass}
              placeholder={l('Example: coffee, fitness, design')}
            />
          </ToolField>

          <ToolField label={l('Name type')}>
            <select
              value={useCase}
              onChange={(event) => { setUseCase(event.target.value as NameUseCase); setGenerated(false); }}
              className={toolInputClass}
            >
              {USE_CASES.map((item) => <option key={item.value} value={item.value}>{l(item.label)}</option>)}
            </select>
          </ToolField>

          <ToolField label={l('Tone')}>
            <select
              value={tone}
              onChange={(event) => { setTone(event.target.value as NameTone); setGenerated(false); }}
              className={toolInputClass}
            >
              {TONES.map((item) => <option key={item.value} value={item.value}>{l(item.label)}</option>)}
            </select>
          </ToolField>

          <ToolField label={`${l('Ideas')} · ${count}`}>
            <input
              type="range"
              min="6"
              max="30"
              step="1"
              value={count}
              onChange={(event) => { setCount(Number(event.target.value)); setGenerated(false); }}
              className="w-full accent-violet-500"
            />
          </ToolField>

          <button
            type="button"
            onClick={generate}
            className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            {l(generated ? 'Generate New Ideas' : 'Generate Names')}
          </button>

          <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3 text-xs text-gray-500">
            {l('Availability is not checked. Verify trademarks, domains and social handles before using a name commercially.')}
          </div>
        </ToolInputPanel>

        <ToolOutputPanel
          hasContent={results.length > 0}
          empty={<div className="py-16 text-center text-sm text-gray-600">{l('Enter an idea and generate names.')}</div>}
        >
          {results.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-white font-semibold">{l('Name ideas')}</div>
                  <div className="text-xs text-gray-500">{results.length} {l('original combinations')}</div>
                </div>
                <button
                  type="button"
                  onClick={generate}
                  className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {l('Regenerate')}
                </button>
              </div>

              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {results.map((item) => (
                  <article key={item.name} className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-white font-semibold truncate">{item.name}</div>
                        <div className="text-xs text-violet-300/70 mt-1">@{item.slug}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void copyName(item.name)}
                        className="p-2 rounded-lg hover:bg-white/10 text-gray-500 hover:text-white transition-colors"
                        aria-label={l('Copy name')}
                      >
                        {copied === item.name ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="text-[11px] text-gray-600 mt-3">{l(item.reason)}</div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </ToolOutputPanel>
      </div>
    </ToolShell>
  );
}
