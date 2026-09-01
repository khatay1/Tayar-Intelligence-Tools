import { useEffect, useMemo, useState } from 'react';
import {
  Boxes, Check, Code2, Copy, ExternalLink, LayoutTemplate, Loader2, Package,
  Search, ShieldCheck, Sparkles, WandSparkles,
} from 'lucide-react';
import { componentRegistry } from './component-registry';
import { getRegistrySource, REGISTRY_SOURCES } from './source-catalog';
import { loadUpstreamComponentCode, loadUpstreamComponents } from './upstream-registry';
import { UIComponentCategory, UIComponentRecord } from './types';

const CATEGORIES: Array<{ id: UIComponentCategory | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'hero', label: 'Heroes' },
  { id: 'navigation', label: 'Navigation' },
  { id: 'dashboard', label: 'Dashboards' },
  { id: 'forms', label: 'Forms' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'authentication', label: 'Auth' },
  { id: 'ai', label: 'AI' },
  { id: 'cards', label: 'Cards' },
  { id: 'cta', label: 'CTA' },
  { id: 'data', label: 'Data' },
];

function Preview({ item }: { item: UIComponentRecord }) {
  const common = 'rounded-2xl border border-white/10 bg-[#090917] text-white overflow-hidden';
  if (item.preview === 'hero') return <div className={common}><div className="p-7 text-center bg-[radial-gradient(circle_at_top,rgba(139,92,246,.28),transparent_60%)]"><div className="mx-auto h-5 w-24 rounded-full bg-violet-500/20" /><div className="mx-auto mt-4 h-5 w-3/4 rounded bg-white/80" /><div className="mx-auto mt-2 h-3 w-1/2 rounded bg-white/20" /><div className="mx-auto mt-5 flex w-fit gap-2"><span className="h-8 w-20 rounded-lg bg-white" /><span className="h-8 w-20 rounded-lg border border-white/20" /></div></div></div>;
  if (item.preview === 'nav') return <div className={common}><div className="flex items-center justify-between p-4"><div className="h-5 w-16 rounded bg-white/80" /><div className="flex gap-2"><span className="h-3 w-10 rounded bg-white/20" /><span className="h-3 w-10 rounded bg-white/20" /><span className="h-7 w-16 rounded-lg bg-violet-500" /></div></div></div>;
  if (item.preview === 'pricing') return <div className={common}><div className="grid grid-cols-3 gap-2 p-4">{[0, 1, 2].map((i) => <div key={i} className={`h-24 rounded-xl border ${i === 1 ? 'border-violet-400 bg-violet-500/15' : 'border-white/10 bg-white/5'}`} />)}</div></div>;
  if (item.preview === 'auth') return <div className={common}><div className="mx-auto max-w-[190px] space-y-2 p-5"><div className="h-4 w-24 rounded bg-white/80" /><div className="h-8 rounded-lg bg-white/5 border border-white/10" /><div className="h-8 rounded-lg bg-white/5 border border-white/10" /><div className="h-8 rounded-lg bg-violet-500" /></div></div>;
  if (item.preview === 'stats') return <div className={common}><div className="grid grid-cols-3 gap-2 p-4">{[42, 68, 87].map((n) => <div key={n} className="rounded-xl bg-white/5 p-3"><div className="h-2 w-10 rounded bg-white/20" /><div className="mt-3 text-lg font-bold">{n}</div></div>)}</div></div>;
  if (item.preview === 'dashboard') return <div className={common}><div className="grid grid-cols-4 gap-2 p-4"><div className="col-span-1 h-28 rounded-xl bg-white/5" /><div className="col-span-3 space-y-2"><div className="grid grid-cols-3 gap-2">{[1, 2, 3].map((i) => <div key={i} className="h-9 rounded-lg bg-white/5" />)}</div><div className="h-[68px] rounded-xl bg-violet-500/10" /></div></div></div>;
  if (item.preview === 'chat') return <div className={common}><div className="space-y-2 p-4"><div className="h-8 w-2/3 rounded-xl bg-white/5" /><div className="ml-auto h-8 w-1/2 rounded-xl bg-violet-500" /><div className="mt-4 h-9 rounded-xl border border-white/10 bg-white/5" /></div></div>;
  return <div className={common}><div className="grid grid-cols-2 gap-3 p-5"><div className="h-20 rounded-xl border border-white/10 bg-white/5" /><div className="h-20 rounded-xl border border-violet-400/20 bg-violet-500/10" /><div className="col-span-2 h-8 rounded-lg bg-white/5" /></div></div>;
}

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

