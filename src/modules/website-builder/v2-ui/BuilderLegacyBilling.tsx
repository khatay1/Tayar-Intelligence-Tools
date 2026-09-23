import { Sparkles } from 'lucide-react';
import type * as React from 'react';
import { BILLING_PLAN_DETAILS } from '../core/website-builder-config';
import type { BillingEntitlements,BillingPlan,BillingState,WebsiteAnalyticsEvent,WebsiteLead,WebsitePage } from '../core/website-builder-model';

interface BuilderLegacyBillingProps {
  analyticsEvents: WebsiteAnalyticsEvent[];
  billingBusy: boolean;
  billingEntitlements: BillingEntitlements;
  billingError: string;
  billingLoading: boolean;
  billingPlan: BillingPlan;
  billingState: BillingState;
  cloudProjectId: string | null;
  darkMode: boolean;
  l: (text: string) => string;
  leads: WebsiteLead[];
  openBillingPortal: () => Promise<void>;
  pages: WebsitePage[];
  refreshBilling: (projectId?: string | null, expectedLoadSequence?: number) => Promise<void>;
  setBillingOpen: React.Dispatch<React.SetStateAction<boolean>>;
  startBillingCheckout: (plan: "pro" | "business") => Promise<void>;
}

export function BuilderLegacyBilling({
  analyticsEvents,
  billingBusy,
  billingEntitlements,
  billingError,
  billingLoading,
  billingPlan,
  billingState,
  cloudProjectId,
  darkMode,
  l,
  leads,
  openBillingPortal,
  pages,
  refreshBilling,
  setBillingOpen,
  startBillingCheckout,
}: BuilderLegacyBillingProps) {
  return (
<div className={`border-b px-4 py-4 ${darkMode ? 'border-emerald-500/20 bg-[#07140f]' : 'border-emerald-200 bg-emerald-50/60'}`}>
          <div className="mx-auto max-w-6xl space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-400" />
                  <p className="text-sm font-bold">{l('Plans & Billing')}</p>
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-400">{BILLING_PLAN_DETAILS[billingPlan].badge}</span>
                </div>
                <p className="mt-1 text-[11px] text-gray-500">{l('Secure entitlements, usage limits and Stripe subscription management.')}</p>
                {billingState.subscription?.status && (
                  <p className="mt-1 text-[10px] text-gray-500">{l("Subscription:")}<span className="font-semibold text-gray-300">{l(billingState.subscription.status)}</span>
                    {billingState.subscription.currentPeriodEnd ? ` · ${l('period ends')} ${new Date(billingState.subscription.currentPeriodEnd).toLocaleDateString()}` : ''}
                    {billingState.subscription.cancelAtPeriodEnd ? ` · ${l('cancels at period end')}` : ''}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {billingState.subscription?.stripeCustomerId && (
                  <button onClick={() => void openBillingPortal()} disabled={billingBusy} className="rounded-lg border border-emerald-500/30 px-3 py-2 text-[10px] font-bold text-emerald-400 disabled:opacity-50">{l('Manage subscription')}</button>
                )}
                <button onClick={() => void refreshBilling(cloudProjectId)} disabled={billingLoading} className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-bold text-gray-400 disabled:opacity-50">{billingLoading ? l('Refreshing…') : l('Refresh')}</button>
                <button onClick={() => setBillingOpen(false)} className="text-xs font-semibold text-violet-400">{l('Close')}</button>
              </div>
            </div>

            {billingError && (
              <div className={`rounded-xl border px-3 py-2 text-[11px] ${darkMode ? 'border-amber-500/25 bg-amber-500/10 text-amber-300' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>{l(billingError)}</div>
            )}

            <div className="grid gap-3 md:grid-cols-3">
              {(['free', 'pro', 'business'] as BillingPlan[]).map((plan) => {
                const details = BILLING_PLAN_DETAILS[plan];
                const current = billingPlan === plan;
                const isPaid = plan !== 'free';
                return (
                  <div key={plan} className={`rounded-2xl border p-4 ${current ? 'border-emerald-500/50 bg-emerald-500/10' : darkMode ? 'border-white/10 bg-white/[0.03]' : 'border-gray-200 bg-white'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-black">{l(details.label)}</p>
                        <p className="mt-1 text-[10px] text-gray-500">{l(details.description)}</p>
                      </div>
                      {current && <span className="rounded-full bg-emerald-500 px-2 py-1 text-[8px] font-black text-white">{l('CURRENT')}</span>}
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {details.bullets.map((bullet) => <p key={bullet} className="text-[10px] text-gray-400">✓ {l(bullet)}</p>)}
                    </div>
                    <div className="mt-4">
                      {current ? (
                        <div className="rounded-lg border border-emerald-500/20 px-3 py-2 text-center text-[10px] font-bold text-emerald-400">{l('Active plan')}</div>
                      ) : isPaid ? (
                        <button onClick={() => void startBillingCheckout(plan)} disabled={billingBusy} className="w-full rounded-lg bg-violet-600 px-3 py-2 text-[10px] font-bold text-white hover:bg-violet-500 disabled:opacity-50">{billingBusy ? l('Opening Stripe…') : `${l('Choose')} ${l(details.label)}`}</button>
                      ) : billingState.subscription?.stripeCustomerId ? (
                        <button onClick={() => void openBillingPortal()} disabled={billingBusy} className="w-full rounded-lg border border-white/10 px-3 py-2 text-[10px] font-bold text-gray-400 disabled:opacity-50">{l('Manage downgrade in Stripe')}</button>
                      ) : (
                        <div className="rounded-lg border border-white/10 px-3 py-2 text-center text-[10px] text-gray-500">{l('Default plan')}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className={`rounded-2xl border p-4 ${darkMode ? 'border-white/10 bg-white/[0.03]' : 'border-gray-200 bg-white'}`}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-xs font-bold">{l('Website Builder Usage')}</p>
                <p className="text-[9px] text-gray-500">{l('Limits are also enforced by Supabase for project/page growth.')}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  ['Projects', billingState.usage.websiteProjects, billingEntitlements.maxWebsiteProjects],
                  ['Pages', pages.length, billingEntitlements.maxPages],
                  ['Releases', billingState.usage.releases, billingEntitlements.maxReleaseHistory],
                  ['Leads', Math.max(billingState.usage.leads, leads.length), billingEntitlements.maxLeads],
                  ['Analytics', Math.max(billingState.usage.analyticsEvents, analyticsEvents.length), billingEntitlements.maxAnalyticsEvents],
                ].map(([label, rawValue, rawLimit]) => {
                  const value = Number(rawValue) || 0;
                  const limit = Number(rawLimit) || 1;
                  const percent = Math.min(100, Math.round((value / limit) * 100));
                  return <div key={String(label)} className="rounded-xl border border-white/10 p-3"><div className="flex items-center justify-between text-[10px]"><span className="font-semibold">{l(String(label))}</span><span className="text-gray-500">{value}/{limit.toLocaleString()}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/20"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${percent}%` }} /></div></div>;
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[9px] text-gray-500">
              <span>{l('Paid prices are controlled by STRIPE_PRO_PRICE_ID and STRIPE_BUSINESS_PRICE_ID, so the app never trusts a browser-supplied amount.')}</span>
              <span>{l("Webhook is the source of truth for upgrades, renewals, cancellation and payment status.")}</span>
            </div>
          </div>
        </div>
  );
}
