import { useLocalizer } from '@/lib/ui-localization';
import { useState, useEffect, useCallback } from 'react';
import {
  Cpu, Loader2, Zap, AlertCircle, Activity,
  RefreshCw, Server, Clock, Save, Plus, Trash2, Check,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { BarChart, DonutChart } from './Charts';
import {
  SERVER_SUPPORTED_TEXT_MODELS,
  getModel,
  getProviderForModel,
} from '@/lib/ai/types';

interface AIProvider { id: string; service: string; label: string; status: string; last_used: string | null; }
interface ErrorLog { id: string; level: string; category: string; message: string; metadata: Record<string, unknown>; created_at: string; }
interface ManagedModel { id: string; label: string; custom: boolean; }

const GEMINI_MODEL_ID = /^gemini-[a-z0-9][a-z0-9._-]{1,80}$/i;

function builtInModelCatalog(): ManagedModel[] {
  return SERVER_SUPPORTED_TEXT_MODELS.map((id) => ({ id, label: getModel(id)?.label || id, custom: false }));
}

function parseManagedModels(value: unknown): ManagedModel[] {
  const builtIns = builtInModelCatalog();
  const seen = new Set(builtIns.map((model) => model.id));
  if (!Array.isArray(value)) return builtIns;
  const custom: ManagedModel[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const source = entry as Record<string, unknown>;
    const id = typeof source.id === 'string' ? source.id.trim() : '';
    if (!GEMINI_MODEL_ID.test(id) || seen.has(id)) continue;
    const label = typeof source.label === 'string' && source.label.trim() ? source.label.trim().slice(0, 80) : id;
    seen.add(id);
    custom.push({ id, label, custom: true });
  }
  return [...builtIns, ...custom];
}

export default function AdminAI() {
  const l = useLocalizer();
  const { success, error: showError } = useToast();
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProvider, setActiveProvider] = useState('gemini');
  const [defaultModel, setDefaultModel] = useState('gemini-3.6-flash');
  const [savingModel, setSavingModel] = useState(false);
  const [savingCatalog, setSavingCatalog] = useState(false);
  const [modelCatalog, setModelCatalog] = useState<ManagedModel[]>(() => builtInModelCatalog());
  const [newModelId, setNewModelId] = useState('');
  const [newModelLabel, setNewModelLabel] = useState('');
  const [dailyStats, setDailyStats] = useState<{ date: string; requests: number; tokens: number }[]>([]);
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [tokenUsage, setTokenUsage] = useState<{ label: string; value: number }[]>([]);
  const [recentAiErrorCount, setRecentAiErrorCount] = useState(0);
  const [switching, setSwitching] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setLoadError(null);
    const [provRes, usageRes, logsRes, modelRes, catalogRes] = await Promise.all([
      supabase.from('api_keys').select('id, service, label, status, last_used').order('service'),
      supabase.from('ai_usage').select('created_at, tokens_in, tokens_out, provider, model, tool, status').limit(5000),
      supabase.from('system_logs').select('id, level, category, message, metadata, created_at').order('created_at', { ascending: false }).limit(20),
      supabase.from('admin_settings').select('key, value').eq('key', 'default_ai_model').maybeSingle(),
      supabase.from('admin_settings').select('key, value').eq('key', 'ai_model_catalog').maybeSingle(),
    ]);
    const queryError = provRes.error || usageRes.error || logsRes.error || modelRes.error || catalogRes.error;
    if (queryError) { console.error('Failed to load admin AI data:', queryError); setLoadError(queryError.message || 'Failed to load AI administration data.'); setLoading(false); return; }
    setProviders((provRes.data || []) as AIProvider[]); setActiveProvider('gemini');
    const catalog = parseManagedModels(catalogRes.data?.value); setModelCatalog(catalog);
    if (modelRes.data) {
      const val = typeof modelRes.data.value === 'string' ? modelRes.data.value.replace(/"/g, '') : (modelRes.data.value as Record<string, unknown>)?.default as string;
      if (val && catalog.some((model) => model.id === val)) setDefaultModel(val); else setDefaultModel('gemini-3.6-flash');
    } else setDefaultModel('gemini-3.6-flash');
    const usage = (usageRes.data || []) as { created_at: string; tokens_in: number; tokens_out: number; status: string; provider?: string }[];
    const days: Record<string, { requests: number; tokens: number }> = {}; const now = new Date();
    for (let i = 13; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); days[d.toISOString().split('T')[0]] = { requests: 0, tokens: 0 }; }
    let recentErrors = 0;
    for (const u of usage) {
      const key = new Date(u.created_at).toISOString().split('T')[0];
      if (days[key]) {
        days[key].requests++;
        days[key].tokens += u.tokens_in + u.tokens_out;
        if (u.status === 'error') recentErrors++;
      }
    }
    setRecentAiErrorCount(recentErrors);
    setDailyStats(Object.entries(days).map(([date, v]) => ({ date, ...v })));
    const byProvider: Record<string, number> = {};
    for (const u of usage as Array<typeof usage[number] & { provider: string }>) { const p = u.provider; byProvider[p] = (byProvider[p] || 0) + (u.tokens_in + u.tokens_out); }
    setTokenUsage(Object.entries(byProvider).map(([label, value]) => ({ label, value })));
    setErrorLogs((logsRes.data || []) as ErrorLog[]); setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function switchProvider(service: string) {
    if (service !== 'gemini') { showError('This provider is not enabled in the production AI backend yet.'); return; }
    setSwitching(true);
    const { error } = await supabase.from('admin_settings').upsert({ key: 'default_ai_provider', value: 'gemini', updated_at: new Date().toISOString() });
    if (error) showError('Failed to save provider setting'); else { setActiveProvider('gemini'); success('Google Gemini is the active production provider'); }
    setSwitching(false);
  }

  async function saveDefaultModel() {
    if (!modelCatalog.some((model) => model.id === defaultModel)) { showError('Choose a model from the managed model catalog.'); return; }
    setSavingModel(true); const now = new Date().toISOString();
    const { error } = await supabase.from('admin_settings').upsert([
      { key: 'default_ai_model', value: defaultModel, updated_at: now }, { key: 'default_ai_provider', value: 'gemini', updated_at: now },
    ], { onConflict: 'key' });
    if (error) showError('Failed to save model setting'); else { setActiveProvider('gemini'); success(`Default model set to ${defaultModel}`); }
    setSavingModel(false);
  }

  async function persistModelCatalog(nextCatalog: ManagedModel[]) {
    setSavingCatalog(true);
    const customModels = nextCatalog.filter((model) => model.custom).map((model) => ({ id: model.id, label: model.label, enabled: true }));
    const { error } = await supabase.from('admin_settings').upsert({ key: 'ai_model_catalog', value: customModels, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    setSavingCatalog(false); if (error) { showError(error.message || 'Failed to save model catalog'); return false; } return true;
  }

  async function addModel() {
    const id = newModelId.trim(); const label = newModelLabel.trim() || id;
    if (!GEMINI_MODEL_ID.test(id)) { showError('Model ID must start with gemini- and contain only letters, numbers, dots, underscores, or hyphens.'); return; }
    if (modelCatalog.some((model) => model.id.toLowerCase() === id.toLowerCase())) { showError('This model already exists in the catalog.'); return; }
    const nextCatalog = [...modelCatalog, { id, label: label.slice(0, 80), custom: true }]; if (!(await persistModelCatalog(nextCatalog))) return;
    setModelCatalog(nextCatalog); setNewModelId(''); setNewModelLabel(''); success(`Added ${label}`);
  }

  async function removeModel(model: ManagedModel) {
    if (!model.custom) return; if (model.id === defaultModel) { showError('Choose another default model before removing this one.'); return; }
    const nextCatalog = modelCatalog.filter((item) => item.id !== model.id); if (!(await persistModelCatalog(nextCatalog))) return;
    setModelCatalog(nextCatalog); success(`Removed ${model.label}`);
  }

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-violet-500 animate-spin" /></div>;
  if (loadError) return <div className="max-w-xl mx-auto rounded-2xl border border-red-500/20 bg-red-500/5 p-4 sm:p-6 text-center"><AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" /><h2 className="text-white font-semibold mb-2">{l('AI admin data unavailable')}</h2><p className="text-sm text-gray-400 mb-4 break-words">{loadError}</p><button onClick={() => void load()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"><RefreshCw className="w-4 h-4" /> {l('Retry')}</button></div>;

  const totalRequests = dailyStats.reduce((s, d) => s + d.requests, 0); const totalTokens = dailyStats.reduce((s, d) => s + d.tokens, 0); const errorRate = totalRequests > 0 ? (recentAiErrorCount / totalRequests) * 100 : 0;

  return <div className="space-y-5 max-w-7xl mx-auto min-w-0 overflow-x-hidden">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">{[
      { label: '14d Requests', value: totalRequests.toLocaleString(), icon: Zap, color: 'violet' }, { label: '14d Tokens', value: totalTokens.toLocaleString(), icon: Activity, color: 'fuchsia' }, { label: 'Production Backend', value: 'Gemini', icon: Server, color: 'emerald' }, { label: 'Recent Error Rate', value: `${errorRate.toFixed(1)}%`, icon: AlertCircle, color: 'amber' },
    ].map(s => { const colors: Record<string,string> = { violet:'bg-violet-500/10 text-violet-400 border-violet-500/20', fuchsia:'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20', emerald:'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', amber:'bg-amber-500/10 text-amber-400 border-amber-500/20' }; const Icon=s.icon; return <div key={l(s.label)} className={`rounded-2xl border p-3 sm:p-4 min-w-0 ${colors[s.color]}`}><Icon className="w-5 h-5 mb-2"/><div className="text-xl sm:text-2xl font-bold text-white truncate">{s.value}</div><div className="text-[11px] sm:text-xs text-gray-400 leading-tight">{l(s.label)}</div></div>; })}</div>

    <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 sm:p-5 min-w-0">
      <div className="flex items-start justify-between gap-3 mb-4"><div className="min-w-0"><h3 className="text-white font-semibold text-sm">{l('AI Providers & Model Selection')}</h3><p className="text-gray-500 text-xs mt-1 break-words">{l('Set the production default model. Per-tool user settings override this value.')}</p></div><button onClick={() => void load()} className="min-w-11 min-h-11 shrink-0 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/5"><RefreshCw className="w-4 h-4"/></button></div>
      <div className="mb-4 rounded-2xl border border-violet-500/20 bg-[#0b0b18] p-3 sm:p-4 min-w-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><label className="block text-xs font-semibold text-gray-300">{l('Default Model (used when no per-tool model is set)')}</label><p className="mt-1 text-[11px] text-gray-500 break-words">{l('Choose a managed model below, or add a new Gemini model ID manually when Google releases one.')}</p></div><div className="flex flex-col xs:flex-row gap-2 sm:shrink-0"><span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-2 text-[10px] font-medium text-emerald-300 text-center">{l('Gemini backend')}</span><button onClick={() => void saveDefaultModel()} disabled={savingModel} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">{savingModel?<Loader2 className="h-4 w-4 animate-spin"/>:<Save className="h-4 w-4"/>}{l('Save default')}</button></div></div>
        <div className="mt-4 grid grid-cols-1 gap-2 lg:grid-cols-2">{modelCatalog.map(model=>{const selected=model.id===defaultModel; return <div key={model.id} className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border p-3 min-w-0 ${selected?'border-violet-400/50 bg-violet-500/10':'border-white/10 bg-[#111122]'}`}><button type="button" onClick={()=>setDefaultModel(model.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${selected?'border-violet-400/40 bg-violet-500/20 text-violet-300':'border-white/10 bg-black/20 text-gray-500'}`}>{selected?<Check className="h-4 w-4"/>:<Cpu className="h-4 w-4"/>}</span><span className="min-w-0"><span className="block truncate text-sm font-medium text-white">{model.label}</span><span className="block truncate font-mono text-[10px] text-gray-500">{model.id}</span></span></button><div className="flex items-center gap-2 sm:shrink-0"><span className={`rounded-md px-2 py-1 text-[9px] uppercase ${model.custom?'bg-cyan-500/10 text-cyan-300':'bg-white/5 text-gray-500'}`}>{l(model.custom?'Custom':'Built-in')}</span>{model.custom&&<button type="button" onClick={()=>void removeModel(model)} disabled={savingCatalog} className="min-w-10 min-h-10 flex items-center justify-center rounded-lg text-gray-500 hover:bg-red-500/10 hover:text-red-400"><Trash2 className="h-4 w-4"/></button>}</div></div>})}</div>
        <div className="mt-4 rounded-xl border border-white/10 bg-[#0e0e1d] p-3 min-w-0"><div className="mb-2 flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-xs font-semibold text-white">{l('Add model manually')}</div><div className="mt-0.5 text-[10px] text-gray-500 break-words">{l('Use the exact Gemini API model ID, for example gemini-3.x-flash.')}</div></div><Plus className="h-4 w-4 shrink-0 text-violet-400"/></div><div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_auto]"><input value={newModelId} onChange={e=>setNewModelId(e.target.value)} placeholder="gemini-model-id" spellCheck={false} className="min-w-0 rounded-xl border border-white/10 bg-[#090916] px-3 py-2.5 font-mono text-xs text-white"/><input value={newModelLabel} onChange={e=>setNewModelLabel(e.target.value)} placeholder={l('Display name (optional)')} className="min-w-0 rounded-xl border border-white/10 bg-[#090916] px-3 py-2.5 text-xs text-white"/><button type="button" onClick={()=>void addModel()} disabled={savingCatalog||!newModelId.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-2.5 text-xs font-semibold text-violet-200 disabled:opacity-40">{savingCatalog?<Loader2 className="h-4 w-4 animate-spin"/>:<Plus className="h-4 w-4"/>}{l('Add model')}</button></div></div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-gray-500 min-w-0"><span>{l('Selected')}:</span><span className="max-w-full truncate rounded-md border border-violet-500/20 bg-violet-500/10 px-2 py-1 font-mono text-violet-300">{defaultModel}</span><span>{l('Provider')}: <span className="text-gray-300">{getProviderForModel(defaultModel)}</span></span></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">{providers.map(p=>{const backendEnabled=p.service==='gemini'; const isActive=backendEnabled&&p.service===activeProvider; return <div key={p.id} className={`rounded-xl border p-4 min-w-0 ${isActive?'bg-violet-600/10 border-violet-500/30':'bg-white/[0.02] border-white/10'}`}><div className="flex items-start justify-between gap-2 mb-3"><div className="flex items-center gap-2.5 min-w-0"><div className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center ${backendEnabled?'bg-emerald-500/10':'bg-gray-500/10'}`}><Cpu className="w-4 h-4"/></div><div className="min-w-0"><div className="text-sm font-medium text-white truncate">{p.label}</div><div className="text-xs text-gray-500 capitalize truncate">{p.service}</div></div></div>{isActive&&<span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 shrink-0">{l('Default')}</span>}</div><div className="flex flex-wrap items-center gap-2 mb-3"><span className={`w-2 h-2 rounded-full ${backendEnabled?'bg-emerald-400':'bg-gray-600'}`}/><span className="text-xs text-gray-400">{backendEnabled?'Production backend enabled':'Backend not enabled'}</span><span className="text-[10px] text-gray-600">Metadata: {p.status}</span>{p.last_used&&<span className="text-xs text-gray-600 sm:ml-auto">{new Date(p.last_used).toLocaleDateString()}</span>}</div><button onClick={()=>void switchProvider(p.service)} disabled={switching||isActive||!backendEnabled} className="w-full min-h-11 py-2 rounded-lg text-xs font-medium bg-white/5 text-gray-300 disabled:opacity-50">{!backendEnabled?'Backend not enabled':isActive?'Current Provider':'Set as Default'}</button></div>})}</div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-0"><div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 sm:p-5 min-w-0 overflow-hidden"><h3 className="text-white font-semibold text-sm mb-1">{l('Daily Requests')}</h3><p className="text-gray-500 text-xs mb-4">{l('Last 14 days')}</p><BarChart data={dailyStats.map(d=>({label:d.date.slice(5),value:d.requests}))} color="#a78bfa" height={200}/></div><div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 sm:p-5 min-w-0 overflow-hidden"><h3 className="text-white font-semibold text-sm mb-1">{l('Token Usage by Provider')}</h3><p className="text-gray-500 text-xs mb-4">{l('Total tokens consumed')}</p>{tokenUsage.length>0?<div className="flex items-center justify-center min-h-[200px] min-w-0"><DonutChart data={tokenUsage} size={150}/></div>:<div className="flex items-center justify-center h-[200px] text-gray-600 text-sm">{l('No data')}</div>}</div></div>

    <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 sm:p-5 min-w-0"><h3 className="text-white font-semibold text-sm mb-4">{l('Recent System Logs')}</h3>{errorLogs.length===0?<div className="py-8 text-center text-gray-500 text-sm">{l('No logs yet')}</div>:<div className="space-y-2 max-h-72 overflow-y-auto overflow-x-hidden">{errorLogs.map(log=><div key={log.id} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5 min-w-0"><div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${log.level==='error'?'bg-red-500/10 text-red-400':log.level==='warning'?'bg-amber-500/10 text-amber-400':'bg-blue-500/10 text-blue-400'}`}><AlertCircle className="w-3.5 h-3.5"/></div><div className="flex-1 min-w-0"><div className="text-sm text-white break-words">{log.message}</div><div className="text-xs text-gray-500 flex flex-wrap items-center gap-2 mt-1"><span className="px-1.5 py-0.5 rounded bg-white/5 max-w-full truncate">{log.category}</span><Clock className="w-3 h-3 shrink-0"/><span className="break-all">{new Date(log.created_at).toLocaleString()}</span></div></div></div>)}</div>}</div>
  </div>;
}