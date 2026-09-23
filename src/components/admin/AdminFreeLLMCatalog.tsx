import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, KeyRound, Loader2, RefreshCw, Server, ShieldCheck, TestTube2 } from 'lucide-react';
import { usePreferences } from '@/context/PreferencesContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { deriveProviderHealth, type ProviderHealthState } from '@/lib/ai/provider-health';
import {
  FREE_LLM_CATALOG_SOURCE,
  FREE_LLM_CATALOG_UPDATED_AT,
  FREE_LLM_PROVIDER_PRESETS,
  resolveFreeLLMProviderBaseUrl,
  type FreeLLMProviderPreset,
} from '@/lib/ai/free-provider-registry';

type ProviderAdapter = 'gemini' | 'openai_compatible' | 'anthropic';
interface ManagedProvider {
  provider_key: string;
  label: string;
  adapter: ProviderAdapter;
  base_url: string;
  default_model: string;
  enabled: boolean;
  is_default: boolean;
  secret_configured: boolean;
}
interface ProviderTestState { ok: boolean; latencyMs: number; testedAt: number; }

const COPY = {
  en: {
    eyebrow: 'FREE LLM CATALOG', title: 'Curated free-provider registry', description: 'Configure reviewed free-tier providers without typing endpoints by hand. Tayar stores API secrets in Supabase Vault; this catalog contains no credentials and installing a provider does not change tool routing automatically.',
    source: 'Catalog metadata snapshot', refreshed: 'refreshed', getKey: 'Get API key', apiKey: 'API key', keepSecret: 'Leave blank to keep the existing secret', accountId: 'Cloudflare Account ID', model: 'Recommended model', configure: 'Configure provider', update: 'Update provider', test: 'Test', makeDefault: 'Set default', configured: 'Configured', missingSecret: 'API key required', enabled: 'Enabled', disabled: 'Disabled', default: 'Default', ready: 'Ready', notConfigured: 'Not configured', lastTest: 'Last test', permanent: 'Permanent free tier', renewable: 'Renewable/free quota', noCard: 'No card listed', registration: 'Registration', phone: 'Phone verification', loading: 'Loading provider state...', loadError: 'Could not load managed providers.', saveError: 'Could not save provider.', saved: 'Provider configured securely.', activated: 'Default AI provider changed.', tested: 'Provider connection succeeded.', accountHelp: 'Find this 32-character ID in the Cloudflare dashboard. Tayar builds the official Workers AI OpenAI-compatible base URL from it.', safety: 'Nothing here is auto-enabled until you configure a provider with your own key. Existing routes and the current production fallback remain unchanged until you explicitly change them.',
  },
  ar: {
    eyebrow: 'دليل LLM المجاني', title: 'سجل مزودي AI المجانيين المختارين', description: 'اضبط مزودين مجانيين تمت مراجعتهم بدون كتابة عناوين API يدويًا. يحفظ Tayar مفاتيح API داخل Supabase Vault؛ هذا الدليل لا يحتوي أي مفاتيح، وإضافة مزود لا تغيّر توجيه الأدوات تلقائيًا.',
    source: 'لقطة بيانات الدليل', refreshed: 'محدّثة', getKey: 'الحصول على API key', apiKey: 'مفتاح API', keepSecret: 'اتركه فارغًا للاحتفاظ بالمفتاح الحالي', accountId: 'Cloudflare Account ID', model: 'النموذج المقترح', configure: 'إعداد المزود', update: 'تحديث المزود', test: 'اختبار', makeDefault: 'جعله الافتراضي', configured: 'مُعدّ', missingSecret: 'مفتاح API مطلوب', enabled: 'مفعّل', disabled: 'معطّل', default: 'افتراضي', ready: 'جاهز', notConfigured: 'غير مُعدّ', lastTest: 'آخر اختبار', permanent: 'خطة مجانية دائمة', renewable: 'حصة مجانية/متجددة', noCard: 'بدون بطاقة حسب الدليل', registration: 'يتطلب تسجيل', phone: 'يتطلب تحقق هاتف', loading: 'جارٍ تحميل حالة المزودين...', loadError: 'تعذر تحميل المزودين المدارين.', saveError: 'تعذر حفظ المزود.', saved: 'تم إعداد المزود وحفظ المفتاح بأمان.', activated: 'تم تغيير مزود AI الافتراضي.', tested: 'نجح اتصال المزود.', accountHelp: 'تجد هذا المعرّف المكوّن من 32 خانة في لوحة Cloudflare. يبني Tayar منه عنوان Workers AI الرسمي المتوافق مع OpenAI.', safety: 'لا يتم تفعيل أي شيء تلقائيًا قبل أن تضبط المزود بمفتاحك. التوجيه الحالي والـfallback الإنتاجي يبقيان كما هما إلى أن تغيّرهما أنت صراحة.',
  },
  sv: {
    eyebrow: 'GRATIS LLM-KATALOG', title: 'Kurerat register över gratis AI-leverantörer', description: 'Konfigurera granskade gratisnivåer utan att skriva API-adresser manuellt. Tayar lagrar API-hemligheter i Supabase Vault; katalogen innehåller inga nycklar och installation ändrar inte verktygsrouting automatiskt.',
    source: 'Katalogsnapshot', refreshed: 'uppdaterad', getKey: 'Hämta API-nyckel', apiKey: 'API-nyckel', keepSecret: 'Lämna tomt för att behålla befintlig hemlighet', accountId: 'Cloudflare Account ID', model: 'Rekommenderad modell', configure: 'Konfigurera leverantör', update: 'Uppdatera leverantör', test: 'Testa', makeDefault: 'Ange som standard', configured: 'Konfigurerad', missingSecret: 'API-nyckel krävs', enabled: 'Aktiverad', disabled: 'Inaktiverad', default: 'Standard', ready: 'Redo', notConfigured: 'Inte konfigurerad', lastTest: 'Senaste test', permanent: 'Permanent gratisnivå', renewable: 'Förnybar/gratis kvot', noCard: 'Inget kort enligt katalogen', registration: 'Registrering', phone: 'Telefonverifiering', loading: 'Läser leverantörsstatus...', loadError: 'Kunde inte läsa hanterade leverantörer.', saveError: 'Kunde inte spara leverantören.', saved: 'Leverantören konfigurerades säkert.', activated: 'Standardleverantör för AI ändrades.', tested: 'Anslutningen till leverantören lyckades.', accountHelp: 'Detta 32 tecken långa ID finns i Cloudflare-panelen. Tayar bygger den officiella OpenAI-kompatibla Workers AI-adressen från det.', safety: 'Ingenting aktiveras automatiskt innan du konfigurerar leverantören med din egen nyckel. Befintlig routing och produktionsreserv förblir oförändrade tills du uttryckligen ändrar dem.',
  },
} as const;

