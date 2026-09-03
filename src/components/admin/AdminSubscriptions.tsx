import { useLocalizer } from '@/lib/ui-localization';
import { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, TrendingUp, AlertCircle, CheckCircle, XCircle, Settings, ExternalLink, CreditCard, Webhook, Landmark } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { BarChart } from './Charts';

interface BillingStatus {
  connected: boolean;
  mode: 'live' | 'test' | 'unknown' | 'unconfigured';
  account: null | {
    id: string | null;
    name: string | null;
    country: string | null;
    defaultCurrency: string | null;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
  };
  plans: {
    pro: { configured: boolean; priceId: string | null; valid: boolean; currency?: string | null; unitAmount?: number | null; interval?: string | null; livemode?: boolean | null };
    business: { configured: boolean; priceId: string | null; valid: boolean; currency?: string | null; unitAmount?: number | null; interval?: string | null; livemode?: boolean | null };
  };
  webhook: {
    secretConfigured: boolean;
    endpointConfigured: boolean;
    endpointUrl: string | null;
    status?: string | null;
    receivesRequiredEvents?: boolean;
  };
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
  created_at: string;
}

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
    setLoading(true);
    setError(null);
    const [subscriptionsRes, usersRes] = await Promise.all([
      supabase
        .from('subscriptions')
        .select('id, user_id, plan, status, renewal_date, created_at')
        .order('created_at', { ascending: false }),
      supabase.rpc('admin_list_users'),
    ]);

    const queryError = subscriptionsRes.error || usersRes.error;
    if (queryError) {
      console.error('Failed to load admin subscriptions:', queryError);
      setSubs([]);
      setUserLabels({});
      setError(queryError.message || 'Failed to load subscriptions.');
    } else {
      setSubs((subscriptionsRes.data || []) as SubRow[]);
      const labels: Record<string, string> = {};
      for (const adminUser of (usersRes.data || []) as { id: string; email?: string; full_name?: string }[]) {
        labels[adminUser.id] = adminUser.email || adminUser.full_name || adminUser.id;
      }
      setUserLabels(labels);
    }

    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const loadBillingStatus = useCallback(async () => {
    setBillingStatusLoading(true);
    setBillingStatusError(null);
    const { data, error: statusError } = await supabase.functions.invoke('billing-admin-status', { body: {} });
    if (statusError) {
      setBillingStatus(null);
      setBillingStatusError(statusError.message || 'Could not load Stripe configuration.');
    } else {
      setBillingStatus(data as BillingStatus);
    }
    setBillingStatusLoading(false);
  }, []);

  useEffect(() => {
    if (section === 'payments' && !billingStatus && !billingStatusLoading) {
      void loadBillingStatus();
    }
  }, [section, billingStatus, billingStatusLoading, loadBillingStatus]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-violet-500 animate-spin" /></div>;
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
        <h2 className="text-white font-semibold mb-2">{l('Could not load subscriptions')}</h2>
        <p className="text-sm text-gray-400 mb-4">{error}</p>
        <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500">
          <RefreshCw className="w-4 h-4" /> {l('Retry')}
        </button>
      </div>
    );
  }

  const planPrices: Record<string, number> = { pro: 19, business: 49, free: 0 };
  const active = subs.filter(s => s.status === 'active' || s.status === 'trialing');
  const revenue = active.reduce((sum, s) => sum + (planPrices[s.plan] || 0), 0);
  const renewals = active.filter(s => s.renewal_date && new Date(s.renewal_date) > new Date());
  const failed = subs.filter(s => ['expired', 'canceled', 'unpaid'].includes(s.status));
  const pastDue = subs.filter(s => s.status === 'past_due');

  const byPlan = ['free', 'pro', 'business'].map(p => ({
    label: p, value: subs.filter(s => s.plan === p).length,
  }));

  const filtered = filter === 'all' ? subs : filter === 'active' ? active : filter === 'past_due' ? pastDue : filter === 'failed' ? failed : renewals;

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSection('overview')}
          className={`px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${section === 'overview' ? 'bg-violet-600/15 text-violet-300 border-violet-500/20' : 'bg-white/[0.03] text-gray-400 border-white/10 hover:text-white'}`}
        >
          {l('Subscriptions Overview')}
        </button>
        <button
          onClick={() => setSection('payments')}
          className={`px-3 py-2 rounded-xl text-sm font-medium border transition-colors flex items-center gap-2 ${section === 'payments' ? 'bg-violet-600/15 text-violet-300 border-violet-500/20' : 'bg-white/[0.03] text-gray-400 border-white/10 hover:text-white'}`}
        >
          <Settings className="w-4 h-4" /> {l('Payment Settings')}
        </button>
      </div>

      {section === 'payments' ? (
        <PaymentSettings
          status={billingStatus}
          loading={billingStatusLoading}
          error={billingStatusError}
          onRefresh={() => void loadBillingStatus()}
        />
      ) : <>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Est. MRR', value: `${revenue}`, icon: TrendingUp, color: 'emerald' },
          { label: 'Active Subs', value: active.length, icon: CheckCircle, color: 'violet' },
          { label: 'Upcoming Renewals', value: renewals.length, icon: RefreshCw, color: 'blue' },
          { label: 'Past Due / Grace', value: pastDue.length, icon: AlertCircle, color: 'blue' },
          { label: 'Failed Payments', value: failed.length, icon: AlertCircle, color: 'red' },
        ].map(s => {
          const colors: Record<string, string> = {
            emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            violet: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
            blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
            red: 'bg-red-500/10 text-red-400 border-red-500/20',
          };
          const Icon = s.icon;
          return (
            <div key={l(s.label)} className={`rounded-2xl border p-4 ${colors[s.color]}`}>
              <Icon className="w-5 h-5 mb-2" />
              <div className="text-2xl font-bold text-white">{s.value}</div>
              <div className="text-xs text-gray-400">{l(s.label)}</div>
            </div>
          );
        })}
      </div>

      <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5">
        <h3 className="text-white font-semibold text-sm mb-4">{l('Subscriptions by Plan')}</h3>
        <BarChart data={byPlan} color="#a78bfa" height={180} />
      </div>

      <div className="flex gap-2 flex-wrap">
        {['all', 'active', 'past_due', 'renewals', 'failed'].map(f => (
          <button
            key={l(f === 'all' ? 'All' : f === 'active' ? 'Active' : f === 'past_due' ? 'Past Due' : f === 'renewals' ? 'Renewals' : 'Failed')}
            onClick={() => setFilter(f)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full capitalize transition-colors ${
              filter === f ? 'bg-violet-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
            }`}
          >
            {l(f === 'all' ? 'All' : f === 'active' ? 'Active' : f === 'past_due' ? 'Past Due' : f === 'renewals' ? 'Renewals' : 'Failed')}
          </button>
        ))}
      </div>

      <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">{l('User')}</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">{l('Plan')}</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">{l('Status')}</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden sm:table-cell">{l('Renewal Date')}</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden md:table-cell">{l('Created')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <div className="max-w-[260px] truncate text-sm text-gray-300">{userLabels[s.user_id] || s.user_id}</div>
                    <div className="text-[10px] font-mono text-gray-600">{s.user_id.slice(0, 8)}...</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      s.plan === 'pro' ? 'bg-fuchsia-500/10 text-fuchsia-400' :
                      s.plan === 'business' ? 'bg-cyan-500/10 text-cyan-400' :
                      'bg-gray-500/10 text-gray-400'
                    }`}>{l(s.plan)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`flex items-center gap-1 text-xs font-medium ${
                      s.status === 'active' || s.status === 'trialing' ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {s.status === 'active' || s.status === 'trialing' ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      {s.status === 'past_due' ? l('past_due · 3-day grace') : l(s.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400 hidden sm:table-cell">
                    {s.renewal_date ? new Date(s.renewal_date).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">
                    {new Date(s.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="py-8 text-center text-gray-500 text-sm">{l('No subscriptions found')}</div>}
      </div>
      </>}
    </div>
  );
}

function PaymentSettings({ status, loading, error, onRefresh }: {
  status: BillingStatus | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  const l = useLocalizer();

  const StatusPill = ({ ok, label }: { ok: boolean; label: string }) => (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${ok ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'}`}>
      {ok ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
      {label}
    </span>
  );

  const priceLabel = (plan: BillingStatus['plans']['pro']) => {
    if (!plan.valid || plan.unitAmount == null || !plan.currency) return 'Not verified';
    const amount = plan.unitAmount / 100;
    return `${amount.toLocaleString()} ${plan.currency.toUpperCase()}${plan.interval ? ` / ${plan.interval}` : ''}`;
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-7 h-7 text-violet-500 animate-spin" /></div>;
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-white font-semibold">{l('Stripe status unavailable')}</h3>
            <p className="text-sm text-gray-400 mt-1">{error}</p>
          </div>
          <button onClick={onRefresh} className="px-3 py-2 rounded-xl border border-white/10 text-sm text-gray-300 hover:bg-white/5">{l('Retry')}</button>
        </div>
      </div>
    );
  }

  if (!status) return null;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/10 bg-[#0b0b18] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-violet-400" />
              <h2 className="text-white font-semibold">{l('Stripe Connection')}</h2>
            </div>
            <p className="text-sm text-gray-500 mt-1">{l('Secrets stay server-side and are never exposed in this panel.')}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill ok={status.connected} label={status.connected ? l('Connected') : l('Not configured')} />
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase border ${status.mode === 'live' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-blue-500/10 text-blue-300 border-blue-500/20'}`}>
              {status.mode}
            </span>
          </div>
        </div>

        {status.account && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <div className="text-xs text-gray-500">{l('Stripe Account')}</div>
              <div className="text-sm text-white mt-1">{status.account.name || status.account.id || '—'}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <div className="text-xs text-gray-500">{l('Country / Currency')}</div>
              <div className="text-sm text-white mt-1">{status.account.country || '—'} / {(status.account.defaultCurrency || '—').toUpperCase()}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <div className="text-xs text-gray-500">{l('Charges')}</div>
              <div className="mt-1"><StatusPill ok={status.account.chargesEnabled} label={status.account.chargesEnabled ? l('Enabled') : l('Needs attention')} /></div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <div className="text-xs text-gray-500">{l('Payouts')}</div>
              <div className="mt-1"><StatusPill ok={status.account.payoutsEnabled} label={status.account.payoutsEnabled ? l('Enabled') : l('Needs attention')} /></div>
            </div>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {(['pro', 'business'] as const).map((name) => {
          const plan = status.plans[name];
          return (
            <div key={name} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-white font-semibold capitalize">{name}</h3>
                <StatusPill ok={plan.valid} label={plan.valid ? l('Price verified') : l('Price missing / invalid')} />
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-4"><span className="text-gray-500">{l('Price ID')}</span><span className="font-mono text-gray-300 break-all text-right">{plan.priceId || '—'}</span></div>
                <div className="flex justify-between gap-4"><span className="text-gray-500">{l('Stripe Price')}</span><span className="text-gray-300">{priceLabel(plan)}</span></div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <Webhook className="w-5 h-5 text-cyan-400 mb-3" />
          <div className="text-white font-medium">{l('Webhook')}</div>
          <div className="mt-3 space-y-2">
            <StatusPill ok={status.webhook.secretConfigured} label={status.webhook.secretConfigured ? l('Secret configured') : l('Secret missing')} />
            <StatusPill ok={status.webhook.endpointConfigured} label={status.webhook.endpointConfigured ? l('Endpoint found') : l('Endpoint missing')} />
            <StatusPill ok={status.webhook.receivesRequiredEvents === true} label={status.webhook.receivesRequiredEvents ? l('Events configured') : l('Events need review')} />
          </div>
          {status.webhook.endpointUrl && <div className="text-[10px] font-mono text-gray-600 break-all mt-3">{status.webhook.endpointUrl}</div>}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <CreditCard className="w-5 h-5 text-fuchsia-400 mb-3" />
          <div className="text-white font-medium">{l('Checkout & Portal')}</div>
          <div className="mt-3 space-y-2">
            <StatusPill ok={status.checkoutReady} label={status.checkoutReady ? l('Checkout ready') : l('Checkout needs setup')} />
            <StatusPill ok={status.portalReady} label={status.portalReady ? l('Billing Portal ready') : l('Portal needs setup')} />
            <StatusPill ok={status.modeMatchesPrices !== false} label={status.modeMatchesPrices !== false ? l('Mode matches prices') : l('Live/Test mismatch')} />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <Landmark className="w-5 h-5 text-emerald-400 mb-3" />
          <div className="text-white font-medium">{l('Payout Destination')}</div>
          <p className="text-xs text-gray-500 mt-2">{l('Bank accounts, payout schedule, identity and tax details are managed only inside Stripe.')}</p>
          <button
            type="button"
            onClick={() => window.open('https://dashboard.stripe.com/', '_blank', 'noopener,noreferrer')}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10"
          >
            <ExternalLink className="w-4 h-4" /> {l('Open Stripe Dashboard')}
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={onRefresh} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5">
          <RefreshCw className="w-4 h-4" /> {l('Refresh Stripe Status')}
        </button>
      </div>
    </div>
  );
}
