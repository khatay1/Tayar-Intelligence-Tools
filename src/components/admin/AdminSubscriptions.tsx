import { useLocalizer } from '@/lib/ui-localization';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, CheckCircle, CreditCard, ExternalLink, Landmark, Loader2,
  RefreshCw, Settings, Tag, TrendingUp, Webhook, XCircle,
} from 'lucide-react';
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

interface AdminUserRow {
  id: string;
  email?: string;
  full_name?: string;
  role?: string;
}

interface PromotionCode {
  id: string;
  code?: string;
  active?: boolean;
  max_redemptions?: number | null;
  times_redeemed?: number;
  expires_at?: number | null;
  coupon?: {
    id?: string;
    name?: string | null;
    percent_off?: number | null;
    amount_off?: number | null;
    currency?: string | null;
    duration?: string | null;
  } | null;
}

function isPaidPlan(plan: string) { return plan === 'pro' || plan === 'business'; }
function isLiveSubscriptionStatus(status: string) { return status === 'active' || status === 'trialing'; }
function rowDate(row: SubRow) { return row.current_period_end || row.renewal_date; }
function money(unitAmount?: number | null, currency?: string | null) {
  if (unitAmount == null || !currency) return '—';
  return `${(unitAmount / 100).toLocaleString()} ${currency.toUpperCase()}`;
}

