import type * as React from 'react';
import type { WebsiteAnalyticsEvent } from '../core/website-builder-model';

interface BuilderLegacyAnalyticsProps {
  analyticsError: string;
  analyticsEvents: WebsiteAnalyticsEvent[];
  analyticsLoading: boolean;
  analyticsSummary: { views: number; sessions: number; last7Days: number; todayViews: number; conversions: number; ctaClicks: number; formSubmits: number; conversionRate: number; topPages: [string, number][]; topReferrers: [string, number][]; };
  darkMode: boolean;
  exportAnalyticsCsv: () => void;
  l: (text: string) => string;
  refreshAnalytics: () => Promise<void>;
  setAnalyticsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function BuilderLegacyAnalytics({
  analyticsError,
  analyticsEvents,
  analyticsLoading,
  analyticsSummary,
  darkMode,
  exportAnalyticsCsv,
  l,
  refreshAnalytics,
  setAnalyticsOpen,
}: BuilderLegacyAnalyticsProps) {
  return (
<div className={`border-b px-4 py-3 ${darkMode ? 'border-amber-500/20 bg-[#181208]' : 'border-amber-200 bg-amber-50/50'}`}>
          <div className="mx-auto flex max-w-6xl flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold">{l('Site Analytics')}</p>
                <p className={`text-[11px] ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                  {l('Last 30 days. Anonymous session IDs only; no IP addresses are stored.')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={exportAnalyticsCsv} disabled={!analyticsEvents.length} className="text-xs font-semibold text-sky-400 disabled:opacity-40">CSV</button>
                <button onClick={() => void refreshAnalytics()} disabled={analyticsLoading} className="text-xs font-semibold text-amber-400 disabled:opacity-50">
                  {analyticsLoading ? l('Refreshing…') : l('Refresh')}
                </button>
                <button onClick={() => setAnalyticsOpen(false)} className="text-xs font-semibold text-violet-400">{l('Close')}</button>
              </div>
            </div>

            {analyticsError && <p className="text-xs text-amber-400">{l(analyticsError)}</p>}

            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
              {[
                ['Views · 30d', analyticsSummary.views],
                ['Visitors · 30d', analyticsSummary.sessions],
                ['Views · 7d', analyticsSummary.last7Days],
                ['Views · Today', analyticsSummary.todayViews],
                ['CTA clicks', analyticsSummary.ctaClicks],
                ['Form submits', analyticsSummary.formSubmits],
                ['Form CVR', `${analyticsSummary.conversionRate}%`],
              ].map(([label, value]) => (
                <div key={String(label)} className={`rounded-xl border p-3 ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`}>
                  <p className={`text-[10px] font-semibold uppercase tracking-wide ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{l(String(label))}</p>
                  <p className="mt-1 text-xl font-black">{value}</p>
                </div>
              ))}
            </div>

            {!analyticsLoading && !analyticsEvents.length ? (
              <div className={`rounded-lg border p-4 text-xs ${darkMode ? 'border-white/10 bg-white/5 text-gray-400' : 'border-gray-200 bg-white text-gray-500'}`}>{l("No page views yet. Publish or export the site with Sprint 15 tracking enabled, then visits will appear here.")}</div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                <div className={`rounded-xl border p-3 ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`}>
                  <p className="mb-2 text-xs font-bold">{l('Top pages')}</p>
                  <div className="space-y-2">
                    {analyticsSummary.topPages.map(([page, count]) => (
                      <div key={page} className="flex items-center justify-between gap-3 text-xs">
                        <span className="min-w-0 truncate" title={page}>{page}</span>
                        <span className="font-bold text-amber-400">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className={`rounded-xl border p-3 ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`}>
                  <p className="mb-2 text-xs font-bold">{l('Traffic sources')}</p>
                  <div className="space-y-2">
                    {analyticsSummary.topReferrers.map(([source, count]) => (
                      <div key={source} className="flex items-center justify-between gap-3 text-xs">
                        <span className="min-w-0 truncate" title={source}>{source}</span>
                        <span className="font-bold text-amber-400">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
  );
}