function filterRecords(records: UIComponentRecord[], query: string, category: UIComponentCategory | 'all') {
  const q = query.trim().toLowerCase();
  return records.filter((record) => {
    if (category !== 'all' && record.category !== category) return false;
    if (!q) return true;
    return [record.name, record.description, record.category, ...record.tags]
      .some((value) => value.toLowerCase().includes(q));
  });
}

export default function CodeAssistantTool({ darkMode }: { darkMode: boolean; projectId?: string | null }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<UIComponentCategory | 'all'>('all');
  const [selectedId, setSelectedId] = useState(componentRegistry.all()[0]?.id || '');
  const [tab, setTab] = useState<'preview' | 'code' | 'info'>('preview');
  const [copied, setCopied] = useState<'code' | 'prompt' | null>(null);
  const [showSources, setShowSources] = useState(false);
  const [upstreamItems, setUpstreamItems] = useState<UIComponentRecord[]>([]);
  const [upstreamLoading, setUpstreamLoading] = useState(true);
  const [upstreamErrors, setUpstreamErrors] = useState<string[]>([]);
  const [loadedCode, setLoadedCode] = useState<Record<string, string>>({});
  const [codeLoadingId, setCodeLoadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setUpstreamLoading(true);
    loadUpstreamComponents()
      .then((result) => {
        if (!active) return;
        setUpstreamItems(result.items);
        setUpstreamErrors(result.errors);
      })
      .catch((error) => {
        if (!active) return;
        setUpstreamErrors([error instanceof Error ? error.message : 'Unable to load upstream registries.']);
      })
      .finally(() => {
        if (active) setUpstreamLoading(false);
      });
    return () => { active = false; };
  }, []);

  const allItems = useMemo(() => [...componentRegistry.all(), ...upstreamItems], [upstreamItems]);
  const matches = useMemo(() => filterRecords(allItems, query, category), [allItems, query, category]);
  const selected = matches.find((item) => item.id === selectedId) || matches[0];
  const source = selected ? getRegistrySource(selected.sourceId) : undefined;
  const selectedCode = selected ? (loadedCode[selected.id] ?? selected.code) : '';

  const ensureCode = async (item: UIComponentRecord): Promise<string> => {
    const existing = loadedCode[item.id] ?? item.code;
    if (existing) return existing;
    if (!item.remote) return '';

    setCodeLoadingId(item.id);
    setActionError(null);
    try {
      const code = await loadUpstreamComponentCode(item);
      setLoadedCode((current) => ({ ...current, [item.id]: code }));
      return code;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load component code.';
      setActionError(message);
      throw error;
    } finally {
      setCodeLoadingId((current) => current === item.id ? null : current);
    }
  };

  const onCopyCode = async (item: UIComponentRecord) => {
    try {
      const code = await ensureCode(item);
      if (!code) return;
      await copyText(code);
      setCopied('code');
      window.setTimeout(() => setCopied(null), 1400);
    } catch {
      // Error is rendered in the panel.
    }
  };

  const onUseAI = async (item: UIComponentRecord) => {
    try {
      const code = await ensureCode(item);
      const payload = code
        ? `${item.aiPrompt}\n\nComponent source:\n\n${code}`
        : item.aiPrompt;
      await copyText(payload);
      setCopied('prompt');
      window.setTimeout(() => setCopied(null), 1400);
    } catch {
      // Error is rendered in the panel.
    }
  };

  const shell = darkMode ? 'bg-[#080814] text-white' : 'bg-white text-gray-900';
  const panel = darkMode ? 'border-white/10 bg-white/[0.035]' : 'border-gray-200 bg-gray-50';

  return (
    <div className={`min-h-[calc(100vh-8rem)] rounded-3xl border p-4 sm:p-6 ${shell} ${darkMode ? 'border-violet-400/10' : 'border-gray-200'}`}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-violet-400 text-xs font-semibold uppercase tracking-[0.18em]"><Code2 className="h-4 w-4" /> Tayar Coding Assistance</div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold">UI Registry</h1>
          <p className={`mt-2 max-w-2xl text-sm leading-6 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Browse reusable UI, inspect code and dependencies, then hand source-aware adaptation instructions to AI. Only approved redistributable sources are loaded.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-violet-500/10 px-2.5 py-1 text-violet-300">{allItems.length} components</span>
            {upstreamLoading && <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 opacity-60"><Loader2 className="h-3 w-3 animate-spin" /> Loading open-source registries</span>}
            {!upstreamLoading && upstreamItems.length > 0 && <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-400">{upstreamItems.length} upstream items loaded</span>}
          </div>
        </div>
        <button onClick={() => setShowSources((value) => !value)} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${panel}`}><ShieldCheck className="h-4 w-4 text-emerald-400" /> Source policy</button>
      </div>

      {upstreamErrors.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">
          Some registries could not be loaded: {upstreamErrors.join(' · ')}
        </div>
      )}

      {showSources && (
        <div className={`mt-5 rounded-2xl border p-4 ${panel}`}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {REGISTRY_SOURCES.filter((entry) => entry.id !== 'tayar-native').map((entry) => (
              <div key={entry.id} className="rounded-xl border border-white/10 p-3">
                <div className="flex items-start justify-between gap-2"><strong className="text-sm">{entry.name}</strong><span className={`rounded-full px-2 py-0.5 text-[10px] ${entry.redistributionAllowed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{entry.redistributionAllowed ? entry.license : 'Blocked'}</span></div>
                <p className={`mt-2 text-xs leading-5 ${darkMode ? 'text-gray-500' : 'text-gray-600'}`}>{entry.note}</p>
                <a href={`https://github.com/${entry.repository}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300">Repository <ExternalLink className="h-3 w-3" /></a>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className={`rounded-2xl border p-3 ${panel}`}>
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search components..." className={`w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm outline-none focus:border-violet-400/50 ${darkMode ? 'border-white/10 bg-black/20 placeholder:text-gray-600' : 'border-gray-200 bg-white'}`} />
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {CATEGORIES.map((entry) => <button key={entry.id} onClick={() => setCategory(entry.id)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs ${category === entry.id ? 'bg-violet-500 text-white' : darkMode ? 'bg-white/5 text-gray-400 hover:text-white' : 'bg-gray-100 text-gray-600'}`}>{entry.label}</button>)}
          </div>
          <div className="mt-3 max-h-[620px] space-y-2 overflow-y-auto pr-1">
            {matches.map((item) => (
              <button key={item.id} onClick={() => { setSelectedId(item.id); setTab('preview'); setActionError(null); }} className={`w-full rounded-xl border p-3 text-left transition ${selected?.id === item.id ? 'border-violet-400/40 bg-violet-500/10' : darkMode ? 'border-white/5 bg-black/10 hover:border-white/15' : 'border-gray-200 bg-white hover:border-violet-200'}`}>
                <div className="flex items-start gap-3"><div className="rounded-lg bg-violet-500/10 p-2 text-violet-400"><LayoutTemplate className="h-4 w-4" /></div><div className="min-w-0"><div className="flex items-center gap-2"><div className="truncate text-sm font-semibold">{item.name}</div>{item.remote && <span className="rounded-full bg-cyan-500/10 px-1.5 py-0.5 text-[9px] text-cyan-400">OSS</span>}</div><div className={`mt-1 line-clamp-2 text-xs leading-5 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{item.description}</div><div className="mt-2 flex flex-wrap gap-1">{item.tags.slice(0, 3).map((tag) => <span key={tag} className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] opacity-60">{tag}</span>)}</div></div></div>
              </button>
            ))}
            {matches.length === 0 && !upstreamLoading && <div className="py-10 text-center text-sm opacity-50">No matching components.</div>}
          </div>
        </section>

        {selected && (
          <section className={`min-w-0 rounded-2xl border ${panel}`}>
            <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div><div className="flex items-center gap-2"><h2 className="font-semibold">{selected.name}</h2>{selected.remote && <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-400">Open source</span>}</div><p className={`mt-1 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{selected.description}</p></div>
              <div className="flex flex-wrap gap-2">
                <button disabled={codeLoadingId === selected.id} onClick={() => void onUseAI(selected)} className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-400 disabled:opacity-50">{codeLoadingId === selected.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />} {copied === 'prompt' ? 'AI payload copied' : 'Use with AI'}</button>
                <button disabled={codeLoadingId === selected.id} onClick={() => void onCopyCode(selected)} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold disabled:opacity-50 ${darkMode ? 'border-white/10 hover:bg-white/5' : 'border-gray-200 hover:bg-gray-100'}`}>{codeLoadingId === selected.id ? <Loader2 className="h-4 w-4 animate-spin" /> : copied === 'code' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />} Copy code</button>
              </div>
            </div>

            <div className="flex gap-1 border-b border-white/10 px-4 pt-3">
              {(['preview', 'code', 'info'] as const).map((entry) => <button key={entry} onClick={() => setTab(entry)} className={`rounded-t-lg px-3 py-2 text-xs font-semibold capitalize ${tab === entry ? 'bg-violet-500/15 text-violet-300' : 'opacity-50 hover:opacity-100'}`}>{entry}</button>)}
            </div>

            {actionError && <div className="mx-4 mt-4 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-300">{actionError}</div>}

            <div className="p-4 sm:p-5">
              {tab === 'preview' && <div><Preview item={selected} /><p className="mt-2 text-[11px] opacity-45">Safe schematic preview. Third-party component code is never executed inside the registry browser.</p><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-white/10 p-3"><Boxes className="h-4 w-4 text-violet-400" /><div className="mt-2 text-xs font-semibold">Category</div><div className="mt-1 text-xs opacity-50 capitalize">{selected.category}</div></div><div className="rounded-xl border border-white/10 p-3"><Package className="h-4 w-4 text-cyan-400" /><div className="mt-2 text-xs font-semibold">Dependencies</div><div className="mt-1 text-xs opacity-50">{selected.dependencies.length ? selected.dependencies.join(', ') : 'None'}</div></div><div className="rounded-xl border border-white/10 p-3"><Sparkles className="h-4 w-4 text-amber-400" /><div className="mt-2 text-xs font-semibold">AI ready</div><div className="mt-1 text-xs opacity-50">Source-aware adaptation payload</div></div></div></div>}
              {tab === 'code' && (selectedCode
                ? <pre className="max-h-[520px] overflow-auto rounded-xl bg-black/40 p-4 text-xs leading-6 text-gray-300"><code>{selectedCode}</code></pre>
                : <div className="rounded-xl border border-white/10 p-6 text-center"><Code2 className="mx-auto h-8 w-8 text-violet-400" /><div className="mt-3 text-sm font-semibold">Source code loads on demand</div><p className="mx-auto mt-2 max-w-md text-xs leading-5 opacity-50">The component files and upstream MIT license are fetched only when needed. The license notice is prepended to copied source.</p><button disabled={codeLoadingId === selected.id} onClick={() => void ensureCode(selected)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{codeLoadingId === selected.id && <Loader2 className="h-4 w-4 animate-spin" />} Load source code</button></div>
              )}
              {tab === 'info' && <div className="space-y-4"><div className="rounded-xl border border-white/10 p-4"><div className="text-xs uppercase tracking-wider opacity-50">Source</div><div className="mt-2 font-semibold">{source?.name || selected.sourceId}</div><div className="mt-1 text-xs opacity-60">{source?.repository}{selected.sourcePath ? ` · ${selected.sourcePath}` : ''}</div></div><div className="rounded-xl border border-white/10 p-4"><div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-emerald-400" /> License gate</div><p className="mt-2 text-xs leading-5 opacity-60">{source?.redistributionAllowed ? `Approved: ${source.license}. Upstream license notice is preserved when code is loaded or copied.` : 'This source is blocked from redistribution.'}</p></div>{selected.remote?.registryDependencies.length ? <div className="rounded-xl border border-white/10 p-4"><div className="text-sm font-semibold">Registry dependencies</div><p className="mt-2 text-xs leading-5 opacity-60">{selected.remote.registryDependencies.join(', ')}</p></div> : null}<div className="rounded-xl border border-white/10 p-4"><div className="text-sm font-semibold">AI adaptation instruction</div><p className="mt-2 text-xs leading-5 opacity-60">{selected.aiPrompt}</p></div></div>}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
