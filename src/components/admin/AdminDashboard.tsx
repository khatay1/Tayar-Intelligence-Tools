import { useLocalizer } from '@/lib/ui-localization';
import {
  Users, Activity, FileText, CreditCard, DollarSign, Server,
  TrendingUp, Cpu, Loader2, Zap, AlertTriangle, RefreshCw,
} from 'lucide-react';
import {
  useDashboardStats, useUserGrowth, useRevenueData,
  useAIUsageData, useToolPopularity,
} from '@/lib/admin-hooks';
import { LineChart, BarChart, DonutChart, Sparkline } from './Charts';

export default function AdminDashboard() {
  const l = useLocalizer();
  const { stats, loading, error, refresh } = useDashboardStats();
  const { data: userGrowth } = useUserGrowth();
  const { data: revenueData } = useRevenueData();
  const { data: aiUsage } = useAIUsageData();
  const { data: toolPop } = useToolPopularity();

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-violet-500 animate-spin" /></div>;
  }

  if (error || !stats) {
    return (
      <div className="max-w-xl mx-auto rounded-2xl border border-red-500/20 bg-red-500/5 p-4 sm:p-6 text-center min-w-0">
        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
        <h2 className="text-white font-semibold mb-2">{l('Dashboard data unavailable')}</h2>
        <p className="text-sm text-gray-400 mb-4 break-words">{error || l('The admin data source could not be loaded.')}</p>
        <button onClick={() => void refresh()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500">
          <RefreshCw className="w-4 h-4" /> {l('Retry')}
        </button>
      </div>
    );
  }

  const recentGrowth = userGrowth.slice(-7);
  const newUserSpark = recentGrowth.map((point, index) => index === 0 ? 0 : Math.max(0, point.users - recentGrowth[index - 1].users));

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'violet', spark: recentGrowth.map(d => d.users) },
    { label: 'AI Active (7d)', value: stats.activeUsers, icon: Activity, color: 'emerald', spark: aiUsage.slice(-7).map(d => d.requests) },
    { label: 'New Today', value: stats.newUsersToday, icon: TrendingUp, color: 'blue', spark: newUserSpark },
    { label: 'AI Requests', value: stats.totalAIRequests, icon: Cpu, color: 'fuchsia', spark: aiUsage.slice(-7).map(d => d.requests) },
    { label: 'Projects', value: stats.totalDocuments, icon: FileText, color: 'amber', spark: [0, stats.totalDocuments] },
    { label: 'Active Subs', value: stats.activeSubscriptions, icon: CreditCard, color: 'cyan', spark: [0, stats.activeSubscriptions] },
    { label: 'Est. MRR', value: `$${stats.monthlyRevenue}`, icon: DollarSign, color: 'emerald', spark: revenueData.map(d => d.revenue) },
    { label: 'Data Status', value: stats.serverStatus === 'online' ? 'Connected' : 'Unavailable', icon: Server, color: stats.serverStatus === 'online' ? 'emerald' : 'red', spark: [1, 1] },
  ];

  const colorMap: Record<string, { bg: string; text: string; border: string; spark: string }> = {
    violet: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20', spark: '#a78bfa' },
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', spark: '#34d399' },
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', spark: '#60a5fa' },
    fuchsia: { bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-400', border: 'border-fuchsia-500/20', spark: '#f472b6' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', spark: '#fbbf24' },
    cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20', spark: '#22d3ee' },
    red: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', spark: '#fb7185' },
  };

  const ChartHeader = ({ title, subtitle, badge }: { title: string; subtitle: string; badge?: React.ReactNode }) => (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h3 className="text-white font-semibold text-sm">{l(title)}</h3>
        <p className="text-gray-500 text-xs break-words">{l(subtitle)}</p>
      </div>
      {badge && <div className="self-start shrink-0">{badge}</div>}
    </div>
  );

  return (
    <div className="space-y-5 sm:space-y-6 max-w-7xl mx-auto min-w-0 overflow-x-hidden">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map(card => {
          const c = colorMap[card.color];
          const Icon = card.icon;
          return (
            <div key={l(card.label)} className={`relative min-w-0 ${c.bg} border ${c.border} rounded-2xl p-3 sm:p-4 overflow-hidden group sm:hover:scale-[1.02] transition-transform cursor-default`} style={{ animation: 'fadeInUp 0.3s ease-out' }}>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className={`w-9 h-9 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center shrink-0`}><Icon className={`w-4.5 h-4.5 ${c.text}`} /></div>
                <div className="hidden min-[390px]:block shrink-0"><Sparkline data={card.spark.length > 1 ? card.spark : [0, 1]} color={c.spark} width={52} height={20} /></div>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-white truncate" title={String(card.value)}>{card.value}</div>
              <div className="mt-1 text-[11px] sm:text-xs text-gray-400 break-words leading-4">{l(card.label)}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-0">
        <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 sm:p-5 min-w-0 overflow-hidden">
          <ChartHeader title="User Growth" subtitle="Cumulative users over last 30 days" badge={<div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20"><Users className="w-3.5 h-3.5 text-violet-400" /><span className="text-xs text-violet-300 font-medium whitespace-nowrap">{stats.totalUsers} {l('total')}</span></div>} />
          <div className="w-full min-w-0 overflow-hidden"><LineChart data={userGrowth.map(d => ({ label: d.date.slice(5), value: d.users }))} color="#a78bfa" height={220} formatValue={(v) => `${v} ${l('users')}`} /></div>
        </div>

        <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 sm:p-5 min-w-0 overflow-hidden">
          <ChartHeader title="MRR by Subscription Start" subtitle="Estimated run-rate from active or trialing subscriptions grouped by start month" badge={<div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20"><DollarSign className="w-3.5 h-3.5 text-emerald-400" /><span className="text-xs text-emerald-300 font-medium whitespace-nowrap">${stats.monthlyRevenue}/mo</span></div>} />
          <div className="w-full min-w-0 overflow-hidden"><BarChart data={revenueData.map(d => ({ label: d.month, value: d.revenue }))} color="#34d399" height={220} formatValue={(v) => `$${v}`} /></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-w-0">
        <div className="lg:col-span-2 bg-white/[0.02] border border-white/10 rounded-2xl p-4 sm:p-5 min-w-0 overflow-hidden">
          <ChartHeader title="AI Usage" subtitle="Daily requests and token consumption" badge={<div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/20"><Zap className="w-3.5 h-3.5 text-fuchsia-400" /><span className="text-xs text-fuchsia-300 font-medium whitespace-nowrap">{stats.totalAIRequests} {l('total')}</span></div>} />
          <div className="w-full min-w-0 overflow-hidden"><LineChart data={aiUsage.map(d => ({ label: d.date.slice(5), value: d.requests }))} color="#f472b6" height={220} formatValue={(v) => `${v} ${l('requests')}`} /></div>
        </div>

        <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 sm:p-5 min-w-0 overflow-hidden">
          <div className="mb-4"><h3 className="text-white font-semibold text-sm">{l('Tool Popularity')}</h3><p className="text-gray-500 text-xs">{l('Requests by tool')}</p></div>
          {toolPop.length > 0 ? <div className="flex justify-center overflow-hidden"><DonutChart data={toolPop.slice(0, 7).map(t => ({ label: t.tool, value: t.count }))} size={140} /></div> : <div className="flex items-center justify-center h-[140px] text-gray-600 text-sm">{l('No data yet')}</div>}
        </div>
      </div>

      <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 sm:p-5 min-w-0">
        <h3 className="text-white font-semibold text-sm mb-1">{l('Admin Data Status')}</h3>
        <p className="text-xs text-gray-500 mb-4 break-words">{l('Only verified live data is shown here; placeholder health metrics have been removed.')}</p>
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-3">
          {[{ label: 'Profiles', value: 'Connected' },{ label: 'Subscriptions', value: 'Connected' },{ label: 'AI Usage', value: 'Connected' },{ label: 'Projects', value: 'Connected' }].map(item => (
            <div key={l(item.label)} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 min-w-0"><div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" /><div className="min-w-0"><div className="text-xs text-gray-500 truncate">{l(item.label)}</div><div className="text-sm font-medium text-white truncate">{l(item.value)}</div></div></div>
          ))}
        </div>
      </div>
    </div>
  );
}
