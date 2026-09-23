import { useState } from 'react';
import { Check, Sparkles, X } from 'lucide-react';
import { useLocalizer } from '@/lib/ui-localization-cms';
import { applyWebsiteCmsAIPlan, type WebsiteCmsAIPlan } from '../core/editor-ai-cms';
import type { WebsiteCmsState } from '../core/website-cms';
import { planWebsiteCmsWithAI } from '../services/websiteCmsAIService';

interface BuilderCmsAiPanelProps {
  cms: WebsiteCmsState;
  disabled?: boolean;
  onChange(cms: WebsiteCmsState, label: string): void;
}

const control = 'w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-xs text-white outline-none focus:border-violet-400';
const button = 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-[11px] font-semibold text-gray-200 hover:border-violet-400/60 hover:text-white disabled:opacity-40';

function operationLabel(operation: WebsiteCmsAIPlan['operations'][number]): string {
  const target = operation.name || operation.collectionId || operation.entryId || operation.field?.name || '';
  return `${operation.action.replace(/_/g, ' ')}${target ? ` · ${target}` : ''}`;
}

export function BuilderCmsAiPanel({ cms, disabled, onChange }: BuilderCmsAiPanelProps) {
  const l = useLocalizer();
  const [prompt, setPrompt] = useState('');
  const [plan, setPlan] = useState<WebsiteCmsAIPlan>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');

  const createPlan = async () => {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    setError('');
    setResult('');
    try {
      setPlan(await planWebsiteCmsWithAI(cms, prompt));
    } catch (reason) {
      setPlan(undefined);
      setError(reason instanceof Error ? l(reason.message) : l('CMS AI planning failed.'));
    } finally {
      setBusy(false);
    }
  };

  const applyPlan = () => {
    if (!plan) return;
    try {
      const applied = applyWebsiteCmsAIPlan(cms, plan);
      if (!applied.applied) throw new Error(applied.warnings[0] || l('No safe CMS operations were returned.'));
      onChange(applied.cms, 'Apply reviewed CMS AI plan');
      setResult(`${l('Applied CMS operations')}: ${applied.applied}${applied.warnings.length ? ` · ${applied.warnings.length} ${l('warnings')}` : ''}`);
      setPlan(undefined);
      setPrompt('');
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? l(reason.message) : l('CMS AI plan could not be applied.'));
    }
  };

  const cancelPlan = () => {
    setPlan(undefined);
    setError('');
    setResult('');
  };

  return <div className="space-y-2 rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/5 p-3" data-testid="builder-cms-ai-panel">
    <div className="flex items-center justify-between gap-2">
      <strong className="inline-flex items-center gap-1.5 text-[11px] text-white"><Sparkles size={13} />{l('AI CMS assistant')}</strong>
      <span className="text-[9px] text-fuchsia-300">{l('Review first')}</span>
    </div>
    <p className="text-[9px] leading-4 text-gray-400">{l('AI plans CMS changes for review. New entries stay drafts and CMS content is never deleted automatically.')}</p>
    <textarea
      className={`${control} min-h-20 resize-y`}
      value={prompt}
      onChange={(event) => setPrompt(event.target.value.slice(0, 4_000))}
      placeholder={l('Describe CMS changes, entries, views, or translations…')}
      disabled={disabled || busy}
      maxLength={4_000}
    />
    <button type="button" className={`${button} w-full`} onClick={() => void createPlan()} disabled={disabled || busy || !prompt.trim()}>
      <Sparkles size={13} />{busy ? l('Planning…') : l('Plan with AI')}
    </button>

    {error && <div className="rounded-lg border border-red-400/20 bg-red-500/5 px-2 py-2 text-[10px] text-red-200" role="alert">{error}</div>}
    {result && <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/5 px-2 py-2 text-[10px] text-emerald-200" role="status">{result}</div>}

    {plan && <div className="space-y-2 rounded-lg border border-fuchsia-400/20 bg-black/10 p-2" data-testid="cms-ai-plan-review">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold text-white">{l('Review AI CMS plan')}</span>
        <span className="text-[9px] text-fuchsia-300">{plan.operations.length} {l('Operations')}</span>
      </div>
      <p className="text-[9px] leading-4 text-gray-300">{plan.summary}</p>
      {plan.warnings.map((warning) => <div key={warning} className="text-[9px] leading-4 text-amber-200">• {warning}</div>)}
      <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
        {plan.operations.map((operation, index) => <div key={`${operation.action}-${index}`} className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5 text-[9px] text-gray-300">
          <span className="font-semibold text-white">{index + 1}.</span> {operationLabel(operation)}
          {operation.language && <span className="ml-1 text-fuchsia-300">{operation.language.toUpperCase()}</span>}
        </div>)}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className={button} onClick={cancelPlan} disabled={disabled}><X size={13} />{l('Cancel plan')}</button>
        <button type="button" className={`${button} border-emerald-400/30 text-emerald-200`} onClick={applyPlan} disabled={disabled || !plan.operations.length}><Check size={13} />{l('Apply reviewed plan')}</button>
      </div>
    </div>}
  </div>;
}
