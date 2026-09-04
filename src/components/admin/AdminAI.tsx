import { useCallback, useEffect, useState } from 'react';
import { Activity, AlertCircle, Check, Clock, Cpu, KeyRound, Loader2, Plus, RefreshCw, Save, Server, ShieldCheck, TestTube2, ToggleLeft, ToggleRight, Trash2, Zap } from 'lucide-react';
import { useLocalizer } from '@/lib/ui-localization';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { BarChart, DonutChart } from './Charts';
import { SERVER_SUPPORTED_TEXT_MODELS, getModel } from '@/lib/ai/types';

interface ErrorLog { id: string; level: string; category: string; message: string; metadata: Record<string, unknown>; created_at: string; }
interface ManagedModel { id: string; label: string; custom: boolean; }
type ProviderAdapter = 'gemini' | 'openai_compatible' | 'anthropic';
interface DynamicProvider { id: string; provider_key: string; label: string; adapter: ProviderAdapter; base_url: string; default_model: string; enabled: boolean; is_default: boolean; secret_configured: boolean; created_at: string; updated_at: string; }
interface ProviderForm { providerKey: string; label: string; adapter: ProviderAdapter; baseUrl: string; model: string; apiSecret: string; enabled: boolean; }

const GEMINI_MODEL_ID = /^gemini-[a-z0-9][a-z0-9._-]{1,80}$/i;
const EMPTY_PROVIDER: ProviderForm = { providerKey: '', label: '', adapter: 'openai_compatible', baseUrl: 'https://api.openai.com/v1', model: '', apiSecret: '', enabled: true };
const PROVIDER_ADAPTERS: { id: ProviderAdapter; label: string }[] = [
  { id: 'openai_compatible', label: 'OpenAI-compatible' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'anthropic', label: 'Anthropic' },
];

function builtInModelCatalog(): ManagedModel[] { return SERVER_SUPPORTED_TEXT_MODELS.map((id) => ({ id, label: getModel(id)?.label || id, custom: false })); }
function parseManagedModels(value: unknown): ManagedModel[] {
  const builtIns = builtInModelCatalog(); const seen = new Set(builtIns.map((model) => model.id));
  if (!Array.isArray(value)) return builtIns;
  const custom: ManagedModel[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const source = entry as Record<string, unknown>; const id = typeof source.id === 'string' ? source.id.trim() : '';
    if (!GEMINI_MODEL_ID.test(id) || seen.has(id)) continue;
    const label = typeof source.label === 'string' && source.label.trim() ? source.label.trim().slice(0, 80) : id;
    seen.add(id); custom.push({ id, label, custom: true });
  }
  return [...builtIns, ...custom];
}
function adapterBaseUrl(adapter: ProviderAdapter) { if (adapter === 'gemini') return 'https://generativelanguage.googleapis.com'; if (adapter === 'anthropic') return 'https://api.anthropic.com'; return 'https://api.openai.com/v1'; }

