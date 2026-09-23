import { Check, Cpu, Sparkles } from 'lucide-react';
import { FREE_LLM_PROVIDER_CATALOG, type FreeProviderPreset } from '@/lib/ai/free-provider-catalog';
import { useLocalizer } from '@/lib/ui-localization';

interface Props {
  configuredProviderKeys: string[];
  onSelect: (provider: FreeProviderPreset, modelId: string) => void;
}

export default function FreeLLMProviderCatalog({ configuredProviderKeys, onSelect }: Props) {
  const l = useLocalizer();
  const configured = new Set(configuredProviderKeys);

  return <section className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.04] p-4 sm:p-5">
    <div className="mb-4 flex items-start gap-3">
      <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-2 text-cyan-300"><Sparkles className="h-5 w-5" /></div>
      <div className="min-w-0">
        <h2 className="font-semibold text-white">{l('Free LLM Provider Catalog')}</h2>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-gray-400">{l('Start from a curated provider preset, then add your own API key. Free-tier availability and limits are controlled by each provider, so test the connection before making it default.')}</p>
      </div>
    </div>

    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {FREE_LLM_PROVIDER_CATALOG.map((provider) => <div key={provider.key} className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0"><div className="truncate text-sm font-medium text-white">{provider.label}</div><div className="mt-0.5 text-[10px] uppercase tracking-wide text-cyan-300">{provider.adapter.replace('_', ' ')}</div></div>
          {configured.has(provider.key) && <span title={l('Configured')} className="rounded-full border border-emerald-500/20 bg-emerald-500/10 p-1 text-emerald-300"><Check className="h-3.5 w-3.5" /></span>}
        </div>
        <p className="mt-2 min-h-10 text-[11px] leading-4 text-gray-500">{l(provider.freeTierNote)}</p>
        <div className="mt-3 space-y-2">
          {provider.models.map((model) => <button key={model.id} type="button" onClick={() => onSelect(provider, model.id)} className="flex w-full min-w-0 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-left hover:border-cyan-500/30 hover:bg-cyan-500/[0.06]">
            <Cpu className="h-3.5 w-3.5 shrink-0 text-gray-500" />
            <span className="min-w-0 flex-1"><span className="block truncate text-xs text-gray-200">{model.label}</span><span className="block truncate text-[10px] text-gray-500">{model.context ? `${model.context} · ` : ''}{model.rateLimit || l('See provider')}</span></span>
          </button>)}
        </div>
      </div>)}
    </div>
  </section>;
}
