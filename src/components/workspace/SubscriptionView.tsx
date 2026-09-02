import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, CreditCard, ExternalLink, Loader2, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { PageShell } from './PageShell';
import { useAuth } from '@/context/AuthContext';
import { useAdmin } from '@/context/AdminContext';
import { useLocalizer } from '@/lib/ui-localization';
import { supabase } from '@/lib/supabase';

interface SubscriptionRow {
  plan: string;
  status: string;
  renewal_date?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean | null;
  stripe_customer_id?: string | null;
}

const plans = [
  {
    id: 'free',
    name: 'Free',
    description: 'Start with a small Website Builder project and core AI tools.',
    features: ['1 website project', 'Up to 3 pages per website', 'Core AI tools', 'Local project saving'],
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Higher limits for individual creators and professionals.',
    features: ['Up to 10 website projects', 'Up to 25 pages per website', 'Publishing and release history', 'Analytics, leads and multilingual pages'],
  },
  {
    id: 'business',
    name: 'Business',
    description: 'Expanded limits and collaboration for growing teams.',
    features: ['Up to 50 website projects', 'Up to 100 pages per website', 'Team workspace and client handoff', 'Advanced production features and white-label support'],
  },
] as const;

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}

export default function SubscriptionView() {
  const { user, profile } = useAuth();
  const { isAdmin } = useAdmin();
  const l = useLocalizer();
  const userId = user?.id;
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'pro' | 'business' | 'portal' | null>(null);
  const [error, setError] = useState('');

  const activePlan = isAdmin ? 'business' : (subscription?.plan || profile?.plan || 'free').toLowerCase();
  const statusLabel = isAdmin ? 'admin access' : (subscription?.status || (activePlan === 'free' ? 'active' : 'unknown'));
  const periodEnd = isAdmin ? null : (subscription?.current_period_end || subscription?.renewal_date || null);

  const hasManagedSubscription = useMemo(
    () => Boolean(subscription?.stripe_customer_id && ['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused'].includes(subscription?.status || '')),
    [subscription],
  );

  const loadSubscription = useCallback(async () => {
    if (!userId) {
      setSubscription(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const { data, error: queryError } = await supabase
      .from('subscriptions')
      .select('plan, status, renewal_date, current_period_end, cancel_at_period_end, stripe_customer_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (queryError) setError(l('Could not load subscription details.'));
    setSubscription((data as SubscriptionRow | null) ?? null);
    setLoading(false);
  }, [l, userId]);

  useEffect(() => {
    void loadSubscription();
  }, [loadSubscription]);

  async function startCheckout(plan: 'pro' | 'business') {
    if (hasManagedSubscription) {
      await openPortal();
      return;
    }
    setBusy(plan);
    setError('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('create-checkout-session', { body: { plan } });
      if (invokeError) throw invokeError;
      const url = typeof data?.url === 'string' ? data.url : '';
      if (!url) throw new Error(data?.error || 'Stripe Checkout is not configured yet.');
      window.location.assign(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : l('Could not open Stripe Checkout.'));
      setBusy(null);
    }
  }

  async function openPortal() {
    setBusy('portal');
    setError('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('billing-portal', { body: {} });
      if (invokeError) throw invokeError;
      const url = typeof data?.url === 'string' ? data.url : '';
      if (!url) throw new Error(data?.error || 'Billing portal is not available yet.');
      window.location.assign(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : l('Could not open the billing portal.'));
      setBusy(null);
    }
  }

  return (
    <PageShell icon={CreditCard} title={l('Subscription')} subtitle={l('Manage your plan, limits and Stripe billing from one place.')}> 
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-1 text-xs uppercase tracking-wide text-gray-500">{l('Current plan')}</div>
          <div className="text-lg font-bold capitalize text-white">{l(activePlan)}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-1 text-xs uppercase tracking-wide text-gray-500">{l('Status')}</div>
          <div className="text-lg font-bold capitalize text-white">{loading ? l('Loading...') : l(statusLabel)}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-1 text-xs uppercase tracking-wide text-gray-500">{l('Next billing date')}</div>
          <div className="text-lg font-bold text-white">{loading ? '—' : isAdmin ? l('Not required') : formatDate(periodEnd)}</div>
        </div>
      </div>

      {subscription?.cancel_at_period_end && (
        <div className="mb-5 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {l('Your subscription is scheduled to cancel at the end of the current billing period.')}
        </div>
      )}

      {error && <div className="mb-5 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map(plan => {
          const current = activePlan === plan.id;
          return (
            <div key={plan.id} className={`rounded-2xl border p-5 ${current ? 'border-violet-400/40 bg-violet-500/[0.08]' : 'border-white/10 bg-white/[0.02]'}`}>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white">{l(plan.name)}</h2>
                    {current && <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-200">{l('Current')}</span>}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-gray-500">{l(plan.description)}</p>
                </div>
                {plan.id === 'business' ? <ShieldCheck className="h-5 w-5 text-violet-300" /> : <Sparkles className="h-5 w-5 text-violet-300" />}
              </div>

              <div className="space-y-2.5">
                {plan.features.map(feature => (
                  <div key={feature} className="flex items-start gap-2 text-xs leading-5 text-gray-300">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    <span>{l(feature)}</span>
                  </div>
                ))}
              </div>

              <div className="mt-5">
                {isAdmin ? (
                  <div className={`rounded-xl border px-3 py-2.5 text-center text-xs font-semibold ${current ? 'border-violet-400/30 bg-violet-500/10 text-violet-200' : 'border-white/10 text-gray-500'}`}>
                    {current ? l('Admin · Business access') : l('Included with admin access')}
                  </div>
                ) : plan.id === 'free' ? (
                  <div className="rounded-xl border border-white/10 px-3 py-2.5 text-center text-xs font-semibold text-gray-400">{current ? l('Your current plan') : l('Free plan')}</div>
                ) : current || hasManagedSubscription ? (
                  <button onClick={() => void openPortal()} disabled={busy !== null} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-white/15 disabled:opacity-60">
                    {busy === 'portal' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                    {l('Manage in Stripe')}
                  </button>
                ) : (
                  <button onClick={() => void startCheckout(plan.id)} disabled={busy !== null} className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60">
                    {busy === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                    {l('Choose {plan}').replace('{plan}', l(plan.name))}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
        <p className="text-xs leading-5 text-gray-500">{l('Billing changes are completed securely through Stripe. Your plan badge is synchronized by the billing backend.')}</p>
        <button onClick={() => void loadSubscription()} disabled={loading} className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-gray-300 transition hover:bg-white/5 disabled:opacity-60">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          {l('Refresh')}
        </button>
      </div>
    </PageShell>
  );
}
