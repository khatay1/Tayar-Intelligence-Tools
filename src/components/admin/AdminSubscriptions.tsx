import { useState, useEffect } from 'react';
import { CreditCard, Loader2, RefreshCw, TrendingUp, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { BarChart } from './Charts';

interface SubRow {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  renewal_date: string | null;
  created_at: string;
}

export default function AdminSubscriptions() {
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from('subscriptions').select('id, user_id, plan, status, renewal_date, created_at').order('created_at', { ascending: false });
      setSubs((data || []) as SubRow[]);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-violet-500 animate-spin" /></div>;
  }

  const planPrices: Record<string, number> = { pro: 19, business: 49, enterprise: 99, free: 0 };
  const active = subs.filter(s => s.status === 'active');
  const revenue = active.reduce((sum, s) => sum + (planPrices[s.plan] || 0), 0);
  const renewals = active.filter(s => s.renewal_date && new Date(s.renewal_date) > new Date());
  const failed = subs.filter(s => s.status === 'expired' || s.status === 'canceled');

  const byPlan = ['free', 'pro', 'business', 'enterprise'].map(p => ({
    label: p, value: subs.filter(s => s.plan === p).length,
  }));

  const filtered = filter === 'all' ? subs : filter === 'active' ? active : filter === 'failed' ? failed : renewals;

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Monthly Revenue', value: `$${revenue}`, icon: TrendingUp, color: 'emerald' },
          { label: 'Active Subs', value: active.length, icon: CheckCircle, color: 'violet' },
          { label: 'Upcoming Renewals', value: renewals.length, icon: RefreshCw, color: 'blue' },
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
            <div key={s.label} className={`rounded-2xl border p-4 ${colors[s.color]}`}>
              <Icon className="w-5 h-5 mb-2" />
              <div className="text-2xl font-bold text-white">{s.value}</div>
              <div className="text-xs text-gray-400">{s.label}</div>
            </div>
          );
        })}
      </div>

      <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5">
        <h3 className="text-white font-semibold text-sm mb-4">Subscriptions by Plan</h3>
        <BarChart data={byPlan} color="#a78bfa" height={180} />
      </div>

      <div className="flex gap-2 flex-wrap">
        {['all', 'active', 'renewals', 'failed'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full capitalize transition-colors ${
              filter === f ? 'bg-violet-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">User ID</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Plan</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden sm:table-cell">Renewal Date</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden md:table-cell">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-300 font-mono">{s.user_id.slice(0, 8)}...</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      s.plan === 'pro' ? 'bg-fuchsia-500/10 text-fuchsia-400' :
                      s.plan === 'business' ? 'bg-cyan-500/10 text-cyan-400' :
                      s.plan === 'enterprise' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-gray-500/10 text-gray-400'
                    }`}>{s.plan}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`flex items-center gap-1 text-xs font-medium ${
                      s.status === 'active' ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {s.status === 'active' ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      {s.status}
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
        {filtered.length === 0 && <div className="py-8 text-center text-gray-500 text-sm">No subscriptions found</div>}
      </div>
    </div>
  );
}
