import { useCallback, useEffect, useState } from 'react';
import { BrainCircuit, CreditCard, Loader2, Power, RefreshCw, Save, ShieldAlert } from 'lucide-react';
import { usePreferences } from '@/context/PreferencesContext';
import { supabase } from '@/lib/supabase';

interface OperationsConfig {
  version: 2;
  aiEnabled: boolean;
  checkoutEnabled: boolean;
}

const DEFAULT_CONFIG: OperationsConfig = {
  version: 2,
  aiEnabled: true,
  checkoutEnabled: true,
};

const COPY = {
  en: {
    eyebrow: 'ADMIN V2',
    title: 'Operations & Kill Switches',
    description: 'Emergency runtime controls. Turning a service off blocks new requests immediately without a code change or deployment.',
    ai: 'AI runtime',
    aiDesc: 'Blocks new AI text and image requests that pass through the central AI access guard.',
    checkout: 'Stripe checkout',
    checkoutDesc: 'Blocks creation of new Pro and Business checkout sessions. Existing subscriptions and the billing portal are not changed.',
    enabled: 'Enabled',
    disabled: 'Stopped',
    save: 'Save runtime controls',
    saving: 'Saving...',
    refresh: 'Refresh',
    warning: 'These switches affect production behavior. Use them for incidents, provider outages or billing maintenance.',
    saved: 'Runtime controls saved.',
    loadError: 'Could not load runtime controls.',
    saveError: 'Could not save runtime controls.',
  },
  ar: {
    eyebrow: 'ADMIN V2',
    title: 'التشغيل ومفاتيح الإيقاف',
    description: 'تحكم طارئ في وقت التشغيل. إيقاف خدمة يمنع الطلبات الجديدة فورًا بدون تعديل كود أو نشر جديد.',
    ai: 'تشغيل الذكاء الاصطناعي',
    aiDesc: 'يوقف طلبات النصوص والصور الجديدة التي تمر عبر حارس الوصول المركزي للذكاء الاصطناعي.',
    checkout: 'دفع Stripe',
    checkoutDesc: 'يوقف إنشاء جلسات دفع جديدة لخطة Pro وBusiness. الاشتراكات الحالية وبوابة الفوترة لا تتغير.',
    enabled: 'مفعّل',
    disabled: 'متوقف',
    save: 'حفظ تحكم التشغيل',
    saving: 'جارٍ الحفظ...',
    refresh: 'تحديث',
    warning: 'هذه المفاتيح تؤثر مباشرة على الإنتاج. استخدمها عند الأعطال أو توقف المزود أو صيانة الدفع.',
    saved: 'تم حفظ تحكم التشغيل.',
    loadError: 'تعذر تحميل تحكم التشغيل.',
    saveError: 'تعذر حفظ تحكم التشغيل.',
  },
  sv: {
    eyebrow: 'ADMIN V2',
    title: 'Drift & nödstopp',
    description: 'Akuta runtime-kontroller. När en tjänst stängs av blockeras nya anrop direkt utan kodändring eller ny driftsättning.',
    ai: 'AI-runtime',
    aiDesc: 'Blockerar nya AI-text- och bildanrop som går genom den centrala AI-åtkomstkontrollen.',
    checkout: 'Stripe checkout',
    checkoutDesc: 'Blockerar nya checkout-sessioner för Pro och Business. Befintliga abonnemang och billing portal ändras inte.',
    enabled: 'Aktiverad',
    disabled: 'Stoppad',
    save: 'Spara runtime-kontroller',
    saving: 'Sparar...',
    refresh: 'Uppdatera',
    warning: 'Dessa reglage påverkar produktion direkt. Använd dem vid incidenter, leverantörsavbrott eller betalningsunderhåll.',
    saved: 'Runtime-kontroller sparades.',
    loadError: 'Det gick inte att läsa runtime-kontrollerna.',
    saveError: 'Det gick inte att spara runtime-kontrollerna.',
  },
} as const;

function normalizeConfig(value: unknown): OperationsConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return DEFAULT_CONFIG;
  const source = value as Record<string, unknown>;
  return {
    version: 2,
    aiEnabled: source.aiEnabled !== false,
    checkoutEnabled: source.checkoutEnabled !== false,
  };
}

export default function AdminOperationsV2() {
  const { prefs } = usePreferences();
  const c = COPY[prefs.language];
  const [config, setConfig] = useState<OperationsConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    const { data, error: loadError } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'operations_v2')
      .maybeSingle();
    if (loadError) setError(loadError.message || c.loadError);
    else setConfig(normalizeConfig(data?.value));
    setLoading(false);
  }, [c.loadError]);

  useEffect(() => { void load(); }, [load]);

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    const cleaned: OperationsConfig = {
      version: 2,
      aiEnabled: Boolean(config.aiEnabled),
      checkoutEnabled: Boolean(config.checkoutEnabled),
    };
    const { error: saveError } = await supabase
      .from('admin_settings')
      .upsert({ key: 'operations_v2', value: cleaned, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    setSaving(false);
    if (saveError) { setError(saveError.message || c.saveError); return; }
    setConfig(cleaned);
    setMessage(c.saved);
  }

  if (loading) {
    return <div className="flex items-center justify-center rounded-2xl border border-red-500/15 bg-red-500/[0.03] py-12"><Loader2 className="h-7 w-7 animate-spin text-red-300" /></div>;
  }

  const controls = [
    { key: 'aiEnabled' as const, title: c.ai, description: c.aiDesc, icon: BrainCircuit },
    { key: 'checkoutEnabled' as const, title: c.checkout, description: c.checkoutDesc, icon: CreditCard },
  ];

  return (
    <section className="space-y-4 rounded-2xl border border-red-500/20 bg-red-500/[0.035] p-4 sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-300">{c.eyebrow}</div>
          <div className="mt-1 flex items-center gap-2"><Power className="h-5 w-5 text-red-300" /><h2 className="text-xl font-bold text-white">{c.title}</h2></div>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-gray-400">{c.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => void load()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-gray-300 hover:bg-white/[0.06]"><RefreshCw className="h-4 w-4" />{c.refresh}</button>
          <button onClick={() => void save()} disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? c.saving : c.save}</button>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3 text-xs leading-5 text-amber-100"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" /><span>{c.warning}</span></div>
      {error && <div className="rounded-xl border border-red-500/20 bg-red-500/[0.08] p-3 text-sm text-red-100">{error}</div>}
      {message && <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3 text-sm text-emerald-200">{message}</div>}

      <div className="grid gap-3 md:grid-cols-2">
        {controls.map(({ key, title, description, icon: Icon }) => {
          const enabled = config[key];
          return (
            <article key={key} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${enabled ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-red-500/20 bg-red-500/10'}`}><Icon className={`h-5 w-5 ${enabled ? 'text-emerald-300' : 'text-red-300'}`} /></div>
                  <div className="min-w-0"><h3 className="font-semibold text-white">{title}</h3><p className="mt-1 text-xs leading-5 text-gray-400">{description}</p></div>
                </div>
                <button
                  type="button"
                  onClick={() => setConfig(previous => ({ ...previous, [key]: !previous[key] }))}
                  aria-pressed={enabled}
                  className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${enabled ? 'border-emerald-400/30 bg-emerald-500/30' : 'border-red-400/30 bg-red-500/20'}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
              <div className={`mt-4 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${enabled ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>{enabled ? c.enabled : c.disabled}</div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