type Copy = typeof COPY.en | typeof COPY.ar | typeof COPY.sv;
function verificationLabel(provider: FreeLLMProviderPreset, c: Copy): string {
  if (provider.verification === 'phone') return c.phone;
  if (provider.verification === 'registration') return c.registration;
  return c.noCard;
}
function healthLabel(state: ProviderHealthState, c: Copy): string {
  if (state === 'default') return c.default;
  if (state === 'ready') return c.ready;
  if (state === 'disabled') return c.disabled;
  return c.notConfigured;
}
function healthClass(state: ProviderHealthState): string {
  if (state === 'default') return 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300';
  if (state === 'ready') return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300';
  if (state === 'disabled') return 'border-amber-500/20 bg-amber-500/10 text-amber-300';
  return 'border-gray-500/20 bg-gray-500/10 text-gray-400';
}

export default function AdminFreeLLMCatalog() {
  const { prefs } = usePreferences();
  const c = COPY[prefs.language];
  const { success, error: showError } = useToast();
  const [providers, setProviders] = useState<ManagedProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [accountIds, setAccountIds] = useState<Record<string, string>>({});
  const [models, setModels] = useState<Record<string, string>>(() => Object.fromEntries(FREE_LLM_PROVIDER_PRESETS.map(provider => [provider.key, provider.models[0]?.id || ''])));
  const [tests, setTests] = useState<Record<string, ProviderTestState>>({});

  const load = useCallback(async () => {
    setLoading(true); setLoadError(null);
    const { data, error } = await supabase.functions.invoke('ai-admin-control', { body: { action: 'list' } });
    if (error) setLoadError(error.message || c.loadError);
    else setProviders((data?.providers || []) as ManagedProvider[]);
    setLoading(false);
  }, [c.loadError]);

  useEffect(() => { void load(); }, [load]);
  function managed(key: string) { return providers.find(provider => provider.provider_key === key); }

  async function configure(provider: FreeLLMProviderPreset) {
    const current = managed(provider.key);
    const apiSecret = (secrets[provider.key] || '').trim();
    if (!current?.secret_configured && !apiSecret) { showError(c.missingSecret); return; }
    let baseUrl = provider.baseUrl;
    try { baseUrl = resolveFreeLLMProviderBaseUrl(provider, accountIds[provider.key] || ''); }
    catch (error) { showError(error instanceof Error ? error.message : c.saveError); return; }
    const model = models[provider.key] || provider.models[0]?.id || '';
    if (!model) { showError(c.saveError); return; }
    setBusy(`save:${provider.key}`);
    const { error } = await supabase.functions.invoke('ai-admin-control', { body: { action: 'save', providerKey: provider.key, label: provider.label, adapter: provider.adapter, baseUrl, model, apiSecret: apiSecret || undefined, enabled: true } });
    setBusy(null);
    if (error) { showError(error.message || c.saveError); return; }
    setSecrets(previous => ({ ...previous, [provider.key]: '' }));
    setTests(previous => { const next = { ...previous }; delete next[provider.key]; return next; });
    success(c.saved); await load();
  }

  async function testProvider(providerKey: string) {
    setBusy(`test:${providerKey}`);
    const { data, error } = await supabase.functions.invoke('ai-admin-control', { body: { action: 'test', providerKey } });
    setBusy(null);
    if (error) { setTests(previous => ({ ...previous, [providerKey]: { ok: false, latencyMs: 0, testedAt: Date.now() } })); showError(error.message || c.loadError); return; }
    const latencyMs = Math.max(0, Number(data?.latencyMs) || 0);
    setTests(previous => ({ ...previous, [providerKey]: { ok: true, latencyMs, testedAt: Date.now() } }));
    success(`${c.tested}${latencyMs ? ` · ${latencyMs} ms` : ''}`);
  }

  async function activateProvider(providerKey: string) {
    setBusy(`activate:${providerKey}`);
    const { error } = await supabase.functions.invoke('ai-admin-control', { body: { action: 'activate', providerKey } });
    setBusy(null);
    if (error) { showError(error.message || c.saveError); return; }
    success(c.activated); await load();
  }

  return <section className="space-y-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.035] p-4 sm:p-5">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div className="min-w-0"><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">{c.eyebrow}</div><div className="mt-1 flex items-center gap-2"><Server className="h-5 w-5 text-emerald-300" /><h2 className="text-xl font-bold text-white">{c.title}</h2></div><p className="mt-2 max-w-4xl text-sm leading-6 text-gray-400">{c.description}</p><div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-500"><span>{c.source} · {c.refreshed} {FREE_LLM_CATALOG_UPDATED_AT}</span><a href={FREE_LLM_CATALOG_SOURCE} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-300 hover:text-emerald-200">source <ExternalLink className="h-3 w-3" /></a></div></div><button onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-gray-300 hover:bg-white/[0.06] disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button></div>
    <div className="flex items-start gap-3 rounded-xl border border-emerald-500/15 bg-black/15 p-3 text-xs leading-5 text-gray-400"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" /><span>{c.safety}</span></div>
    {loadError && <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3 text-sm text-amber-200">{loadError}</div>}
    {loading && !providers.length && <div className="flex items-center gap-2 rounded-xl border border-white/10 p-4 text-sm text-gray-400"><Loader2 className="h-4 w-4 animate-spin" />{c.loading}</div>}
    <div className="grid gap-3 xl:grid-cols-2">{FREE_LLM_PROVIDER_PRESETS.map(provider => {
      const current = managed(provider.key);
      const health = deriveProviderHealth({ configured: Boolean(current), enabled: Boolean(current?.enabled), secretConfigured: Boolean(current?.secret_configured), isDefault: Boolean(current?.is_default) });
      const selectedModel = models[provider.key] || provider.models[0]?.id || '';
      const isSaving = busy === `save:${provider.key}`;
      const test = tests[provider.key];
      return <article key={provider.key} className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-white">{provider.label}</h3><span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${healthClass(health.state)}`}>{healthLabel(health.state, c)}</span></div><p className="mt-1 text-xs leading-5 text-gray-400">{provider.description}</p></div><div className="flex shrink-0 flex-wrap gap-1.5 text-[10px]"><span className="rounded-full border border-white/10 px-2 py-1 text-gray-300">{provider.freeTier === 'permanent' ? c.permanent : c.renewable}</span><span className="rounded-full border border-white/10 px-2 py-1 text-gray-400">{verificationLabel(provider, c)}</span></div></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="min-w-0"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-gray-500">{c.model}</span><select value={selectedModel} onChange={event => setModels(previous => ({ ...previous, [provider.key]: event.target.value }))} className="min-h-11 w-full rounded-xl border border-white/10 bg-[#0d0d1a] px-3 text-sm text-white">{provider.models.map(model => <option key={model.id} value={model.id}>{model.label}</option>)}</select></label>{provider.baseUrlNeedsAccountId ? <label className="min-w-0"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-gray-500">{c.accountId}</span><input value={accountIds[provider.key] || ''} onChange={event => setAccountIds(previous => ({ ...previous, [provider.key]: event.target.value }))} placeholder="0123456789abcdef0123456789abcdef" className="min-h-11 w-full rounded-xl border border-white/10 bg-[#0d0d1a] px-3 text-sm text-white outline-none focus:border-emerald-500/40" /></label> : <div className="min-w-0 rounded-xl border border-white/10 bg-black/10 px-3 py-2"><div className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Base URL</div><div className="mt-1 truncate text-xs text-gray-300" title={provider.baseUrl}>{provider.baseUrl}</div></div>}</div>
        {provider.baseUrlNeedsAccountId && <p className="mt-1.5 text-[10px] leading-4 text-gray-500">{c.accountHelp}</p>}
        {provider.models.find(model => model.id === selectedModel)?.note && <p className="mt-2 text-[10px] leading-4 text-gray-500">{provider.models.find(model => model.id === selectedModel)?.note}</p>}
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]"><label className="min-w-0"><span className="mb-1.5 flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wide text-gray-500"><span>{c.apiKey}</span><a href={provider.apiKeyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 normal-case text-emerald-300 hover:text-emerald-200">{c.getKey}<ExternalLink className="h-3 w-3" /></a></span><div className="relative"><KeyRound className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-gray-600" /><input type="password" value={secrets[provider.key] || ''} onChange={event => setSecrets(previous => ({ ...previous, [provider.key]: event.target.value }))} placeholder={current?.secret_configured ? c.keepSecret : c.apiKey} autoComplete="new-password" className="min-h-11 w-full rounded-xl border border-white/10 bg-[#0d0d1a] pl-9 pr-3 text-sm text-white outline-none focus:border-emerald-500/40" /></div></label><button onClick={() => void configure(provider)} disabled={Boolean(busy)} className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{current ? c.update : c.configure}</button></div>
        {current && <div className="mt-3 border-t border-white/5 pt-3"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2 py-1 text-[10px] ${current.secret_configured ? 'border-blue-500/20 bg-blue-500/10 text-blue-300' : 'border-amber-500/20 bg-amber-500/10 text-amber-300'}`}>{current.secret_configured ? c.apiKey : c.missingSecret}</span><button onClick={() => void testProvider(provider.key)} disabled={Boolean(busy) || !health.canTest} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs text-gray-300 hover:bg-white/5 disabled:opacity-40">{busy === `test:${provider.key}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TestTube2 className="h-3.5 w-3.5" />}{c.test}</button>{health.canActivate && <button onClick={() => void activateProvider(provider.key)} disabled={Boolean(busy)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-cyan-500/20 px-3 text-xs text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-40">{busy === `activate:${provider.key}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Server className="h-3.5 w-3.5" />}{c.makeDefault}</button>}</div>{test && <div className={`mt-2 text-[10px] ${test.ok ? 'text-emerald-300' : 'text-amber-300'}`}>{c.lastTest}: {test.ok ? 'OK' : 'Failed'}{test.latencyMs ? ` · ${test.latencyMs} ms` : ''}</div>}</div>}
      </article>;
    })}</div>
  </section>;
}
