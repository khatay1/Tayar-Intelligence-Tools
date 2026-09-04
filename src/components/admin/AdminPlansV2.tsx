import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, Loader2, RefreshCw, Save, Sparkles, Wrench } from 'lucide-react';
import { usePreferences } from '@/context/PreferencesContext';
import { supabase } from '@/lib/supabase';
import {
  DEFAULT_PLAN_ADMIN_CATALOG_V2,
  fetchPublicPlanCatalogV2,
  formatPlanPrice,
  normalizePlanAdminCatalogV2,
  planDisplayName,
  type PlanAdminCatalogV2,
  type PlanId,
  type PublicPlanCatalogV2,
} from '@/lib/plan-catalog-v2';

const PLAN_IDS: PlanId[] = ['free', 'pro', 'business'];
const EDIT_LANGUAGES = ['en', 'ar', 'sv'] as const;
type EditLanguage = typeof EDIT_LANGUAGES[number];

type PeriodLabels = { day: string; month: string; lifetime: string };

const COPY = {
  en: {
    eyebrow: 'ADMIN V2',
    title: 'Plan Control V2',
    description: 'Pricing and included tools now come from the same live rules that Tayar enforces. Change tool access or quotas in Tools and the public plan catalog follows automatically.',
    refresh: 'Refresh',
    save: 'Save plan catalog',
    saving: 'Saving...',
    saved: 'Plan catalog saved',
    loadError: 'Could not load the live plan catalog. The editor is using safe defaults.',
    saveError: 'Could not save the plan catalog.',
    visible: 'Shown on pricing',
    hidden: 'Hidden from pricing',
    featured: 'Featured plan',
    descriptionLabel: 'Public description',
    includedTools: 'Included tools',
    noTools: 'No tools are currently included for this plan.',
    manageTools: 'Manage tool access & limits',
    unlimited: 'Unlimited',
    day: 'day',
    month: 'month',
    lifetime: 'lifetime',
    language: 'Edit language',
    source: 'Source of truth: Admin tool rules + live plan limits + active Stripe price.',
  },
  ar: {
    eyebrow: 'ADMIN V2',
    title: 'التحكم بالخطط V2',
    description: 'أصبحت الأسعار والأدوات المتضمنة تأتي من نفس القواعد الفعلية التي يطبقها Tayar. غيّر وصول الأدوات أو حدودها من Tools وستتحدث الخطط العامة تلقائيًا.',
    refresh: 'تحديث',
    save: 'حفظ كتالوج الخطط',
    saving: 'جارٍ الحفظ...',
    saved: 'تم حفظ كتالوج الخطط',
    loadError: 'تعذر تحميل كتالوج الخطط المباشر. يستخدم المحرر القيم الآمنة الافتراضية.',
    saveError: 'تعذر حفظ كتالوج الخطط.',
    visible: 'ظاهر في صفحة الأسعار',
    hidden: 'مخفي من صفحة الأسعار',
    featured: 'الخطة المميزة',
    descriptionLabel: 'الوصف العام',
    includedTools: 'الأدوات المتضمنة',
    noTools: 'لا توجد أدوات متاحة حاليًا لهذه الخطة.',
    manageTools: 'إدارة وصول الأدوات والحدود',
    unlimited: 'غير محدود',
    day: 'يومي',
    month: 'شهري',
    lifetime: 'مدى الحياة',
    language: 'لغة التعديل',
    source: 'مصدر الحقيقة: قواعد الأدوات في Admin + حدود الخطط الفعلية + سعر Stripe النشط.',
  },
  sv: {
    eyebrow: 'ADMIN V2',
    title: 'Plankontroll V2',
    description: 'Priser och inkluderade verktyg kommer nu från samma live-regler som Tayar faktiskt använder. Ändra verktygsåtkomst eller gränser i Tools så följer den publika plankatalogen automatiskt.',
    refresh: 'Uppdatera',
    save: 'Spara plankatalog',
    saving: 'Sparar...',
    saved: 'Plankatalogen sparades',
    loadError: 'Det gick inte att läsa livekatalogen. Editorn använder säkra standardvärden.',
    saveError: 'Det gick inte att spara plankatalogen.',
    visible: 'Visas på prissidan',
    hidden: 'Dold från prissidan',
    featured: 'Utvald plan',
    descriptionLabel: 'Publik beskrivning',
    includedTools: 'Inkluderade verktyg',
    noTools: 'Inga verktyg ingår för närvarande i den här planen.',
    manageTools: 'Hantera verktygsåtkomst och gränser',
    unlimited: 'Obegränsat',
    day: 'dag',
    month: 'månad',
    lifetime: 'livstid',
    language: 'Redigeringsspråk',
    source: 'Sanningskälla: Admins verktygsregler + livegränser för planer + aktivt Stripe-pris.',
  },
} as const;