export default function AdminSubscriptions() {
  const l = useLocalizer();
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [users, setUsers] = useState<Record<string, AdminUserRow>>({});
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
    if (queryError) {
      setSubs([]); setUsers({}); setError(queryError.message || 'Failed to load subscriptions.');
    } else {
      setSubs((subscriptionsRes.data || []) as SubRow[]);
      const next: Record<string, AdminUserRow> = {};
      for (const row of (usersRes.data || []) as AdminUserRow[]) next[row.id] = row;
      setUsers(next);
    }
    setLoading(false);
  }, []);

  const loadBillingStatus = useCallback(async () => {
    setBillingStatusLoading(true); setBillingStatusError(null);
    const { data, error: statusError } = await supabase.functions.invoke('billing-admin-status', { body: {} });
    if (statusError) {
      setBillingStatus(null); setBillingStatusError(statusError.message || 'Could not load Stripe configuration.');
    } else setBillingStatus(data as BillingStatus);
    setBillingStatusLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (section === 'payments' && !billingStatus && !billingStatusLoading) void loadBillingStatus();
  }, [section, billingStatus, billingStatusLoading, loadBillingStatus]);

  const computed = useMemo(() => {
    const now = new Date();
    const billable = subs.filter(s => users[s.user_id]?.role !== 'admin');
    const activePaid = billable.filter(s => isPaidPlan(s.plan) && isLiveSubscriptionStatus(s.status));
    const priceMap: Record<string, number> = {
      pro: billingStatus?.plans.pro.unitAmount != null ? billingStatus.plans.pro.unitAmount / 100 : 19,
      business: billingStatus?.plans.business.unitAmount != null ? billingStatus.plans.business.unitAmount / 100 : 49,
    };
    const revenue = activePaid.reduce((sum, s) => sum + (priceMap[s.plan] || 0), 0);
    const renewals = activePaid.filter(s => !s.cancel_at_period_end && rowDate(s) && new Date(rowDate(s) as string) > now);
    const scheduledCancellations = activePaid.filter(s => s.cancel_at_period_end && rowDate(s) && new Date(rowDate(s) as string) > now);
    const pastDue = billable.filter(s => isPaidPlan(s.plan) && s.status === 'past_due');
    const failed = billable.filter(s => isPaidPlan(s.plan) && ['unpaid', 'incomplete_expired'].includes(s.status));
    const currentRows = billable.filter(s => !['canceled', 'incomplete_expired'].includes(s.status));
    const byPlan = ['free', 'pro', 'business'].map(p => ({ label: p, value: currentRows.filter(s => s.plan === p).length }));
    const filtered = filter === 'all' ? subs : filter === 'active' ? activePaid : filter === 'past_due' ? pastDue : filter === 'failed' ? failed : filter === 'cancellations' ? scheduledCancellations : renewals;
    return { activePaid, revenue, renewals, scheduledCancellations, pastDue, failed, byPlan, filtered };
  }, [subs, users, filter, billingStatus]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-violet-500" /></div>;
  if (error) return <div className="mx-auto max-w-xl rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-center sm:p-6"><AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-400" /><h2 className="mb-2 font-semibold text-white">{l('Could not load subscriptions')}</h2><p className="mb-4 break-words text-sm text-gray-400">{error}</p><button onClick={() => void load()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white"><RefreshCw className="h-4 w-4" />{l('Retry')}</button></div>;

  return <div className="mx-auto max-w-7xl min-w-0 space-y-5 overflow-x-hidden">
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
      <button onClick={() => setSection('overview')} className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-medium ${section === 'overview' ? 'border-violet-500/20 bg-violet-600/15 text-violet-300' : 'border-white/10 bg-white/[0.03] text-gray-400'}`}>{l('Subscriptions Overview')}</button>
      <button onClick={() => setSection('payments')} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${section === 'payments' ? 'border-violet-500/20 bg-violet-600/15 text-violet-300' : 'border-white/10 bg-white/[0.03] text-gray-400'}`}><Settings className="h-4 w-4" />{l('Payment Settings')}</button>
    </div>

    {section === 'payments' ? <PaymentSettings status={billingStatus} loading={billingStatusLoading} error={billingStatusError} onRefresh={() => void loadBillingStatus()} /> : <>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          { label: 'Est. MRR', value: `$${computed.revenue.toLocaleString()}`, icon: TrendingUp, color: 'emerald' },
          { label: 'Paid Active', value: computed.activePaid.length, icon: CheckCircle, color: 'violet' },
          { label: 'Upcoming Renewals', value: computed.renewals.length, icon: RefreshCw, color: 'blue' },
          { label: 'Scheduled Cancellations', value: computed.scheduledCancellations.length, icon: XCircle, color: 'amber' },
          { label: 'Past Due / Grace', value: computed.pastDue.length, icon: AlertCircle, color: 'blue' },
          { label: 'Failed Payments', value: computed.failed.length, icon: AlertCircle, color: 'red' },
        ].map(s => {
          const colors: Record<string, string> = { emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', violet: 'bg-violet-500/10 text-violet-400 border-violet-500/20', blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20', amber: 'bg-amber-500/10 text-amber-300 border-amber-500/20', red: 'bg-red-500/10 text-red-400 border-red-500/20' };
          const Icon = s.icon;
          return <div key={s.label} className={`min-w-0 rounded-xl border p-3 sm:rounded-2xl sm:p-4 ${colors[s.color]}`}><Icon className="mb-2 h-5 w-5" /><div className="text-xl font-bold text-white sm:text-2xl">{s.value}</div><div className="break-words text-[11px] leading-4 text-gray-400 sm:text-xs">{l(s.label)}</div></div>;
        })}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 sm:p-5"><h3 className="mb-4 text-sm font-semibold text-white">{l('Current subscriptions by plan')}</h3><BarChart data={computed.byPlan} color="#a78bfa" height={180} /></div>

      <div className="flex max-w-full gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {['all', 'active', 'past_due', 'renewals', 'cancellations', 'failed'].map(f => <button key={f} onClick={() => setFilter(f)} className={`min-h-10 shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${filter === f ? 'bg-violet-600 text-white' : 'border border-white/10 bg-white/5 text-gray-400'}`}>{l(f === 'all' ? 'All' : f === 'active' ? 'Paid Active' : f === 'past_due' ? 'Past Due' : f === 'renewals' ? 'Renewals' : f === 'cancellations' ? 'Cancellations' : 'Failed')}</button>)}
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
        <div className="divide-y divide-white/5 sm:hidden">{computed.filtered.map(s => <SubscriptionCard key={s.id} row={s} user={users[s.user_id]} l={l} />)}</div>
        <div className="hidden overflow-x-auto sm:block"><table className="w-full min-w-[760px]"><thead><tr className="border-b border-white/5"><th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">{l('User')}</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">{l('Plan')}</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">{l('Status')}</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">{l('Billing / Access Date')}</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">{l('Created')}</th></tr></thead><tbody>{computed.filtered.map(s => <SubscriptionTableRow key={s.id} row={s} user={users[s.user_id]} l={l} />)}</tbody></table></div>
        {computed.filtered.length === 0 && <div className="py-8 text-center text-sm text-gray-500">{l('No subscriptions found')}</div>}
      </div>
    </>}
  </div>;
}

