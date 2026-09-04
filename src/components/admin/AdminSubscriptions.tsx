import { useLocalizer } from '@/lib/ui-localization';
import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, TrendingUp, AlertCircle, CheckCircle, XCircle, Settings, ExternalLink, CreditCard, Webhook, Landmark } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { BarChart } from './Charts';

interface BillingStatus {
  connected: boolean;
  mode: 'live' | 'test' | 'unknown' | 'unconfigured';
  account: null | { id: string | null; name: string | null; country: string | null; defaultCurrency: string | null; chargesEnabled: boolean; payoutsEnabled: boolean; detailsSubmitted: boolean };
  plans: {
    pro: { configured: boolean; priceId: string | null; valid: boolean; currency?: string | null; unitAmount?: number | null; interval?: string | null; livemode?: boolean | null };
    business: { configured: boolean; priceId: string | null; valid: boolean; currency?: string | null; unitAmount?: number | null; interval?: string | null; livemode?: boolean | null };
  };
  webhook: { secretConfigured: boolean; endpointConfigured: boolean; endpointUrl: string | null; status?: string | null; receivesRequiredEvents?: boolean };
  checkoutReady: boolean;
  portalReady: boolean;
  modeMatchesPrices?: boolean;
}

interface SubRow {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  renewal_date: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
}

function isPaidPlan(plan: string) { return plan === 'pro' || plan === 'business'; }
function isLiveSubscriptionStatus(status: string) { return status === 'active' || status === 'trialing'; }
function rowDate(row: SubRow) { return row.current_period_end || row.renewal_date; }