function periodLabel(period: string, c: PeriodLabels): string {
  return period === 'daily' ? c.day : period === 'lifetime' ? c.lifetime : c.month;
}

export default function AdminPlansV2({ onOpenTools }: { onOpenTools: () => void }) {
  const { prefs } = usePreferences();
  const c = COPY[prefs.language];
  const [catalog, setCatalog] = useState<PlanAdminCatalogV2>(() => structuredClone(DEFAULT_PLAN_ADMIN_CATALOG_V2));
  const [liveCatalog, setLiveCatalog] = useState<PublicPlanCatalogV2 | null>(null);
  const [editLanguage, setEditLanguage] = useState<EditLanguage>(prefs.language);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<PlanId, boolean>>({ free: false, pro: false, business: false });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [settingRes, publicResult] = await Promise.all([
      supabase.from('admin_settings').select('value').eq('key', 'plan_catalog_v2').maybeSingle(),
      fetchPublicPlanCatalogV2().then(data => ({ data, error: null as Error | null })).catch(loadError => ({ data: null, error: loadError instanceof Error ? loadError : new Error(String(loadError)) })),
    ]);

    if (!settingRes.error && settingRes.data?.value) setCatalog(normalizePlanAdminCatalogV2(settingRes.data.value));
    else if (settingRes.error) setError(settingRes.error.message);

    if (publicResult.data) setLiveCatalog(publicResult.data);
    else if (!settingRes.error) setError(c.loadError);

    setLoading(false);
  }, [c.loadError]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setEditLanguage(prefs.language); }, [prefs.language]);

  const liveByPlan = useMemo(() => {
    const map = new Map<PlanId, PublicPlanCatalogV2['plans'][number]>();
    for (const plan of liveCatalog?.plans || []) map.set(plan.id, plan);
    return map;
  }, [liveCatalog]);

  function patchPlan(planId: PlanId, patch: Partial<PlanAdminCatalogV2['plans'][PlanId]>) {
    setCatalog(previous => ({
      ...previous,
      plans: {
        ...previous.plans,
        [planId]: { ...previous.plans[planId], ...patch },
      },
    }));
  }

  function toggleFeatured(planId: PlanId) {
    setCatalog(previous => {
      const next = structuredClone(previous);
      const shouldFeature = !next.plans[planId].featured;
      for (const id of PLAN_IDS) next.plans[id].featured = shouldFeature && id === planId;
      return next;
    });
  }

  function updateDescription(planId: PlanId, value: string) {
    const current = catalog.plans[planId];
    patchPlan(planId, { description: { ...current.description, [editLanguage]: value } });
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    setError(null);
    const payload = normalizePlanAdminCatalogV2(catalog);
    const { error: saveError } = await supabase.from('admin_settings').upsert({
      key: 'plan_catalog_v2',
      value: payload,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });

    if (saveError) {
      setError(saveError.message || c.saveError);
      setSaving(false);
      return;
    }

    setCatalog(payload);
    setMessage(c.saved);
    try { setLiveCatalog(await fetchPublicPlanCatalogV2()); } catch { /* saved config remains authoritative */ }
    setSaving(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center rounded-2xl border border-violet-500/15 bg-violet-500/[0.04] py-12"><Loader2 className="h-7 w-7 animate-spin text-violet-400" /></div>;
  }

  return (
    <section className="space-y-4 rounded-2xl border border-violet-500/20 bg-violet-500/[0.04] p-4 sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-300">{c.eyebrow}</div>
          <h2 className="mt-1 text-xl font-bold text-white">{c.title}</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-gray-400">{c.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => void load()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-gray-300 hover:bg-white/[0.06]"><RefreshCw className="h-4 w-4" />{c.refresh}</button>
          <button onClick={() => void save()} disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? c.saving : c.save}</button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/15 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-400"><CheckCircle2 className="h-4 w-4 text-emerald-400" /><span>{c.source}</span></div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-500">{c.language}</span>
          {EDIT_LANGUAGES.map(language => <button key={language} onClick={() => setEditLanguage(language)} className={`min-h-9 rounded-lg px-3 text-xs font-bold uppercase ${editLanguage === language ? 'bg-violet-600 text-white' : 'border border-white/10 bg-white/[0.03] text-gray-400'}`}>{language}</button>)}
        </div>
      </div>

      {error && <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3 text-sm text-amber-200">{error}</div>}
      {message && <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3 text-sm text-emerald-200">{message}</div>}

      <div className="grid gap-4 xl:grid-cols-3">
        {PLAN_IDS.map(planId => {
          const plan = catalog.plans[planId];
          const live = liveByPlan.get(planId);
          const tools = live?.tools || [];
          const shownTools = expanded[planId] ? tools : tools.slice(0, 6);
          return (
            <article key={planId} className={`min-w-0 rounded-2xl border p-4 ${plan.featured ? 'border-violet-400/30 bg-violet-500/[0.07]' : 'border-white/10 bg-white/[0.025]'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-bold text-white">{planDisplayName(planId)}</h3>{plan.featured && <Sparkles className="h-4 w-4 text-violet-300" />}</div>
                  <div className="mt-1 text-sm font-semibold text-emerald-300">{live ? formatPlanPrice(live.price, prefs.language) : planId === 'free' ? '$0' : '—'}</div>
                </div>
                <button onClick={() => patchPlan(planId, { visible: !plan.visible })} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${plan.visible ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-white/10 bg-white/[0.03] text-gray-500'}`} title={plan.visible ? c.visible : c.hidden}>{plan.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <button onClick={() => patchPlan(planId, { visible: !plan.visible })} className={`rounded-xl border p-2.5 text-left ${plan.visible ? 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-200' : 'border-white/10 bg-black/10 text-gray-500'}`}>{plan.visible ? c.visible : c.hidden}</button>
                <button onClick={() => toggleFeatured(planId)} className={`rounded-xl border p-2.5 text-left ${plan.featured ? 'border-violet-500/25 bg-violet-500/[0.08] text-violet-200' : 'border-white/10 bg-black/10 text-gray-500'}`}>{c.featured}</button>
              </div>

              <label className="mt-4 block">
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-gray-500">{c.descriptionLabel} · {editLanguage.toUpperCase()}</span>
                <textarea rows={4} value={plan.description[editLanguage]} onChange={event => updateDescription(planId, event.target.value)} className="w-full resize-none rounded-xl border border-white/10 bg-[#0d0d1a] px-3 py-2.5 text-sm leading-5 text-white outline-none focus:border-violet-500/50" />
              </label>

              <div className="mt-4 rounded-xl border border-white/10 bg-black/15 p-3">
                <div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold text-white">{c.includedTools}</span><span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-gray-400">{tools.length}</span></div>
                {shownTools.length === 0 ? <div className="mt-3 text-xs text-gray-500">{c.noTools}</div> : <div className="mt-3 space-y-2">{shownTools.map(tool => <div key={tool.id} className="flex items-center justify-between gap-2 text-xs"><span className="min-w-0 truncate text-gray-300">{tool.label}</span><span className="shrink-0 text-[10px] text-gray-500">{tool.limit == null ? c.unlimited : `${tool.limit}/${periodLabel(tool.period, c)}`}</span></div>)}</div>}
                {tools.length > 6 && <button onClick={() => setExpanded(previous => ({ ...previous, [planId]: !previous[planId] }))} className="mt-3 text-xs font-medium text-violet-300 hover:text-violet-200">{expanded[planId] ? '−' : '+'} {tools.length - 6}</button>}
              </div>
            </article>
          );
        })}
      </div>

      <button onClick={onOpenTools} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-medium text-gray-200 hover:bg-white/[0.06] sm:w-auto"><Wrench className="h-4 w-4" />{c.manageTools}</button>
    </section>
  );
}