function presentation(row: SubRow, user?: AdminUserRow) {
  if (user?.role === 'admin') return { plan: 'Business (Admin)', status: 'Admin Access', statusClass: 'text-cyan-300', date: null as string | null, live: true, scheduled: false };
  const live = isLiveSubscriptionStatus(row.status);
  const scheduled = live && row.cancel_at_period_end;
  const status = scheduled ? 'Active · cancels at period end' : row.status === 'past_due' ? 'past_due · 3-day grace' : row.status;
  const statusClass = scheduled ? 'text-amber-300' : live ? 'text-emerald-400' : row.status === 'past_due' ? 'text-amber-300' : 'text-red-400';
  return { plan: row.plan, status, statusClass, date: rowDate(row), live, scheduled };
}

function SubscriptionCard({ row, user, l }: { row: SubRow; user?: AdminUserRow; l: (value: string) => string }) {
  const p = presentation(row, user);
  return <div className="p-4"><div className="truncate text-sm font-medium text-white">{user?.email || user?.full_name || row.user_id}</div><div className="mt-3 flex flex-wrap items-center gap-2"><span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-medium text-gray-300">{l(p.plan)}</span><span className={`text-xs font-medium ${p.statusClass}`}>{l(p.status)}</span></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div className="rounded-lg bg-white/[0.03] p-2.5"><div className="text-gray-600">{l('Billing / Access Date')}</div><div className="mt-1 text-gray-300">{p.date ? new Date(p.date).toLocaleDateString() : user?.role === 'admin' ? l('Always') : '—'}</div></div><div className="rounded-lg bg-white/[0.03] p-2.5"><div className="text-gray-600">{l('Created')}</div><div className="mt-1 text-gray-300">{new Date(row.created_at).toLocaleDateString()}</div></div></div></div>;
}

function SubscriptionTableRow({ row, user, l }: { row: SubRow; user?: AdminUserRow; l: (value: string) => string }) {
  const p = presentation(row, user);
  return <tr className="border-b border-white/5 hover:bg-white/[0.02]"><td className="px-4 py-3"><div className="max-w-[260px] truncate text-sm text-gray-300">{user?.email || user?.full_name || row.user_id}</div></td><td className="px-4 py-3"><span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-gray-300">{l(p.plan)}</span></td><td className="px-4 py-3"><span className={`text-xs font-medium ${p.statusClass}`}>{l(p.status)}</span></td><td className="px-4 py-3 text-sm text-gray-400">{p.date ? new Date(p.date).toLocaleDateString() : user?.role === 'admin' ? l('Always') : '—'}</td><td className="px-4 py-3 text-sm text-gray-500">{new Date(row.created_at).toLocaleDateString()}</td></tr>;
}