export default function AdminAI() {
  const l = useLocalizer(); const { success, error: showError } = useToast();
  const [loading, setLoading] = useState(true); const [loadError, setLoadError] = useState<string | null>(null); const [providerLoadError, setProviderLoadError] = useState<string | null>(null);
  const [dynamicProviders, setDynamicProviders] = useState<DynamicProvider[]>([]); const [providerForm, setProviderForm] = useState<ProviderForm>(EMPTY_PROVIDER); const [editingKey, setEditingKey] = useState<string | null>(null); const [providerBusy, setProviderBusy] = useState<string | null>(null);
  const [defaultModel, setDefaultModel] = useState('gemini-3.6-flash'); const [savingModel, setSavingModel] = useState(false); const [savingCatalog, setSavingCatalog] = useState(false); const [modelCatalog, setModelCatalog] = useState<ManagedModel[]>(() => builtInModelCatalog()); const [newModelId, setNewModelId] = useState(''); const [newModelLabel, setNewModelLabel] = useState('');
  const [dailyStats, setDailyStats] = useState<{ date: string; requests: number; tokens: number }[]>([]); const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]); const [tokenUsage, setTokenUsage] = useState<{ label: string; value: number }[]>([]); const [recentAiErrorCount, setRecentAiErrorCount] = useState(0);

  const loadProviders = useCallback(async () => {
    setProviderLoadError(null);
    const { data, error } = await supabase.functions.invoke('ai-admin-control', { body: { action: 'list' } });
    if (error) { setProviderLoadError(error.message || 'Could not load managed AI providers.'); return; }
    setDynamicProviders((data?.providers || []) as DynamicProvider[]);
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setLoadError(null);
    const [usageRes, logsRes, modelRes, catalogRes] = await Promise.all([
      supabase.from('ai_usage').select('created_at, tokens_in, tokens_out, provider, model, tool, status').limit(5000),
      supabase.from('system_logs').select('id, level, category, message, metadata, created_at').order('created_at', { ascending: false }).limit(20),
      supabase.from('admin_settings').select('key, value').eq('key', 'default_ai_model').maybeSingle(),
      supabase.from('admin_settings').select('key, value').eq('key', 'ai_model_catalog').maybeSingle(),
    ]);
    const queryError = usageRes.error || logsRes.error || modelRes.error || catalogRes.error;
    if (queryError) { setLoadError(queryError.message || 'Failed to load AI administration data.'); setLoading(false); return; }
    const catalog = parseManagedModels(catalogRes.data?.value); setModelCatalog(catalog);
    const rawModel = modelRes.data?.value; const modelValue = typeof rawModel === 'string' ? rawModel.replace(/"/g, '') : (rawModel && typeof rawModel === 'object' ? String((rawModel as Record<string, unknown>).default || '') : '');
    setDefaultModel(catalog.some((model) => model.id === modelValue) ? modelValue : 'gemini-3.6-flash');
    const usage = (usageRes.data || []) as { created_at: string; tokens_in: number; tokens_out: number; provider?: string; status: string }[]; setRecentAiErrorCount(usage.filter((entry) => entry.status === 'error').length);
    const days: Record<string, { requests: number; tokens: number }> = {}; const now = new Date();
    for (let i = 13; i >= 0; i--) { const day = new Date(now); day.setDate(day.getDate() - i); days[day.toISOString().split('T')[0]] = { requests: 0, tokens: 0 }; }
    for (const entry of usage) { const key = new Date(entry.created_at).toISOString().split('T')[0]; if (days[key]) { days[key].requests += 1; days[key].tokens += (entry.tokens_in || 0) + (entry.tokens_out || 0); } }
    setDailyStats(Object.entries(days).map(([date, value]) => ({ date, ...value })));
    const byProvider: Record<string, number> = {}; for (const entry of usage) { const provider = entry.provider || 'unknown'; byProvider[provider] = (byProvider[provider] || 0) + (entry.tokens_in || 0) + (entry.tokens_out || 0); }
    setTokenUsage(Object.entries(byProvider).map(([label, value]) => ({ label, value }))); setErrorLogs((logsRes.data || []) as ErrorLog[]); await loadProviders(); setLoading(false);
  }, [loadProviders]);

  useEffect(() => { void load(); }, [load]);

  async function invokeProviderAction(body: Record<string, unknown>, busyKey: string) {
    setProviderBusy(busyKey); const { data, error } = await supabase.functions.invoke('ai-admin-control', { body }); setProviderBusy(null);
    if (error) { showError(error.message || 'AI provider action failed.'); return null; }
    return data;
  }
  async function saveProvider() {
    const form = providerForm; if (!form.providerKey.trim() || !form.label.trim() || !form.baseUrl.trim() || !form.model.trim()) { showError('Provider key, name, Base URL and Model ID are required.'); return; }
    const result = await invokeProviderAction({ action: 'save', providerKey: form.providerKey.trim(), label: form.label.trim(), adapter: form.adapter, baseUrl: form.baseUrl.trim(), model: form.model.trim(), apiSecret: form.apiSecret.trim() || undefined, enabled: form.enabled }, 'save');
    if (!result) return; success(editingKey ? 'AI provider updated.' : 'AI provider saved securely.'); setProviderForm(EMPTY_PROVIDER); setEditingKey(null); await loadProviders();
  }
  function editProvider(provider: DynamicProvider) { setEditingKey(provider.provider_key); setProviderForm({ providerKey: provider.provider_key, label: provider.label, adapter: provider.adapter, baseUrl: provider.base_url, model: provider.default_model, apiSecret: '', enabled: provider.enabled }); }
  async function testProvider(providerKey: string) { const result = await invokeProviderAction({ action: 'test', providerKey }, `test:${providerKey}`); if (!result) return; success(`Connection successful${result.latencyMs ? ` · ${result.latencyMs} ms` : ''}`); }
  async function activateProvider(providerKey: string) { const result = await invokeProviderAction({ action: 'activate', providerKey }, `activate:${providerKey}`); if (!result) return; success('Default AI provider changed.'); await loadProviders(); }
  async function toggleProvider(provider: DynamicProvider) { const result = await invokeProviderAction({ action: 'set_enabled', providerKey: provider.provider_key, enabled: !provider.enabled }, `toggle:${provider.provider_key}`); if (!result) return; success(provider.enabled ? 'Provider disabled.' : 'Provider enabled.'); await loadProviders(); }

  async function saveDefaultModel() {
    if (!modelCatalog.some((model) => model.id === defaultModel)) { showError('Choose a model from the managed Gemini catalog.'); return; }
    setSavingModel(true); const now = new Date().toISOString(); const { error } = await supabase.from('admin_settings').upsert([{ key: 'default_ai_model', value: defaultModel, updated_at: now }, { key: 'default_ai_provider', value: 'gemini', updated_at: now }], { onConflict: 'key' }); setSavingModel(false);
    if (error) showError('Failed to save fallback Gemini model.'); else success(`Fallback Gemini model set to ${defaultModel}`);
  }
  async function persistModelCatalog(nextCatalog: ManagedModel[]) { setSavingCatalog(true); const customModels = nextCatalog.filter((model) => model.custom).map((model) => ({ id: model.id, label: model.label, enabled: true })); const { error } = await supabase.from('admin_settings').upsert({ key: 'ai_model_catalog', value: customModels, updated_at: new Date().toISOString() }, { onConflict: 'key' }); setSavingCatalog(false); if (error) { showError(error.message || 'Failed to save model catalog'); return false; } return true; }
  async function addModel() { const id = newModelId.trim(); const label = newModelLabel.trim() || id; if (!GEMINI_MODEL_ID.test(id)) { showError('Fallback Gemini Model ID must start with gemini-.'); return; } if (modelCatalog.some((model) => model.id.toLowerCase() === id.toLowerCase())) { showError('This model already exists.'); return; } const next = [...modelCatalog, { id, label: label.slice(0, 80), custom: true }]; if (!(await persistModelCatalog(next))) return; setModelCatalog(next); setNewModelId(''); setNewModelLabel(''); success(`Added ${label}`); }
  async function removeModel(model: ManagedModel) { if (!model.custom) return; if (model.id === defaultModel) { showError('Choose another fallback model before removing this one.'); return; } const next = modelCatalog.filter((item) => item.id !== model.id); if (!(await persistModelCatalog(next))) return; setModelCatalog(next); success(`Removed ${model.label}`); }

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-violet-500" /></div>;
  if (loadError) return <div className="mx-auto max-w-xl rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-center sm:p-6"><AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-400" /><h2 className="mb-2 font-semibold text-white">{l('AI admin data unavailable')}</h2><p className="mb-4 break-words text-sm text-gray-400">{loadError}</p><button onClick={() => void load()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white"><RefreshCw className="h-4 w-4" />{l('Retry')}</button></div>;

  const totalRequests = dailyStats.reduce((sum, day) => sum + day.requests, 0); const totalTokens = dailyStats.reduce((sum, day) => sum + day.tokens, 0); const errorRate = totalRequests > 0 ? (recentAiErrorCount / totalRequests) * 100 : 0; const defaultProvider = dynamicProviders.find((provider) => provider.is_default);

  return <div className="mx-auto max-w-7xl min-w-0 space-y-5 overflow-x-hidden">
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">{[
      { label: '14d Requests', value: totalRequests.toLocaleString(), icon: Zap, cls: 'border-violet-500/20 bg-violet-500/10 text-violet-400' },
      { label: 'Total Tokens', value: totalTokens.toLocaleString(), icon: Activity, cls: 'border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-400' },
      { label: 'Managed Providers', value: dynamicProviders.filter((p) => p.enabled).length.toString(), icon: Server, cls: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' },
      { label: 'Recent Error Rate', value: `${errorRate.toFixed(1)}%`, icon: AlertCircle, cls: 'border-amber-500/20 bg-amber-500/10 text-amber-400' },
    ].map((item) => { const Icon = item.icon; return <div key={item.label} className={`min-w-0 rounded-2xl border p-3 sm:p-4 ${item.cls}`}><Icon className="mb-2 h-5 w-5" /><div className="truncate text-xl font-bold text-white sm:text-2xl">{item.value}</div><div className="text-[11px] leading-tight text-gray-400 sm:text-xs">{l(item.label)}</div></div>; })}</div>

    <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.04] p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 shrink-0 text-violet-300" /><h2 className="font-semibold text-white">{l('No-code AI Provider Control')}</h2></div><p className="mt-1 max-w-3xl text-xs leading-5 text-gray-400">{l('Add a provider, Base URL, Model ID and API secret here. Secrets stay in Supabase Vault. After this control layer is installed, adding or changing providers does not require code changes or database changes.')}</p></div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-xs ${defaultProvider ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-blue-500/20 bg-blue-500/10 text-blue-300'}`}>{defaultProvider ? `${l('Default')}: ${defaultProvider.label}` : l('Current Gemini fallback active')}</span><button onClick={() => void loadProviders()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-gray-300 hover:bg-white/5"><RefreshCw className="h-4 w-4" />{l('Refresh')}</button></div></div>
      {providerLoadError && <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200"><div className="mb-1 font-medium">{l('Backend not enabled')}</div><div className="break-words">{providerLoadError}</div></div>}
      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,.8fr)]">
        <div className="space-y-3">{dynamicProviders.length === 0 ? <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-sm text-gray-400">{l('No managed provider has been added yet. Tayar continues using the current Gemini environment configuration until you add and activate one.')}</div> : dynamicProviders.map((provider) => <div key={provider.id} className={`rounded-2xl border p-4 ${provider.is_default ? 'border-violet-500/30 bg-violet-500/[0.06]' : 'border-white/10 bg-white/[0.02]'}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-medium text-white">{provider.label}</span>{provider.is_default && <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] text-violet-300">{l('Default')}</span>}<span className={`rounded-full px-2 py-0.5 text-[10px] ${provider.enabled ? 'bg-emerald-500/10 text-emerald-300' : 'bg-gray-500/10 text-gray-500'}`}>{provider.enabled ? l('Enabled') : l('Disabled')}</span></div><div className="mt-2 grid gap-1 text-xs text-gray-500"><span className="break-all"><span className="text-gray-600">{l('Key')}:</span> {provider.provider_key}</span><span className="break-all"><span className="text-gray-600">{l('Adapter')}:</span> {provider.adapter}</span><span className="break-all"><span className="text-gray-600">{l('Base URL')}:</span> {provider.base_url}</span><span className="break-all"><span className="text-gray-600">{l('Model ID')}:</span> {provider.default_model}</span></div><div className="mt-3 flex items-center gap-2 text-xs"><KeyRound className="h-3.5 w-3.5 text-gray-500" /><span className={provider.secret_configured ? 'text-emerald-300' : 'text-amber-300'}>{provider.secret_configured ? l('Secret configured in Vault') : l('API secret missing')}</span></div></div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end"><button onClick={() => editProvider(provider)} className="min-h-10 rounded-xl border border-white/10 px-3 py-2 text-xs text-gray-300 hover:bg-white/5">{l('Edit')}</button><button onClick={() => void testProvider(provider.provider_key)} disabled={providerBusy === `test:${provider.provider_key}` || !provider.enabled || !provider.secret_configured} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200 disabled:opacity-40">{providerBusy === `test:${provider.provider_key}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TestTube2 className="h-3.5 w-3.5" />}{l('Test')}</button><button onClick={() => void activateProvider(provider.provider_key)} disabled={providerBusy === `activate:${provider.provider_key}` || provider.is_default || !provider.enabled || !provider.secret_configured} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-xs text-violet-200 disabled:opacity-40">{providerBusy === `activate:${provider.provider_key}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}{provider.is_default ? l('Active') : l('Make Default')}</button><button onClick={() => void toggleProvider(provider)} disabled={providerBusy === `toggle:${provider.provider_key}`} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs text-gray-300 disabled:opacity-40">{provider.enabled ? <ToggleRight className="h-4 w-4 text-emerald-300" /> : <ToggleLeft className="h-4 w-4" />}{provider.enabled ? l('Disable') : l('Enable')}</button></div></div>
        </div>)}</div>
        <div className="rounded-2xl border border-white/10 bg-[#0b0b18] p-4"><div className="mb-4 flex items-start justify-between gap-3"><div><h3 className="font-semibold text-white">{editingKey ? l('Edit AI Provider') : l('Add AI Provider')}</h3><p className="mt-1 text-[11px] leading-5 text-gray-500">{l('Leave API Secret empty while editing to keep the existing secret.')}</p></div><Plus className="h-5 w-5 text-violet-400" /></div>
          <div className="space-y-3">
            <label className="block"><span className="mb-1 block text-xs text-gray-400">{l('Provider Key')}</span><input value={providerForm.providerKey} disabled={Boolean(editingKey)} onChange={(e) => setProviderForm((p) => ({ ...p, providerKey: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') }))} placeholder="openai-main" className="min-h-11 w-full rounded-xl border border-white/10 bg-[#090916] px-3 text-sm text-white disabled:opacity-60" /></label>
            <label className="block"><span className="mb-1 block text-xs text-gray-400">{l('Display Name')}</span><input value={providerForm.label} onChange={(e) => setProviderForm((p) => ({ ...p, label: e.target.value }))} placeholder="OpenAI Production" className="min-h-11 w-full rounded-xl border border-white/10 bg-[#090916] px-3 text-sm text-white" /></label>
            <div><span className="mb-1 block text-xs text-gray-400">{l('Adapter')}</span><div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="group" aria-label={l('Adapter')}>{PROVIDER_ADAPTERS.map((adapter) => { const selected = providerForm.adapter === adapter.id; return <button key={adapter.id} type="button" onClick={() => setProviderForm((p) => ({ ...p, adapter: adapter.id, baseUrl: adapterBaseUrl(adapter.id) }))} className={`min-h-11 rounded-xl border px-3 text-xs font-medium transition-colors ${selected ? 'border-violet-400/40 bg-violet-500/15 text-violet-200' : 'border-white/10 bg-[#090916] text-gray-400 hover:bg-white/5 hover:text-white'}`}>{adapter.label}</button>; })}</div></div>
            <label className="block"><span className="mb-1 block text-xs text-gray-400">{l('Base URL')}</span><input value={providerForm.baseUrl} onChange={(e) => setProviderForm((p) => ({ ...p, baseUrl: e.target.value }))} placeholder="https://api.provider.com/v1" spellCheck={false} className="min-h-11 w-full rounded-xl border border-white/10 bg-[#090916] px-3 font-mono text-xs text-white" /></label>
            <label className="block"><span className="mb-1 block text-xs text-gray-400">{l('Model ID')}</span><input value={providerForm.model} onChange={(e) => setProviderForm((p) => ({ ...p, model: e.target.value }))} placeholder="model-id" spellCheck={false} className="min-h-11 w-full rounded-xl border border-white/10 bg-[#090916] px-3 font-mono text-xs text-white" /></label>
            <label className="block"><span className="mb-1 block text-xs text-gray-400">{l('API Secret')}</span><input type="password" autoComplete="new-password" value={providerForm.apiSecret} onChange={(e) => setProviderForm((p) => ({ ...p, apiSecret: e.target.value }))} placeholder={editingKey ? l('Leave blank to keep current secret') : 'sk-...'} className="min-h-11 w-full rounded-xl border border-white/10 bg-[#090916] px-3 font-mono text-xs text-white" /></label>
            <label className="flex min-h-11 items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-3"><span className="text-xs text-gray-300">{l('Enabled')}</span><input type="checkbox" checked={providerForm.enabled} onChange={(e) => setProviderForm((p) => ({ ...p, enabled: e.target.checked }))} className="h-4 w-4" /></label>
            <div className="grid grid-cols-2 gap-2">{editingKey && <button onClick={() => { setEditingKey(null); setProviderForm(EMPTY_PROVIDER); }} className="min-h-11 rounded-xl border border-white/10 px-3 text-xs text-gray-300">{l('Cancel')}</button>}<button onClick={() => void saveProvider()} disabled={providerBusy === 'save'} className={`${editingKey ? '' : 'col-span-2'} inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-semibold text-white disabled:opacity-50`}>{providerBusy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{editingKey ? l('Save Changes') : l('Save Provider')}</button></div>
          </div>
        </div>
      </div>
    </div>

    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5"><div className="mb-4 flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-white">{l('Current Gemini fallback')}</h3><p className="mt-1 text-xs leading-5 text-gray-500">{l('This keeps Tayar working exactly as it does today when no managed provider is active.')}</p><p className="mt-1 text-[11px] text-gray-600">{l('Add model manually')}</p></div><Cpu className="h-5 w-5 text-emerald-400" /></div>
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">{modelCatalog.map((model) => { const selected = model.id === defaultModel; return <div key={model.id} className={`flex items-center gap-3 rounded-xl border p-3 ${selected ? 'border-violet-400/50 bg-violet-500/10' : 'border-white/10 bg-[#111122]'}`}><button type="button" onClick={() => setDefaultModel(model.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${selected ? 'border-violet-400/40 bg-violet-500/20 text-violet-300' : 'border-white/10 bg-black/20 text-gray-500'}`}>{selected ? <Check className="h-4 w-4" /> : <Cpu className="h-4 w-4" />}</span><span className="min-w-0"><span className="block truncate text-sm font-medium text-white">{model.label}</span><span className="block truncate font-mono text-[10px] text-gray-500">{model.id}</span></span></button>{model.custom && <button type="button" onClick={() => void removeModel(model)} disabled={savingCatalog} className="flex min-h-10 min-w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-red-500/10 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>}</div>; })}</div>
      <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_auto_auto]"><input value={newModelId} onChange={(e) => setNewModelId(e.target.value)} placeholder="gemini-model-id" className="min-h-11 rounded-xl border border-white/10 bg-[#090916] px-3 font-mono text-xs text-white" /><input value={newModelLabel} onChange={(e) => setNewModelLabel(e.target.value)} placeholder={l('Display name (optional)')} className="min-h-11 rounded-xl border border-white/10 bg-[#090916] px-3 text-xs text-white" /><button onClick={() => void addModel()} disabled={savingCatalog || !newModelId.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 text-xs text-gray-300 disabled:opacity-40"><Plus className="h-4 w-4" />{l('Add')}</button><button onClick={() => void saveDefaultModel()} disabled={savingModel} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-semibold text-white disabled:opacity-40">{savingModel ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{l('Save fallback')}</button></div>
    </div>

    <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2"><div className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5"><h3 className="mb-1 text-sm font-semibold text-white">{l('Daily Requests')}</h3><p className="mb-4 text-xs text-gray-500">{l('Last 14 days')}</p><BarChart data={dailyStats.map((d) => ({ label: d.date.slice(5), value: d.requests }))} color="#a78bfa" height={200} /></div><div className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5"><h3 className="mb-1 text-sm font-semibold text-white">{l('Token Usage by Provider')}</h3><p className="mb-4 text-xs text-gray-500">{l('Total tokens consumed')}</p>{tokenUsage.length > 0 ? <div className="flex min-h-[200px] min-w-0 items-center justify-center"><DonutChart data={tokenUsage} size={150} /></div> : <div className="flex h-[200px] items-center justify-center text-sm text-gray-600">{l('No data')}</div>}</div></div>

    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5"><h3 className="mb-4 text-sm font-semibold text-white">{l('Recent System Logs')}</h3>{errorLogs.length === 0 ? <div className="py-8 text-center text-sm text-gray-500">{l('No logs yet')}</div> : <div className="max-h-72 space-y-2 overflow-y-auto overflow-x-hidden">{errorLogs.map((log) => <div key={log.id} className="flex min-w-0 items-start gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3"><div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${log.level === 'error' ? 'bg-red-500/10 text-red-400' : log.level === 'warning' ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'}`}><AlertCircle className="h-3.5 w-3.5" /></div><div className="min-w-0 flex-1"><div className="break-words text-sm text-white">{log.message}</div><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500"><span className="max-w-full truncate rounded bg-white/5 px-1.5 py-0.5">{log.category}</span><Clock className="h-3 w-3 shrink-0" /><span className="break-all">{new Date(log.created_at).toLocaleString()}</span></div></div></div>)}</div>}</div>
  </div>;
}
