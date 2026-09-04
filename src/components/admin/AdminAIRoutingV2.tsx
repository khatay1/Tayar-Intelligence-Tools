import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownUp, Bot, Loader2, RefreshCw, RotateCcw, Save, ShieldCheck } from 'lucide-react';
import { usePreferences } from '@/context/PreferencesContext';
import { supabase } from '@/lib/supabase';
import { toolRegistry } from '@/modules/registry';

const AI_TOOL_IDS = new Set([
  'ai-chat', 'cv-builder', 'cover-letter', 'ai-writer', 'document-ai',
  'study-assistant', 'translator', 'website-builder', 'code-assistant',
]);
const MODEL_ID = /^[a-z0-9][a-z0-9._:/-]{0,120}$/i;

type ProviderAdapter = 'gemini' | 'openai_compatible' | 'anthropic';
interface ProviderRow { provider_key: string; label: string; adapter: ProviderAdapter; default_model: string; enabled: boolean; is_default: boolean; }
interface ToolRoute { primaryProviderKey: string; primaryModel: string; fallbackProviderKey: string; fallbackModel: string; }
interface RoutingConfig { version: 2; routes: Record<string, ToolRoute>; }

const EMPTY_ROUTE: ToolRoute = { primaryProviderKey: '', primaryModel: '', fallbackProviderKey: '', fallbackModel: '' };
const EMPTY_CONFIG: RoutingConfig = { version: 2, routes: {} };

const COPY = {
  en: {
    eyebrow: 'ADMIN V2', title: 'AI Routing V2', description: 'Choose the provider and model for each AI tool without changing code. Empty routes keep using the global default provider. Provider failures can fall through to an explicit fallback, then to the existing managed/global Gemini fallback.',
    primary: 'Primary provider', primaryModel: 'Primary model', fallback: 'Fallback provider', fallbackModel: 'Fallback model', global: 'Global default', automatic: 'Automatic fallback', providerDefault: 'Provider default model', save: 'Save AI routes', saving: 'Saving...', saved: 'AI routing saved', refresh: 'Refresh', reset: 'Reset route', noProviders: 'No enabled managed providers yet. Global Gemini fallback remains available.', source: 'Routing changes are runtime configuration. API secrets stay in Vault and are never stored here.', invalidModel: 'Model IDs may contain letters, numbers, dots, underscores, colons, slashes and hyphens.', loadError: 'Could not load AI routing configuration.', saveError: 'Could not save AI routing configuration.', inherited: 'Inherited', custom: 'Custom route',
  },
  ar: {
    eyebrow: 'ADMIN V2', title: 'توجيه الذكاء الاصطناعي V2', description: 'اختر المزود والنموذج لكل أداة AI بدون تعديل الكود. المسارات الفارغة تستمر باستخدام المزود الافتراضي العام. عند فشل المزود يمكن الانتقال إلى مزود احتياطي محدد ثم إلى إعداد Gemini الاحتياطي الحالي.',
    primary: 'المزود الأساسي', primaryModel: 'النموذج الأساسي', fallback: 'المزود الاحتياطي', fallbackModel: 'النموذج الاحتياطي', global: 'الافتراضي العام', automatic: 'احتياطي تلقائي', providerDefault: 'النموذج الافتراضي للمزود', save: 'حفظ توجيه AI', saving: 'جارٍ الحفظ...', saved: 'تم حفظ توجيه AI', refresh: 'تحديث', reset: 'إعادة ضبط المسار', noProviders: 'لا يوجد مزود مُدار ومفعّل بعد. يبقى إعداد Gemini الاحتياطي العام متاحًا.', source: 'تغييرات التوجيه إعدادات تشغيل مباشرة. أسرار API تبقى داخل Vault ولا يتم حفظها هنا.', invalidModel: 'يمكن لمعرف النموذج أن يحتوي أحرفًا وأرقامًا ونقاطًا وشرطات سفلية ونقطتين وشرطات مائلة وواصلات.', loadError: 'تعذر تحميل إعدادات توجيه AI.', saveError: 'تعذر حفظ إعدادات توجيه AI.', inherited: 'موروث', custom: 'مسار مخصص',
  },
  sv: {
    eyebrow: 'ADMIN V2', title: 'AI-routing V2', description: 'Välj leverantör och modell för varje AI-verktyg utan kodändringar. Tomma rutter fortsätter använda den globala standardleverantören. Leverantörsfel kan falla vidare till en vald reserv och därefter till befintlig global/Gemini-reserv.',
    primary: 'Primär leverantör', primaryModel: 'Primär modell', fallback: 'Reservleverantör', fallbackModel: 'Reservmodell', global: 'Global standard', automatic: 'Automatisk reserv', providerDefault: 'Leverantörens standardmodell', save: 'Spara AI-routing', saving: 'Sparar...', saved: 'AI-routing sparades', refresh: 'Uppdatera', reset: 'Återställ rutt', noProviders: 'Inga aktiverade hanterade leverantörer ännu. Global Gemini-reserv är fortfarande tillgänglig.', source: 'Routingändringar är runtime-konfiguration. API-hemligheter stannar i Vault och lagras aldrig här.', invalidModel: 'Modell-ID får innehålla bokstäver, siffror, punkter, understreck, kolon, snedstreck och bindestreck.', loadError: 'Det gick inte att läsa AI-routingkonfigurationen.', saveError: 'Det gick inte att spara AI-routingkonfigurationen.', inherited: 'Ärvd', custom: 'Anpassad rutt',
  },
} as const;

