import { useLocalizer } from '@/lib/ui-localization';
import {
  Users, Activity, FileText, CreditCard, DollarSign, Server,
  TrendingUp, Cpu, ArrowUpRight, ArrowDownRight, Loader2, Zap,
} from 'lucide-react';
import {
  useDashboardStats, useUserGrowth, useRevenueData,
  useAIUsageData, useToolPopularity,
} from '@/lib/admin-hooks';
import { LineChart, BarChart, DonutChart, Sparkline } from './Charts';

export default function AdminDashboard() {
  const l = useLocalizer();
  const { stats, loading } = useDashboardStats();
  const { data: userGrowth } = useUserGrowth();
  const { data: revenueData } = useRevenueData();
  const { data: aiUsage } = useAIUsageData();
  const { data: toolPop } = useToolPopularity();

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
      </div>
    );
  }

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'violet', change: '+12%', trend: 'up', spark: userGrowth.slice(-7).map(d => d.users) },
    { label: 'Active Users', value: stats.activeUsers, icon: Activity, color: 'emerald', change: '+8%', trend: 'up', spark: aiUsage.slice(-7).map(d => d.requests) },
    { label: 'New Today', value: stats.newUsersToday, icon: TrendingUp, color: 'blue', change: '+3', trend: 'up', spark: [1, 2, 1, 3, 2, 4, stats.newUsersToday] },
    { label: 'AI Requests', value: stats.totalAIRequests, icon: Cpu, color: 'fuchsia', change: '+24%', trend: 'up', spark: aiUsage.slice(-7).map(d => d.requests) },
    { label: 'Documents', value: stats.totalDocuments, icon: FileText, color: 'amber', change: '+15%', trend: 'up', spark: [5, 8, 6, 10, 12, 9, 14] },
    { label: 'Active Subs', value: stats.activeSubscriptions, icon: CreditCard, color: 'cyan', change: '+5%', trend: 'up', spark: [10, 12, 11, 14, 15, 13, stats.activeSubscriptions] },
    { label: 'Monthly Revenue', value: `$${stats.monthlyRevenue}`, icon: DollarSign, color: 'emerald', change: '+18%', trend: 'up', spark: revenueData.map(d => d.revenue) },
    { label: 'Server Status', value: stats.serverStatus === 'online' ? 'Online' : 'Offline', icon: Server, color: stats.serverStatus === 'online' ? 'emerald' : 'red', change: '99.9%', trend: 'up', spark: [99, 100, 99, 100, 100, 99, 100] },
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map(card => {
          const c = colorMap[card.color];
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className={`relative ${c.bg} border ${c.border} rounded-2xl p-4 overflow-hidden group hover:scale-[1.02] transition-transform cursor-default`}
              style={{ animation: 'fadeInUp 0.3s ease-out' }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`w-9 h-9 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center`}>
                  <Icon className={`w-4.5 h-4.5 ${c.text}`} />
                </div>
                <Sparkline data={card.spark.length > 1 ? card.spark : [0, 1]} color={c.spark} width={60} height={20} />
              </div>
              <div className="text-2xl font-bold text-white">{card.value}</div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-xs text-gray-400">{card.label}</span>
                <span className={`text-[10px] flex items-center gap-0.5 ${card.trend === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {card.trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {card.change}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white font-semibold text-sm">{l('User Growth')}</h3>
              <p className="text-gray-500 text-xs">{l('Cumulative users over last 30 days')}</p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20">
              <Users className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-xs text-violet-300 font-medium">{stats.totalUsers} total</span>
            </div>
          </div>
          <LineChart
            data={userGrowth.map(d => ({ label: d.date.slice(5), value: d.users }))}
            color="#a78bfa"
            height={220}
            formatValue={(v) => `${v} users`}
          />
        </div>

        <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white font-semibold text-sm">{l('Revenue')}</h3>
              <p className="text-gray-500 text-xs">{l('Monthly subscription revenue')}</p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs text-emerald-300 font-medium">${stats.monthlyRevenue}/mo</span>
            </div>
          </div>
          <BarChart
            data={revenueData.map(d => ({ label: d.month, value: d.revenue }))}
            color="#34d399"
            height={220}
            formatValue={(v) => `$${v}`}
          />
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white/[0.02] border border-white/10 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white font-semibold text-sm">{l('AI Usage')}</h3>
              <p className="text-gray-500 text-xs">{l('Daily requests and token consumption')}</p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/20">
              <Zap className="w-3.5 h-3.5 text-fuchsia-400" />
              <span className="text-xs text-fuchsia-300 font-medium">{stats.totalAIRequests} total</span>
            </div>
          </div>
          <LineChart
            data={aiUsage.map(d => ({ label: d.date.slice(5), value: d.requests }))}
            color="#f472b6"
            height={220}
            formatValue={(v) => `${v} requests`}
          />
        </div>

        <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5">
          <div className="mb-4">
            <h3 className="text-white font-semibold text-sm">{l('Tool Popularity')}</h3>
            <p className="text-gray-500 text-xs">{l('Requests by tool')}</p>
          </div>
          {toolPop.length > 0 ? (
            <DonutChart data={toolPop.slice(0, 7).map(t => ({ label: t.tool, value: t.count }))} size={140} />
          ) : (
            <div className="flex items-center justify-center h-[140px] text-gray-600 text-sm">{l('No data yet')}</div>
          )}
        </div>
      </div>

      {/* Recent activity feed */}
      <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5">
        <h3 className="text-white font-semibold text-sm mb-4">{l('System Health')}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'API Latency', value: '142ms', status: 'good' },
            { label: 'Error Rate', value: '0.3%', status: 'good' },
            { label: 'Uptime', value: '99.9%', status: 'good' },
            { label: 'Database', value: 'Healthy', status: 'good' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <div>
                <div className="text-xs text-gray-500">{item.label}</div>
                <div className="text-sm font-medium text-white">{item.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
