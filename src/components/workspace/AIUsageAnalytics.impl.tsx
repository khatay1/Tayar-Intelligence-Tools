import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Calendar, Loader2, RefreshCw, ShieldCheck, Zap } from 'lucide-react';
import { usePreferences } from '@/context/PreferencesContext';
import { useLocalizer } from '@/lib/ui-localization';
import { getToolUsageState, ToolUsageState } from '@/lib/tool-usage';

const AI_TOOLS = [
  ['ai-chat', 'AI Chat'],
  ['cv-builder', 'CV Builder'],
  ['cover-letter', 'Cover Letter'],
  ['ai-writer', 'AI Writer'],
  ['translator', 'Translator'],
  ['document-ai', 'Document AI'],
  ['study-assistant', 'Study Assistant'],
  ['website-builder', 'Website Builder'],
  ['code-assistant', 'Code Assistant'],
  ['email-writer', 'Email Writer'],
  ['contract-writer', 'Contract Writer'],
  ['analytics-ai', 'Analytics AI'],
] as const;

type UsageRow = {
  id: string;
  label: string;
  state: ToolUsageState;
};

const AI_USAGE_LABELS = {
  en: {
    refresh: 'Refresh',
    privateUsage: 'Private account usage',
    unavailable: 'Unavailable',
    unlimited: 'Unlimited',
  },
  sv: {
    refresh: 'Uppdatera',
    privateUsage: 'Privat kontoanvändning',
    unavailable: 'Inte tillgänglig',
    unlimited: 'Obegränsat',
  },
  ar: {
    refresh: 'تحديث',
    privateUsage: 'استخدام الحساب الخاص',
    unavailable: 'غير متاح',
    unlimited: 'غير محدود',
  },
} as const;

function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function planLabel(value?: string) {
  const normalized = String(value || 'free').toLowerCase();
  if (normalized === 'business') return 'Business';
  if (normalized === 'pro') return 'Pro';
  return 'Free';
}

export default function AIUsageAnalytics() {
  const l = useLocalizer();
  const { prefs } = usePreferences();
  const usageLabels = AI_USAGE_LABELS[prefs.language];
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadUsage = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const results = await Promise.allSettled(
        AI_TOOLS.map(async ([id, label]) => ({ id, label, state: await getToolUsageState(id) })),
      );
      const nextRows: UsageRow[] = [];
      for (const result of results) {
        if (result.status === 'fulfilled') nextRows.push(result.value);
      }
      if (nextRows.length === 0) throw new Error('Could not load AI usage.');
      setRows(nextRows);
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : 'Could not load AI usage.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsage();
  }, [loadUsage]);

  const summary = useMemo(() => {
    const metered = rows.filter((row) => row.state.enabled !== false && row.state.reason !== 'plan_required');
    const used = metered.reduce((sum, row) => sum + safeNumber(row.state.usage_count), 0);
    const limited = metered.filter((row) => row.state.usage_limit !== null && row.state.usage_limit !== undefined);
    const remaining = limited.reduce((sum, row) => sum + safeNumber(row.state.usage_remaining), 0);
    const plan = rows.find((row) => row.state.effective_plan)?.state.effective_plan;
    return { used, remaining, limitedCount: limited.length, plan: planLabel(plan) };
  }, [rows]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white mb-1">{l('AI Usage Analytics')}</h1>
          <p className="text-gray-500 text-sm">{l('Track your AI consumption across all tools.')}</p>
        </div>
        <button
          type="button"
          onClick={() => void loadUsage()}
          className="min-h-11 shrink-0 inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-gray-300 hover:bg-white/[0.08]"
        >
          <RefreshCw className="h-4 w-4" />
          {usageLabels.refresh}
        </button>
      </div>

      <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.08] p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-violet-400" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-violet-100">{usageLabels.privateUsage}</div>
            <p className="mt-1 text-xs leading-5 text-violet-200/70">
              This page shows usage status for your signed-in account only. Detailed platform analytics are available only in Tayar Admin.
            </p>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.08] p-4 text-sm text-red-300">{error}</div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
            <Activity className="w-8 h-8 text-gray-600" />
          </div>
          <p className="text-gray-400 text-sm font-medium">{l('No AI usage yet')}</p>
          <p className="text-gray-600 text-xs mt-1">{l('Start using AI tools and your usage stats will appear here.')}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatusCard icon={ShieldCheck} label="Plan" value={summary.plan} />
            <StatusCard icon={Zap} label="Used in current periods" value={String(summary.used)} />
            <StatusCard
              icon={Calendar}
              label="Remaining metered uses"
              value={summary.limitedCount > 0 ? String(summary.remaining) : usageLabels.unlimited}
            />
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-6">
            <h2 className="mb-4 text-base font-bold text-white">{l('By Tool')}</h2>
            <div className="space-y-3">
              {rows.map(({ id, label, state }) => {
                const used = safeNumber(state.usage_count);
                const limit = state.usage_limit;
                const remaining = state.usage_remaining;
                const blockedByPlan = state.reason === 'plan_required';
                const disabled = state.enabled === false || state.reason === 'disabled';
                const limited = limit !== null && limit !== undefined;
                const pct = limited && Number(limit) > 0 ? Math.min(100, Math.round((used / Number(limit)) * 100)) : 0;

                return (
                  <div key={id} className="rounded-xl border border-white/[0.07] bg-black/10 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white">{label}</div>
                        <div className="mt-1 text-xs text-gray-500 capitalize">{state.period || 'monthly'}</div>
                      </div>
                      <div className="text-left text-xs sm:text-right">
                        {disabled ? (
                          <span className="text-gray-500">{usageLabels.unavailable}</span>
                        ) : blockedByPlan ? (
                          <span className="text-amber-400">Requires {planLabel(state.required_plan)}</span>
                        ) : limited ? (
                          <span className="text-gray-300">{used} / {Number(limit)} used · {safeNumber(remaining)} remaining</span>
                        ) : (
                          <span className="text-emerald-400">{usageLabels.unlimited}</span>
                        )}
                      </div>
                    </div>
                    {limited && !blockedByPlan && !disabled ? (
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
                        <div className="h-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500" style={{ width: `${pct}%` }} />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatusCard({ icon: Icon, label, value }: { icon: typeof Zap; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
        <Icon className="h-5 w-5 text-violet-400" />
      </div>
      <div className="break-words text-2xl font-bold text-white">{value}</div>
      <div className="mt-0.5 text-xs text-gray-500">{label}</div>
    </div>
  );
}