function normalizeRoute(value: unknown): ToolRoute {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...EMPTY_ROUTE };
  const source = value as Record<string, unknown>;
  return {
    primaryProviderKey: typeof source.primaryProviderKey === 'string' ? source.primaryProviderKey.trim() : '',
    primaryModel: typeof source.primaryModel === 'string' ? source.primaryModel.trim() : '',
    fallbackProviderKey: typeof source.fallbackProviderKey === 'string' ? source.fallbackProviderKey.trim() : '',
    fallbackModel: typeof source.fallbackModel === 'string' ? source.fallbackModel.trim() : '',
  };
}

function normalizeConfig(value: unknown): RoutingConfig {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const routesSource = source.routes && typeof source.routes === 'object' && !Array.isArray(source.routes) ? source.routes as Record<string, unknown> : {};
  const routes: Record<string, ToolRoute> = {};
  for (const toolId of AI_TOOL_IDS) {
    const route = normalizeRoute(routesSource[toolId]);
    if (route.primaryProviderKey || route.primaryModel || route.fallbackProviderKey || route.fallbackModel) routes[toolId] = route;
  }
  return { version: 2, routes };
}

export default function AdminAIRoutingV2() {
  const { prefs } = usePreferences();
  const c = COPY[prefs.language];
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [config, setConfig] = useState<RoutingConfig>(EMPTY_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tools = useMemo(() => toolRegistry.all().filter(tool => AI_TOOL_IDS.has(tool.id)), []);
  const enabledProviders = useMemo(() => providers.filter(provider => provider.enabled), [providers]);

  const load = useCallback(async () => {
    setLoading(true); setError(null); setMessage(null);
    const [providerRes, routeRes] = await Promise.all([
      supabase.functions.invoke('ai-admin-control', { body: { action: 'list' } }),
      supabase.from('admin_settings').select('value').eq('key', 'ai_tool_routes_v2').maybeSingle(),
    ]);
    if (providerRes.error || routeRes.error) setError(providerRes.error?.message || routeRes.error?.message || c.loadError);
    setProviders((providerRes.data?.providers || []) as ProviderRow[]);
    setConfig(normalizeConfig(routeRes.data?.value));
    setLoading(false);
  }, [c.loadError]);

  useEffect(() => { void load(); }, [load]);

  function routeFor(toolId: string): ToolRoute { return config.routes[toolId] || EMPTY_ROUTE; }
  function patchRoute(toolId: string, patch: Partial<ToolRoute>) {
    setConfig(previous => {
      const next = { ...routeForFrom(previous, toolId), ...patch };
      const routes = { ...previous.routes };
      if (!next.primaryProviderKey && !next.primaryModel && !next.fallbackProviderKey && !next.fallbackModel) delete routes[toolId];
      else routes[toolId] = next;
      return { version: 2, routes };
    });
  }
  function resetRoute(toolId: string) {
    setConfig(previous => { const routes = { ...previous.routes }; delete routes[toolId]; return { version: 2, routes }; });
  }

  async function save() {
    for (const route of Object.values(config.routes)) {
      if ((route.primaryModel && !MODEL_ID.test(route.primaryModel)) || (route.fallbackModel && !MODEL_ID.test(route.fallbackModel))) {
        setError(c.invalidModel); return;
      }
    }
    const allowedProviders = new Set(enabledProviders.map(provider => provider.provider_key));
    const cleaned: RoutingConfig = { version: 2, routes: {} };
    for (const [toolId, raw] of Object.entries(config.routes)) {
      const route = normalizeRoute(raw);
      if (route.primaryProviderKey && !allowedProviders.has(route.primaryProviderKey)) { setError(`${toolId}: ${c.primary}`); return; }
      if (route.fallbackProviderKey && !allowedProviders.has(route.fallbackProviderKey)) { setError(`${toolId}: ${c.fallback}`); return; }
      if (route.primaryProviderKey || route.primaryModel || route.fallbackProviderKey || route.fallbackModel) cleaned.routes[toolId] = route;
    }
    setSaving(true); setError(null); setMessage(null);
    const { error: saveError } = await supabase.from('admin_settings').upsert({ key: 'ai_tool_routes_v2', value: cleaned, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    setSaving(false);
    if (saveError) { setError(saveError.message || c.saveError); return; }
    setConfig(cleaned); setMessage(c.saved);
  }

  if (loading) return <div className="flex items-center justify-center rounded-2xl border border-cyan-500/15 bg-cyan-500/[0.03] py-12"><Loader2 className="h-7 w-7 animate-spin text-cyan-400" /></div>;

  return (
    <section className="space-y-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.035] p-4 sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">{c.eyebrow}</div>
          <div className="mt-1 flex items-center gap-2"><ArrowDownUp className="h-5 w-5 text-cyan-300" /><h2 className="text-xl font-bold text-white">{c.title}</h2></div>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-gray-400">{c.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => void load()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-gray-300 hover:bg-white/[0.06]"><RefreshCw className="h-4 w-4" />{c.refresh}</button>
          <button onClick={() => void save()} disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-600 px-4 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? c.saving : c.save}</button>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/15 p-3 text-xs leading-5 text-gray-400"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" /><span>{c.source}</span></div>
      {!enabledProviders.length && <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.05] p-3 text-sm text-blue-200">{c.noProviders}</div>}
      {error && <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3 text-sm text-amber-200">{error}</div>}
      {message && <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3 text-sm text-emerald-200">{message}</div>}

      <div className="grid gap-3 xl:grid-cols-2">
        {tools.map(tool => {
          const route = routeFor(tool.id); const hasCustom = Boolean(config.routes[tool.id]);
          return <article key={tool.id} className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10"><Bot className="h-5 w-5 text-cyan-300" /></div><div className="min-w-0"><div className="truncate text-sm font-semibold text-white">{tool.name}</div><div className="mt-0.5 text-[10px] uppercase tracking-wide text-gray-500">{hasCustom ? c.custom : c.inherited}</div></div></div>
              {hasCustom && <button onClick={() => resetRoute(tool.id)} className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-white/10 px-3 text-xs text-gray-400 hover:bg-white/5"><RotateCcw className="h-3.5 w-3.5" />{c.reset}</button>}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="min-w-0"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-gray-500">{c.primary}</span><select value={route.primaryProviderKey} onChange={event => patchRoute(tool.id, { primaryProviderKey: event.target.value })} className="min-h-11 w-full rounded-xl border border-white/10 bg-[#0d0d1a] px-3 text-sm text-white"><option value="">{c.global}</option>{enabledProviders.map(provider => <option key={provider.provider_key} value={provider.provider_key}>{provider.label}{provider.is_default ? ' ★' : ''}</option>)}</select></label>
              <label className="min-w-0"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-gray-500">{c.primaryModel}</span><input value={route.primaryModel} onChange={event => patchRoute(tool.id, { primaryModel: event.target.value.trim() })} placeholder={c.providerDefault} className="min-h-11 w-full rounded-xl border border-white/10 bg-[#0d0d1a] px-3 text-sm text-white outline-none focus:border-cyan-500/40" /></label>
              <label className="min-w-0"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-gray-500">{c.fallback}</span><select value={route.fallbackProviderKey} onChange={event => patchRoute(tool.id, { fallbackProviderKey: event.target.value })} className="min-h-11 w-full rounded-xl border border-white/10 bg-[#0d0d1a] px-3 text-sm text-white"><option value="">{c.automatic}</option>{enabledProviders.map(provider => <option key={provider.provider_key} value={provider.provider_key}>{provider.label}</option>)}</select></label>
              <label className="min-w-0"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-gray-500">{c.fallbackModel}</span><input value={route.fallbackModel} disabled={!route.fallbackProviderKey} onChange={event => patchRoute(tool.id, { fallbackModel: event.target.value.trim() })} placeholder={c.providerDefault} className="min-h-11 w-full rounded-xl border border-white/10 bg-[#0d0d1a] px-3 text-sm text-white outline-none focus:border-cyan-500/40 disabled:opacity-45" /></label>
            </div>
          </article>;
        })}
      </div>
    </section>
  );
}

function routeForFrom(config: RoutingConfig, toolId: string): ToolRoute {
  return config.routes[toolId] || EMPTY_ROUTE;
}