export default function AdminSubscriptions() {
  const l = useLocalizer();
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [userLabels, setUserLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [section, setSection] = useState<'overview' | 'payments'>('overview');
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [billingStatusLoading, setBillingStatusLoading] = useState(false);
  const [billingStatusError, setBillingStatusError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const [subscriptionsRes, usersRes] = await Promise.all([
      supabase.from('subscriptions').select('id, user_id, plan, status, renewal_date, current_period_end, cancel_at_period_end, created_at').order('created_at', { ascending: false }),
      supabase.rpc('admin_list_users'),
    ]);
    const queryError = subscriptionsRes.error || usersRes.error;
    if (queryError) { setSubs([]); setUserLabels({}); setError(queryError.message || 'Failed to load subscriptions.'); }
    else {
      setSubs((subscriptionsRes.data || []) as SubRow[]);
      const labels: Record<string, string> = {};
      for (const adminUser of (usersRes.data || []) as { id: string; email?: string; full_name?: string }[]) labels[adminUser.id] = adminUser.email || adminUser.full_name || adminUser.id;
      setUserLabels(labels);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const loadBillingStatus = useCallback(async () => {
    setBillingStatusLoading(true); setBillingStatusError(null);
    const { data, error: statusError } = await supabase.functions.invoke('billing-admin-status', { body: {} });
    if (statusError) { setBillingStatus(null); setBillingStatusError(statusError.message || 'Could not load Stripe configuration.'); }
    else setBillingStatus(data as BillingStatus);
    setBillingStatusLoading(false);
  }, []);

  useEffect(() => { if (section === 'payments' && !billingStatus && !billingStatusLoading) void loadBillingStatus(); }, [section, billingStatus, billingStatusLoading, loadBillingStatus]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-violet-500" /></div>;
  if (error) return <div className="mx-auto max-w-xl rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-center sm:p-6"><AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-400" /><h2 className="mb-2 font-semibold text-white">{l('Could not load subscriptions')}</h2><p className="mb-4 break-words text-sm text-gray-400">{error}</p><button onClick={() => void load()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"><RefreshCw className="h-4 w-4" />{l('Retry')}</button></div>;

  const now = new Date();
  const planPrices: Record<string, number> = { pro: 19, business: 49, free: 0 };
  const activePaid = subs.filter(s => isPaidPlan(s.plan) && isLiveSubscriptionStatus(s.status));
  const revenue = activePaid.reduce((sum, s) => sum + (planPrices[s.plan] || 0), 0);
  const renewals = activePaid.filter(s => !s.cancel_at_period_end && rowDate(s) && new Date(rowDate(s) as string) > now);
  const scheduledCancellations = activePaid.filter(s => s.cancel_at_period_end && rowDate(s) && new Date(rowDate(s) as string) > now);
  const pastDue = subs.filter(s => isPaidPlan(s.plan) && s.status === 'past_due');
  const failed = subs.filter(s => isPaidPlan(s.plan) && ['unpaid', 'incomplete_expired'].includes(s.status));
  const currentRows = subs.filter(s => !['canceled', 'incomplete_expired'].includes(s.status));
  const byPlan = ['free', 'pro', 'business'].map(p => ({ label: p, value: currentRows.filter(s => s.plan === p).length }));
  const filtered = filter === 'all' ? subs : filter === 'active' ? activePaid : filter === 'past_due' ? pastDue : filter === 'failed' ? failed : filter === 'cancellations' ? scheduledCancellations : renewals;

  return (
    <div className="mx-auto max-w-7xl min-w-0 space-y-5 overflow-x-hidden">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <button onClick={() => setSection('overview')} className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${section === 'overview' ? 'border-violet-500/20 bg-violet-600/15 text-violet-300' : 'border-white/10 bg-white/[0.03] text-gray-400 hover:text-white'}`}>{l('Subscriptions Overview')}</button>
        <button onClick={() => setSection('payments')} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${section === 'payments' ? 'border-violet-500/20 bg-violet-600/15 text-violet-300' : 'border-white/10 bg-white/[0.03] text-gray-400 hover:text-white'}`}><Settings className="h-4 w-4" />{l('Payment Settings')}</button>
      </div>

      {section === 'payments' ? <PaymentSettings status={billingStatus} loading={billingStatusLoading} error={billingStatusError} onRefresh={() => void loadBillingStatus()} /> : <>
        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-6">
          {[
            { label: 'Est. MRR', value: `${revenue}`, icon: TrendingUp, color: 'emerald' },
            { label: 'Paid Active', value: activePaid.length, icon: CheckCircle, color: 'violet' },
            { label: 'Upcoming Renewals', value: renewals.length, icon: RefreshCw, color: 'blue' },
            { label: 'Scheduled Cancellations', value: scheduledCancellations.length, icon: XCircle, color: 'amber' },
            { label: 'Past Due / Grace', value: pastDue.length, icon: AlertCircle, color: 'blue' },
            { label: 'Failed Payments', value: failed.length, icon: AlertCircle, color: 'red' },
          ].map(s => {
            const colors: Record<string, string> = { emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', violet: 'bg-violet-500/10 text-violet-400 border-violet-500/20', blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20', amber: 'bg-amber-500/10 text-amber-300 border-amber-500/20', red: 'bg-red-500/10 text-red-400 border-red-500/20' };
            const Icon = s.icon;
            return <div key={s.label} className={`min-w-0 rounded-xl border p-3 sm:rounded-2xl sm:p-4 ${colors[s.color]}`}><Icon className="mb-2 h-5 w-5" /><div className="text-xl font-bold text-white sm:text-2xl">{s.value}</div><div className="break-words text-[11px] leading-4 text-gray-400 sm:text-xs">{l(s.label)}</div></div>;
          })}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 sm:p-5"><h3 className="mb-4 text-sm font-semibold text-white">{l('Current subscriptions by plan')}</h3><div className="min-w-0 overflow-hidden"><BarChart data={byPlan} color="#a78bfa" height={180} /></div></div>

        <div className="flex max-w-full gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {['all', 'active', 'past_due', 'renewals', 'cancellations', 'failed'].map(f => {
            const label = f === 'all' ? 'All' : f === 'active' ? 'Paid Active' : f === 'past_due' ? 'Past Due' : f === 'renewals' ? 'Renewals' : f === 'cancellations' ? 'Cancellations' : 'Failed';
            return <button key={f} onClick={() => setFilter(f)} className={`min-h-10 shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${filter === f ? 'bg-violet-600 text-white' : 'border border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'}`}>{l(label)}</button>;
          })}
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
          <div className="divide-y divide-white/5 sm:hidden">
            {filtered.map(s => {
              const live = isLiveSubscriptionStatus(s.status); const scheduled = live && s.cancel_at_period_end; const date = rowDate(s);
              const statusText = scheduled ? l('Active · cancels at period end') : s.status === 'past_due' ? l('past_due · 3-day grace') : l(s.status);
              const statusClass = scheduled ? 'text-amber-300' : live ? 'text-emerald-400' : s.status === 'past_due' ? 'text-amber-300' : 'text-red-400';
              return <div key={s.id} className="p-4"><div className="min-w-0"><div className="truncate text-sm font-medium text-white">{userLabels[s.user_id] || s.user_id}</div><div className="mt-0.5 text-[10px] font-mono text-gray-600">{s.user_id.slice(0, 8)}...</div></div><div className="mt-3 flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${s.plan === 'pro' ? 'bg-fuchsia-500/10 text-fuchsia-400' : s.plan === 'business' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-gray-500/10 text-gray-400'}`}>{l(s.plan)}</span><span className={`inline-flex items-center gap-1 text-xs font-medium ${statusClass}`}>{live && !scheduled ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}{statusText}</span></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div className="rounded-lg bg-white/[0.03] p-2.5"><div className="text-gray-600">{l(scheduled ? 'Access until' : 'Billing / Access Date')}</div><div className="mt-1 text-gray-300">{date ? new Date(date).toLocaleDateString() : '—'}</div></div><div className="rounded-lg bg-white/[0.03] p-2.5"><div className="text-gray-600">{l('Created')}</div><div className="mt-1 text-gray-300">{new Date(s.created_at).toLocaleDateString()}</div></div></div></div>;
            })}
          </div>
          <div className="hidden overflow-x-auto sm:block"><table className="w-full min-w-[760px]"><thead><tr className="border-b border-white/5"><th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">{l('User')}</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">{l('Plan')}</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">{l('Status')}</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">{l('Billing / Access Date')}</th><th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500 md:table-cell">{l('Created')}</th></tr></thead><tbody>{filtered.map(s => { const live = isLiveSubscriptionStatus(s.status); const scheduled = live && s.cancel_at_period_end; const date = rowDate(s); const statusText = scheduled ? l('Active · cancels at period end') : s.status === 'past_due' ? l('past_due · 3-day grace') : l(s.status); const statusClass = scheduled ? 'text-amber-300' : live ? 'text-emerald-400' : s.status === 'past_due' ? 'text-amber-300' : 'text-red-400'; return <tr key={s.id} className="border-b border-white/5 hover:bg-white/[0.02]"><td className="px-4 py-3"><div className="max-w-[260px] truncate text-sm text-gray-300">{userLabels[s.user_id] || s.user_id}</div><div className="text-[10px] font-mono text-gray-600">{s.user_id.slice(0, 8)}...</div></td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${s.plan === 'pro' ? 'bg-fuchsia-500/10 text-fuchsia-400' : s.plan === 'business' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-gray-500/10 text-gray-400'}`}>{l(s.plan)}</span></td><td className="px-4 py-3"><span className={`flex items-center gap-1 text-xs font-medium ${statusClass}`}>{live && !scheduled ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}{statusText}</span></td><td className="px-4 py-3 text-sm text-gray-400">{date ? <div><div>{new Date(date).toLocaleDateString()}</div>{isPaidPlan(s.plan) && live && <div className="text-[10px] text-gray-600">{l(scheduled ? 'Access until' : 'Renews on')}</div>}</div> : '—'}</td><td className="hidden px-4 py-3 text-sm text-gray-500 md:table-cell">{new Date(s.created_at).toLocaleDateString()}</td></tr>; })}</tbody></table></div>
          {filtered.length === 0 && <div className="py-8 text-center text-sm text-gray-500">{l('No subscriptions found')}</div>}
        </div>
      </>}
    </div>
  );
}

