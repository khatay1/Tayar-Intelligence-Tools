import { useCallback, useEffect, useState } from 'react';
import { Bot, CheckCircle2, CreditCard, ExternalLink, Loader2, RefreshCw, ServerCog, ShieldCheck, Tag, XCircle } from 'lucide-react';
import { useLocalizer } from '@/lib/ui-localization';
import { supabase } from '@/lib/supabase';
import type { AdminView } from './AdminLayout';

type ProviderRow = { provider_key: string; label: string; enabled: boolean; is_default: boolean; secret_configured: boolean; adapter: string; default_model: string };
type BillingStatus = {
  connected?: boolean;
  mode?: string;
  checkoutReady?: boolean;
  portalReady?: boolean;
  plans?: {
    pro?: { valid?: boolean; unitAmount?: number | null; currency?: string | null };
    business?: { valid?: boolean; unitAmount?: number | null; currency?: string | null };
  };
};

function money(amount?: number | null, currency?: string | null) {
  if (amount == null || !currency) return '—';
  return `${(amount / 100).toLocaleString()} ${currency.toUpperCase()}`;
}

export default function AdminConfigurationCenter({ onNavigate }: { onNavigate: (view: AdminView) => void }) {
  const l = useLocalizer();
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const [providerRes, billingRes] = await Promise.all([
      supabase.functions.invoke('ai-admin-control', { body: { action: 'list' } }),
      supabase.functions.invoke('billing-admin-status', { body: {} }),
    ]);
    const messages = [providerRes.error?.message, billingRes.error?.message].filter(Boolean);
    if (messages.length) setError(messages.join(' · '));
    setProviders((providerRes.data?.providers || []) as ProviderRow[]);
    setBilling((billingRes.data || null) as BillingStatus | null);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-violet-500" /></div>;

  const defaultProvider = providers.find((provider) => provider.is_default);
  const enabledProviders = providers.filter((provider) => provider.enabled).length;
  const stripeReady = Boolean(billing?.connected && billing?.checkoutReady && billing?.portalReady && billing?.plans?.pro?.valid && billing?.plans?.business?.valid);

  return <div className="mx-auto max-w-7xl space-y-5">
    <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.05] p-4 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div><div className="flex items-center gap-2"><ServerCog className="h-5 w-5 text-violet-300" /><h2 className="text-lg font-semibold text-white">{l('Configuration Center')}</h2></div><p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">{l('Manage AI providers, Stripe prices and coupons from the Admin Panel without editing application code. API secrets remain server-side and are never shown back in the browser.')}</p></div>
        <button onClick={() => void load()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/5"><RefreshCw className="h-4 w-4" />{l('Refresh status')}</button>
      </div>
      {error && <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">{error}</div>}
    </div>

    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="rounded-xl border border-violet-500/20 bg-violet-500/10 p-2.5"><Bot className="h-5 w-5 text-violet-300" /></div><div><h3 className="font-semibold text-white">{l('AI Providers')}</h3><p className="text-xs text-gray-500">{l('Add, test, enable and choose the default provider')}</p></div></div>{defaultProvider ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <XCircle className="h-5 w-5 text-amber-400" />}</div>
        <div className="mt-5 grid grid-cols-2 gap-3"><Stat label="Enabled" value={String(enabledProviders)} /><Stat label="Default" value={defaultProvider?.label || l('Gemini fallback')} /></div>
        {defaultProvider && <div className="mt-3 rounded-xl border border-white/5 bg-black/20 p-3 text-xs text-gray-400"><div className="truncate"><span className="text-gray-500">{l('Model')}:</span> {defaultProvider.default_model}</div><div className="mt-1"><span className="text-gray-500">{l('Secret')}:</span> {defaultProvider.secret_configured ? l('Configured securely') : l('Missing')}</div></div>}
        <button onClick={() => onNavigate('ai')} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500">{l('Manage AI Providers')}<ExternalLink className="h-4 w-4" /></button>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5"><CreditCard className="h-5 w-5 text-emerald-300" /></div><div><h3 className="font-semibold text-white">{l('Payments & Pricing')}</h3><p className="text-xs text-gray-500">{l('Manage Stripe prices and promotion codes')}</p></div></div>{stripeReady ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <XCircle className="h-5 w-5 text-amber-400" />}</div>
        <div className="mt-5 grid grid-cols-2 gap-3"><Stat label="Pro" value={money(billing?.plans?.pro?.unitAmount, billing?.plans?.pro?.currency)} /><Stat label="Business" value={money(billing?.plans?.business?.unitAmount, billing?.plans?.business?.currency)} /></div>
        <div className="mt-3 rounded-xl border border-white/5 bg-black/20 p-3 text-xs text-gray-400"><div><span className="text-gray-500">{l('Stripe')}:</span> {billing?.connected ? `${l('Connected')} · ${billing?.mode || 'unknown'}` : l('Not connected')}</div><div className="mt-1"><span className="text-gray-500">{l('Checkout / Portal')}:</span> {billing?.checkoutReady && billing?.portalReady ? l('Ready') : l('Needs attention')}</div></div>
        <button onClick={() => onNavigate('subscriptions')} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">{l('Manage Prices & Coupons')}<Tag className="h-4 w-4" /></button>
      </section>
    </div>

    <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.05] p-4 text-sm text-gray-300"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-300" /><p className="leading-6">{l('Safe operating model: adding a compatible AI provider or changing the active Stripe price is done from Admin. Existing subscribers keep their historical Stripe price unless you explicitly migrate them later.')}</p></div></div>
  </div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-xl border border-white/5 bg-white/[0.03] p-3"><div className="truncate text-lg font-semibold text-white">{value}</div><div className="mt-1 text-[11px] uppercase tracking-wide text-gray-500">{label}</div></div>;
}