function PaymentSettings({ status, loading, error, onRefresh }: { status: BillingStatus | null; loading: boolean; error: string | null; onRefresh: () => void; }) {
  const l = useLocalizer();
  const [priceInputs, setPriceInputs] = useState<Record<'pro' | 'business', string>>({ pro: '', business: '' });
  const [priceBusy, setPriceBusy] = useState<'pro' | 'business' | null>(null);
  const [promotions, setPromotions] = useState<PromotionCode[]>([]);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoBusy, setPromoBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [coupon, setCoupon] = useState({ code: '', discountType: 'percent', percentOff: '20', amountOff: '', currency: 'usd', duration: 'once', maxRedemptions: '', expiresAt: '' });

  useEffect(() => {
    if (!status) return;
    setPriceInputs({ pro: status.plans.pro.unitAmount != null ? String(status.plans.pro.unitAmount / 100) : '', business: status.plans.business.unitAmount != null ? String(status.plans.business.unitAmount / 100) : '' });
  }, [status?.plans.pro.unitAmount, status?.plans.business.unitAmount]);

  const invokeControl = useCallback(async (body: Record<string, unknown>) => {
    const { data, error: invokeError } = await supabase.functions.invoke('billing-admin-control', { body });
    if (invokeError) throw new Error(invokeError.message || 'Billing control request failed');
    if (data?.error) throw new Error(String(data.error));
    return data;
  }, []);

  const loadPromotions = useCallback(async () => {
    setPromoLoading(true);
    try {
      const data = await invokeControl({ action: 'list_coupons' });
      setPromotions((data?.promotions || []) as PromotionCode[]);
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Could not load coupons' });
    } finally { setPromoLoading(false); }
  }, [invokeControl]);

  useEffect(() => { if (status?.connected) void loadPromotions(); }, [status?.connected, loadPromotions]);

  async function createPrice(plan: 'pro' | 'business') {
    const amount = Number(priceInputs[plan]);
    if (!Number.isFinite(amount) || amount <= 0) { setNotice({ type: 'error', text: l('Enter a valid price greater than zero.') }); return; }
    const current = status?.plans[plan];
    const currency = (current?.currency || status?.account?.defaultCurrency || 'usd').toLowerCase();
    const interval = current?.interval === 'year' ? 'year' : 'month';
    if (!window.confirm(`${l('Create and activate a new Stripe price for')} ${plan.toUpperCase()}: ${amount} ${currency.toUpperCase()} / ${interval}?`)) return;
    setPriceBusy(plan); setNotice(null);
    try {
      await invokeControl({ action: 'create_price', plan, unitAmount: Math.round(amount * 100), currency, interval });
      setNotice({ type: 'ok', text: `${plan.toUpperCase()} ${l('new price created and activated for new checkouts.')}` });
      onRefresh();
    } catch (err) { setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Could not create price' }); }
    finally { setPriceBusy(null); }
  }

  async function createCoupon() {
    if (!coupon.code.trim()) { setNotice({ type: 'error', text: l('Coupon code is required.') }); return; }
    setPromoBusy(true); setNotice(null);
    try {
      const body: Record<string, unknown> = { action: 'create_coupon', code: coupon.code.trim(), discountType: coupon.discountType, duration: coupon.duration };
      if (coupon.discountType === 'percent') body.percentOff = Number(coupon.percentOff);
      else { body.amountOff = Math.round(Number(coupon.amountOff) * 100); body.currency = coupon.currency.toLowerCase(); }
      if (coupon.maxRedemptions) body.maxRedemptions = Number(coupon.maxRedemptions);
      if (coupon.expiresAt) body.expiresAt = new Date(coupon.expiresAt).toISOString();
      await invokeControl(body);
      setCoupon(v => ({ ...v, code: '', maxRedemptions: '', expiresAt: '' }));
      setNotice({ type: 'ok', text: l('Coupon created and activated.') });
      await loadPromotions();
    } catch (err) { setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Could not create coupon' }); }
    finally { setPromoBusy(false); }
  }

  async function disableCoupon(id: string) {
    if (!window.confirm(l('Disable this promotion code?'))) return;
    setPromoBusy(true); setNotice(null);
    try { await invokeControl({ action: 'disable_coupon', promotionCodeId: id }); setNotice({ type: 'ok', text: l('Coupon disabled.') }); await loadPromotions(); }
    catch (err) { setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Could not disable coupon' }); }
    finally { setPromoBusy(false); }
  }

  const StatusPill = ({ ok, label }: { ok: boolean; label: string }) => <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${ok ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/20 bg-amber-500/10 text-amber-300'}`}>{ok ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}{label}</span>;

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-violet-500" /></div>;
  if (error) return <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4"><AlertCircle className="mb-2 h-5 w-5 text-amber-400" /><div className="text-sm text-gray-300">{error}</div><button onClick={onRefresh} className="mt-4 min-h-11 rounded-xl border border-white/10 px-4 text-sm text-gray-300">{l('Retry')}</button></div>;
  if (!status) return null;

  return <div className="min-w-0 space-y-5">
    {notice && <div className={`rounded-xl border p-3 text-sm ${notice.type === 'ok' ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300' : 'border-red-500/20 bg-red-500/5 text-red-300'}`}>{notice.text}</div>}

    <div className="rounded-2xl border border-white/10 bg-[#0b0b18] p-4 sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-violet-400" /><h2 className="font-semibold text-white">{l('Stripe Connection')}</h2></div><p className="mt-1 text-sm text-gray-500">{l('Secrets stay server-side and are never exposed in this panel.')}</p></div><div className="flex flex-wrap gap-2"><StatusPill ok={status.connected} label={status.connected ? l('Connected') : l('Not configured')} /><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase ${status.mode === 'live' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-blue-500/20 bg-blue-500/10 text-blue-300'}`}>{status.mode}</span></div></div></div>

    <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.04] p-4 sm:p-5"><h3 className="font-semibold text-white">{l('Price Control')}</h3><p className="mt-1 text-xs leading-5 text-gray-500">{l('Changing a plan creates a new Stripe Price and activates it for new checkouts. Existing subscribers are not migrated automatically.')}</p><div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">{(['pro','business'] as const).map(planName => { const plan = status.plans[planName]; return <div key={planName} className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="flex items-center justify-between gap-2"><div><div className="font-semibold capitalize text-white">{planName}</div><div className="mt-1 text-xs text-gray-500">{l('Current')}: {money(plan.unitAmount, plan.currency)}{plan.interval ? ` / ${plan.interval}` : ''}</div></div><StatusPill ok={plan.valid} label={plan.valid ? l('Price verified') : l('Invalid')} /></div><div className="mt-4 flex flex-col gap-2 sm:flex-row"><input type="number" min="0.01" step="0.01" value={priceInputs[planName]} onChange={e => setPriceInputs(v => ({ ...v, [planName]: e.target.value }))} className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#10101d] px-3 text-sm text-white outline-none focus:border-violet-400/50" /><button onClick={() => void createPrice(planName)} disabled={priceBusy !== null || !status.connected} className="min-h-11 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white disabled:opacity-50">{priceBusy === planName ? l('Creating…') : l('Create & Activate New Price')}</button></div><div className="mt-2 break-all font-mono text-[10px] text-gray-600">{plan.priceId || '—'}</div></div>; })}</div></div>

    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5"><div className="flex items-center gap-2"><Tag className="h-5 w-5 text-fuchsia-400" /><h3 className="font-semibold text-white">{l('Coupon Manager')}</h3></div><div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4"><input placeholder={l('Code, e.g. WELCOME20')} value={coupon.code} onChange={e => setCoupon(v => ({ ...v, code: e.target.value.toUpperCase() }))} className="min-h-11 rounded-xl border border-white/10 bg-[#10101d] px-3 text-sm text-white" /><select value={coupon.discountType} onChange={e => setCoupon(v => ({ ...v, discountType: e.target.value }))} className="min-h-11 rounded-xl border border-white/10 bg-[#10101d] px-3 text-sm text-white"><option value="percent">{l('Percent discount')}</option><option value="amount">{l('Fixed amount')}</option></select>{coupon.discountType === 'percent' ? <input type="number" min="0.01" max="100" step="0.01" value={coupon.percentOff} onChange={e => setCoupon(v => ({ ...v, percentOff: e.target.value }))} placeholder="20" className="min-h-11 rounded-xl border border-white/10 bg-[#10101d] px-3 text-sm text-white" /> : <div className="grid grid-cols-[1fr_90px] gap-2"><input type="number" min="0.01" step="0.01" value={coupon.amountOff} onChange={e => setCoupon(v => ({ ...v, amountOff: e.target.value }))} className="min-h-11 rounded-xl border border-white/10 bg-[#10101d] px-3 text-sm text-white" /><input value={coupon.currency} onChange={e => setCoupon(v => ({ ...v, currency: e.target.value }))} className="min-h-11 rounded-xl border border-white/10 bg-[#10101d] px-3 text-sm uppercase text-white" /></div>}<select value={coupon.duration} onChange={e => setCoupon(v => ({ ...v, duration: e.target.value }))} className="min-h-11 rounded-xl border border-white/10 bg-[#10101d] px-3 text-sm text-white"><option value="once">{l('Once')}</option><option value="forever">{l('Forever')}</option></select><input type="number" min="1" placeholder={l('Max uses (optional)')} value={coupon.maxRedemptions} onChange={e => setCoupon(v => ({ ...v, maxRedemptions: e.target.value }))} className="min-h-11 rounded-xl border border-white/10 bg-[#10101d] px-3 text-sm text-white" /><input type="datetime-local" value={coupon.expiresAt} onChange={e => setCoupon(v => ({ ...v, expiresAt: e.target.value }))} className="min-h-11 rounded-xl border border-white/10 bg-[#10101d] px-3 text-sm text-white" /><button onClick={() => void createCoupon()} disabled={promoBusy || !status.connected} className="min-h-11 rounded-xl bg-fuchsia-600 px-4 text-sm font-semibold text-white disabled:opacity-50">{promoBusy ? l('Working…') : l('Create Coupon')}</button><button onClick={() => void loadPromotions()} disabled={promoLoading} className="min-h-11 rounded-xl border border-white/10 px-4 text-sm text-gray-300">{promoLoading ? l('Loading…') : l('Refresh Coupons')}</button></div>

      <div className="mt-5 space-y-2">{promotions.map(promo => { const c = promo.coupon; const discount = c?.percent_off != null ? `${c.percent_off}%` : c?.amount_off != null ? money(c.amount_off, c.currency) : '—'; return <div key={promo.id} className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/20 p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-semibold text-white">{promo.code || c?.name || promo.id}</span><span className={`rounded-full px-2 py-0.5 text-[10px] ${promo.active ? 'bg-emerald-500/10 text-emerald-300' : 'bg-gray-500/10 text-gray-500'}`}>{promo.active ? l('Active') : l('Disabled')}</span></div><div className="mt-1 text-xs text-gray-500">{discount} · {c?.duration || '—'} · {promo.times_redeemed || 0}{promo.max_redemptions ? `/${promo.max_redemptions}` : ''} {l('used')}{promo.expires_at ? ` · ${l('expires')} ${new Date(promo.expires_at * 1000).toLocaleDateString()}` : ''}</div></div>{promo.active && <button onClick={() => void disableCoupon(promo.id)} disabled={promoBusy} className="min-h-10 rounded-lg border border-red-500/20 px-3 text-xs font-medium text-red-300 hover:bg-red-500/10 disabled:opacity-50">{l('Disable')}</button>}</div>; })}{!promoLoading && promotions.length === 0 && <div className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-gray-600">{l('No promotion codes found.')}</div>}</div>
    </div>

    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3"><div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"><Webhook className="mb-3 h-5 w-5 text-cyan-400" /><div className="font-medium text-white">{l('Webhook')}</div><div className="mt-3 flex flex-wrap gap-2"><StatusPill ok={status.webhook.secretConfigured} label={status.webhook.secretConfigured ? l('Secret configured') : l('Secret missing')} /><StatusPill ok={status.webhook.endpointConfigured} label={status.webhook.endpointConfigured ? l('Endpoint found') : l('Endpoint missing')} /><StatusPill ok={status.webhook.receivesRequiredEvents === true} label={status.webhook.receivesRequiredEvents ? l('Events configured') : l('Events need review')} /></div></div><div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"><CreditCard className="mb-3 h-5 w-5 text-fuchsia-400" /><div className="font-medium text-white">{l('Checkout & Portal')}</div><div className="mt-3 flex flex-wrap gap-2"><StatusPill ok={status.checkoutReady} label={status.checkoutReady ? l('Checkout ready') : l('Checkout needs setup')} /><StatusPill ok={status.portalReady} label={status.portalReady ? l('Billing Portal ready') : l('Portal needs setup')} /></div></div><div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"><Landmark className="mb-3 h-5 w-5 text-emerald-400" /><div className="font-medium text-white">{l('Payout Destination')}</div><p className="mt-2 text-xs leading-5 text-gray-500">{l('Bank accounts, payout schedule, identity and tax details are managed only inside Stripe.')}</p><button type="button" onClick={() => window.open('https://dashboard.stripe.com/', '_blank', 'noopener,noreferrer')} className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-gray-300"><ExternalLink className="h-4 w-4" />{l('Open Stripe Dashboard')}</button></div></div>

    <div className="flex justify-end"><button onClick={onRefresh} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-gray-300"><RefreshCw className="h-4 w-4" />{l('Refresh Stripe Status')}</button></div>
  </div>;
}
