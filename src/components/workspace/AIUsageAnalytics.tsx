import { useLocalizer } from '@/lib/ui-localization';
import { useState, useEffect } from 'react';
import { Activity, Cpu, Zap, TrendingUp, Loader2, DollarSign, Calendar } from 'lucide-react';
import { getUsageStats, UsageStats } from '@/lib/ai/service';
import { AI_PROVIDERS } from '@/lib/ai/types';

export default function AIUsageAnalytics() {
  const l = useLocalizer();
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUsageStats().then(data => {
      setStats(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
      </div>
    );
  }

  if (!stats || stats.totalRequests === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">{l('AI Usage Analytics')}</h1>
          <p className="text-gray-500 text-sm">{l('Track your AI consumption across all tools.')}</p>
        </div>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
            <Activity className="w-8 h-8 text-gray-600" />
          </div>
          <p className="text-gray-400 text-sm font-medium">{l('No AI usage yet')}</p>
          <p className="text-gray-600 text-xs mt-1">{l('Start using AI tools and your usage stats will appear here.')}</p>
        </div>
      </div>
    );
  }

  const maxDayTokens = Math.max(...stats.last7Days.map(d => d.tokens), 1);
  const today = stats.last7Days[stats.last7Days.length - 1];
  const monthCost = stats.last30Days.reduce((sum, d) => sum + d.cost, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">{l('AI Usage Analytics')}</h1>
        <p className="text-gray-500 text-sm">{l('Track your AI consumption, token usage, and costs across all tools.')}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard icon={Zap} label={l("Total Requests")} value={String(stats.totalRequests)} color="text-violet-400" bg="bg-violet-500/10" />
        <StatCard icon={TrendingUp} label={l("Input Tokens")} value={stats.totalTokensIn.toLocaleString()} color="text-sky-400" bg="bg-sky-500/10" />
        <StatCard icon={Cpu} label={l("Output Tokens")} value={stats.totalTokensOut.toLocaleString()} color="text-emerald-400" bg="bg-emerald-500/10" />
        <StatCard icon={DollarSign} label={l("Total Cost")} value={`${stats.totalCostUsd.toFixed(4)}`} color="text-amber-400" bg="bg-amber-500/10" />
        <StatCard icon={Calendar} label="Today" value={`${today?.requests || 0} reqs`} color="text-fuchsia-400" bg="bg-fuchsia-500/10" />
      </div>

      {/* Cost summary */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-violet-400" />
            <span className="text-gray-400 text-xs">{l("Today's Cost")}</span>
          </div>
          <div className="text-2xl font-bold text-white">${(today?.cost || 0).toFixed(4)}</div>
          <div className="text-gray-500 text-xs mt-0.5">{(today?.requests || 0)} requests</div>
        </div>
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span className="text-gray-400 text-xs">30-Day Cost</span>
          </div>
          <div className="text-2xl font-bold text-white">${monthCost.toFixed(4)}</div>
          <div className="text-gray-500 text-xs mt-0.5">{stats.last30Days.reduce((s, d) => s + d.requests, 0)} total requests</div>
        </div>
      </div>

      {/* 7-day chart */}
      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-bold text-base">{l('Last 7 Days')}</h2>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-gray-400"><span className="w-2.5 h-2.5 rounded-sm bg-violet-500" /> {l('Tokens')}</span>
            <span className="flex items-center gap-1.5 text-gray-400"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> {l('Cost')}</span>
          </div>
        </div>
        <div className="flex items-end justify-between gap-2 h-40">
          {stats.last7Days.map((day, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full flex-1 flex items-end gap-1">
                <div
                  className="w-full bg-gradient-to-t from-violet-600 to-fuchsia-500 rounded-t-lg transition-all hover:opacity-80"
                  style={{ height: `${(day.tokens / maxDayTokens) * 100}%`, minHeight: '4px' }}
                  title={`${day.requests} requests, ${day.tokens} tokens`}
                />
              </div>
              <span className="text-gray-500 text-xs">
                {new Date(day.date).toLocaleDateString('en', { weekday: 'short' })}
              </span>
              <span className="text-gray-600 text-xs">{day.requests}</span>
              <span className="text-emerald-500 text-xs">${day.cost.toFixed(3)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* By Provider */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <h2 className="text-white font-bold text-base mb-4">{l('By Provider')}</h2>
          <div className="space-y-3">
            {Object.entries(stats.byProvider).map(([provider, data]) => {
              const config = AI_PROVIDERS[provider as keyof typeof AI_PROVIDERS];
              const label = config?.label || provider;
              const total = data.tokensIn + data.tokensOut;
              const maxTotal = Math.max(...Object.values(stats.byProvider).map(p => p.tokensIn + p.tokensOut), 1);
              return (
                <div key={provider}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-white text-sm font-medium">{label}</span>
                    <span className="text-gray-500 text-xs">{total.toLocaleString()} tokens · ${data.costUsd.toFixed(4)}</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-violet-600 to-fuchsia-500 rounded-full transition-all"
                      style={{ width: `${(total / maxTotal) * 100}%` }}
                    />
                  </div>
                  <div className="text-gray-600 text-xs mt-1">{data.requests} requests</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* By Tool */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <h2 className="text-white font-bold text-base mb-4">{l('By Tool')}</h2>
          <div className="space-y-3">
            {Object.entries(stats.byTool).map(([tool, data]) => {
              const total = data.tokensIn + data.tokensOut;
              const maxTotal = Math.max(...Object.values(stats.byTool).map(p => p.tokensIn + p.tokensOut), 1);
              const toolCost = `${data.costUsd.toFixed(4)}`;
              const toolLabels: Record<string, string> = {
                'cv-builder': 'CV Builder',
                'cover-letter': 'Cover Letter',
                'ai-writer': 'AI Writer',
                'document-ai': 'Document AI',
                'study-assistant': 'Study Assistant',
                'translator': 'Translator',
                'ai-chat': 'AI Chat',
              };
              return (
                <div key={tool}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-white text-sm font-medium">{toolLabels[tool] || tool}</span>
                    <span className="text-gray-500 text-xs">{total.toLocaleString()} tokens · {toolCost}</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-sky-500 to-cyan-400 rounded-full transition-all"
                      style={{ width: `${(total / maxTotal) * 100}%` }}
                    />
                  </div>
                  <div className="text-gray-600 text-xs mt-1">{data.requests} requests</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, bg }: {
  icon: typeof Zap; label: string; value: string; color: string; bg: string;
}) {
  return (
    <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-4">
      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-gray-500 text-xs mt-0.5">{label}</div>
    </div>
  );
}