function PaymentSettings({ status, loading, error, onRefresh }: { status: BillingStatus | null; loading: boolean; error: string | null; onRefresh: () => void; }) {
  const l = useLocalizer();
  const StatusPill = ({ ok, label }: { ok: boolean; label: string }) => <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${ok ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/20 bg-amber-500/10 text-amber-300'}`}>{ok ? <CheckCircle className="h-3.5 w-3.5 shrink-0" /> : <AlertCircle className="h-3.5 w-3.5 shrink-0" />}<span className="break-words">{label}</span></span>;
  const priceLabel = (plan: BillingStatus['plans']['pro']) => plan.valid && plan.unitAmount != null && plan.currency ? `${(plan.unitAmount / 100).toLocaleString()} ${plan.currency.toUpperCase()}${plan.interval ? ` / ${plan.interval}` : ''}` : 'Not verified';
  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-violet-500" /></div>;
  if (error) return <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 sm:p-5"><div className="flex items-start gap-3"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" /><div className="min-w-0 flex-1"><h3 className="font-semibold text-white">{l('Stripe status unavailable')}</h3><p className="mt-1 break-words text-sm text-gray-400">{error}</p></div></div><button onClick={onRefresh} className="mt-4 min-h-11 w-full rounded-xl border border-white/10 px-3 py-2 text-sm text-gray-300 hover:bg-white/5 sm:w-auto">{l('Retry')}</button></div>;
  if (!status) return null;

  return <div className="min-w-0 space-y-4 sm:space-y-5">
    <div className="rounded-2xl border border-white/10 bg-[#0b0b18] p-4 sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex items-center gap-2"><CreditCard className="h-5 w-5 shrink-0 text-violet-400" /><h2 className="font-semibold text-white">{l('Stripe Connection')}</h2></div><p className="mt-1 break-words text-sm leading-5 text-gray-500">{l('Secrets stay server-side and are never exposed in this panel.')}</p></div><div className="flex flex-wrap items-center gap-2"><StatusPill ok={status.connected} label={status.connected ? l('Connected') : l('Not configured')} /><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase ${status.mode === 'live' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-blue-500/20 bg-blue-500/10 text-blue-300'}`}>{status.mode}</span></div></div>{status.account && <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{[[l('Stripe Account'), status.account.name || status.account.id || '—'], [l('Country / Currency'), `${status.account.country || '—'} / ${(status.account.defaultCurrency || '—').toUpperCase()}`]].map(([label,value]) => <div key={label} className="min-w-0 rounded-xl border border-white/10 bg-white/[0.02] p-3"><div className="text-xs text-gray-500">{label}</div><div className="mt-1 break-words text-sm text-white">{value}</div></div>)}<div className="rounded-xl border border-white/10 bg-white/[0.02] p-3"><div className="text-xs text-gray-500">{l('Charges')}</div><div className="mt-1"><StatusPill ok={status.account.chargesEnabled} label={status.account.chargesEnabled ? l('Enabled') : l('Needs attention')} /></div></div><div className="rounded-xl border border-white/10 bg-white/[0.02] p-3"><div className="text-xs text-gray-500">{l('Payouts')}</div><div className="mt-1"><StatusPill ok={status.account.payoutsEnabled} label={status.account.payoutsEnabled ? l('Enabled') : l('Needs attention')} /></div></div></div>}</div>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{(['pro','business'] as const).map(name => { const plan = status.plans[name]; return <div key={name} className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold capitalize text-white">{name}</h3><StatusPill ok={plan.valid} label={plan.valid ? l('Price verified') : l('Price missing / invalid')} /></div><div className="mt-4 space-y-3 text-sm"><div><div className="text-gray-500">{l('Price ID')}</div><div className="mt-1 break-all font-mono text-xs text-gray-300">{plan.priceId || '—'}</div></div><div className="flex flex-wrap justify-between gap-2"><span className="text-gray-500">{l('Stripe Price')}</span><span className="text-gray-300">{priceLabel(plan)}</span></div></div></div>; })}</div>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3"><div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5"><Webhook className="mb-3 h-5 w-5 text-cyan-400" /><div className="font-medium text-white">{l('Webhook')}</div><div className="mt-3 flex flex-wrap gap-2"><StatusPill ok={status.webhook.secretConfigured} label={status.webhook.secretConfigured ? l('Secret configured') : l('Secret missing')} /><StatusPill ok={status.webhook.endpointConfigured} label={status.webhook.endpointConfigured ? l('Endpoint found') : l('Endpoint missing')} /><StatusPill ok={status.webhook.receivesRequiredEvents === true} label={status.webhook.receivesRequiredEvents ? l('Events configured') : l('Events need review')} /></div>{status.webhook.endpointUrl && <div className="mt-3 break-all font-mono text-[10px] text-gray-600">{status.webhook.endpointUrl}</div>}</div><div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5"><CreditCard className="mb-3 h-5 w-5 text-fuchsia-400" /><div className="font-medium text-white">{l('Checkout & Portal')}</div><div className="mt-3 flex flex-wrap gap-2"><StatusPill ok={status.checkoutReady} label={status.checkoutReady ? l('Checkout ready') : l('Checkout needs setup')} /><StatusPill ok={status.portalReady} label={status.portalReady ? l('Billing Portal ready') : l('Portal needs setup')} /><StatusPill ok={status.modeMatchesPrices !== false} label={status.modeMatchesPrices !== false ? l('Mode matches prices') : l('Live/Test mismatch')} /></div></div><div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5"><Landmark className="mb-3 h-5 w-5 text-emerald-400" /><div className="font-medium text-white">{l('Payout Destination')}</div><p className="mt-2 text-xs leading-5 text-gray-500">{l('Bank accounts, payout schedule, identity and tax details are managed only inside Stripe.')}</p><button type="button" onClick={() => window.open('https://dashboard.stripe.com/', '_blank', 'noopener,noreferrer')} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-300 hover:bg-white/10 hover:text-white sm:w-auto"><ExternalLink className="h-4 w-4" />{l('Open Stripe Dashboard')}</button></div></div>
    <div className="flex justify-stretch sm:justify-end"><button onClick={onRefresh} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white sm:w-auto"><RefreshCw className="h-4 w-4" />{l('Refresh Stripe Status')}</button></div>
  </div>;
}
