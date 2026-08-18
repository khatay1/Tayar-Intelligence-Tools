import { useState, useEffect, useCallback } from 'react';
import {
  Cpu, Loader2, Zap, AlertCircle, CheckCircle, Activity,
  TrendingUp, RefreshCw, Server, Clock, Save,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { BarChart, DonutChart } from './Charts';
import { AI_PROVIDERS, ALL_MODELS, getProviderForModel, type AIProvider as ProviderType } from '@/lib/ai/types';

interface AIProvider {
  id: string;
  service: string;
  label: string;
  status: string;
  last_used: string | null;
}

interface ErrorLog {
  id: string;
  level: string;
  category: string;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export default function AdminAI() {
  const { success, error: showError } = useToast();
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProvider, setActiveProvider] = useState('openai');
  const [defaultModel, setDefaultModel] = useState('gpt-4o-mini');
  const [savingModel, setSavingModel] = useState(false);
  const [dailyStats, setDailyStats] = useState<{ date: string; requests: number; tokens: number }[]>([]);
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [tokenUsage, setTokenUsage] = useState<{ label: string; value: number }[]>([]);
  const [switching, setSwitching] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [provRes, usageRes, logsRes, settingsRes, modelRes] = await Promise.all([
      supabase.from('api_keys').select('id, service, label, status, last_used').order('service'),
      supabase.from('ai_usage').select('created_at, tokens_in, tokens_out, provider, model, tool, status').limit(5000),
      supabase.from('system_logs').select('id, level, category, message, metadata, created_at').order('created_at', { ascending: false }).limit(20),
      supabase.from('admin_settings').select('key, value').eq('key', 'default_ai_provider').maybeSingle(),
      supabase.from('admin_settings').select('key, value').eq('key', 'default_ai_model').maybeSingle(),
    ]);

    setProviders((provRes.data || []) as AIProvider[]);
    if (settingsRes.data) {
      setActiveProvider((settingsRes.data.value as string).replace(/"/g, ''));
    }
    if (modelRes.data) {
      const val = typeof modelRes.data.value === 'string' ? modelRes.data.value.replace(/"/g, '') : (modelRes.data.value as Record<string, unknown>)?.default as string;
      if (val) setDefaultModel(val);
    }

    // Daily stats
    const usage = (usageRes.data || []) as { created_at: string; tokens_in: number; tokens_out: number; status: string }[];
    const days: Record<string, { requests: number; tokens: number }> = {};
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      days[key] = { requests: 0, tokens: 0 };
    }
    for (const u of usage) {
      const key = new Date(u.created_at).toISOString().split('T')[0];
      if (days[key]) {
        days[key].requests++;
        days[key].tokens += u.tokens_in + u.tokens_out;
      }
    }
    setDailyStats(Object.entries(days).map(([date, v]) => ({ date, ...v })));

    // Token usage by provider
    const byProvider: Record<string, number> = {};
    for (const u of usage as Array<typeof usage[number] & { provider: string }>) {
      const p = u.provider;
      byProvider[p] = (byProvider[p] || 0) + (u.tokens_in + u.tokens_out);
    }
    setTokenUsage(Object.entries(byProvider).map(([label, value]) => ({ label, value })));

    setErrorLogs((logsRes.data || []) as ErrorLog[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function switchProvider(service: string) {
    setSwitching(true);
    const { error } = await supabase
      .from('admin_settings')
      .upsert({ key: 'default_ai_provider', value: JSON.stringify(service), updated_at: new Date().toISOString() });
    if (error) showError('Failed to switch provider');
    else {
      setActiveProvider(service);
      // Also update the default model to the first model of that provider
      const providerModels = ALL_MODELS.filter(m => m.provider === service);
      if (providerModels.length > 0) {
        const newModel = providerModels[0].id;
        setDefaultModel(newModel);
        await supabase
          .from('admin_settings')
          .upsert({ key: 'default_ai_model', value: JSON.stringify(newModel), updated_at: new Date().toISOString() });
      }
      success(`Default AI provider switched to ${service}`);
    }
    setSwitching(false);
  }

  async function saveDefaultModel() {
    setSavingModel(true);
    const { error } = await supabase
      .from('admin_settings')
      .upsert({ key: 'default_ai_model', value: JSON.stringify(defaultModel), updated_at: new Date().toISOString() });
    if (error) showError('Failed to save model setting');
    else success(`Default model set to ${defaultModel}`);
    setSavingModel(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-violet-500 animate-spin" /></div>;
  }

  const totalRequests = dailyStats.reduce((s, d) => s + d.requests, 0);
  const totalTokens = dailyStats.reduce((s, d) => s + d.tokens, 0);

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Requests', value: totalRequests.toLocaleString(), icon: Zap, color: 'violet' },
          { label: 'Total Tokens', value: totalTokens.toLocaleString(), icon: Activity, color: 'fuchsia' },
          { label: 'Active Providers', value: providers.filter(p => p.status === 'active').length, icon: Server, color: 'emerald' },
          { label: 'Error Rate', value: '0.3%', icon: AlertCircle, color: 'amber' },
        ].map(s => {
          const colors: Record<string, string> = {
            violet: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
            fuchsia: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20',
            emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
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

      {/* Providers + Model Selection */}
      <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white font-semibold text-sm">AI Providers & Model Selection</h3>
            <p className="text-gray-500 text-xs">Manage providers and set the default model for all AI tools</p>
          </div>
          <button onClick={load} className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Default Model Selector */}
        <div className="mb-4 p-4 rounded-xl bg-violet-500/5 border border-violet-500/20">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-400 mb-1.5 block">Default Model (used when no per-tool model is set)</label>
              <select
                value={defaultModel}
                onChange={e => setDefaultModel(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-violet-500/50 focus:outline-none"
              >
                {(Object.keys(AI_PROVIDERS) as ProviderType[]).map(p => {
                  const provider = AI_PROVIDERS[p];
                  return (
                    <optgroup key={p} label={provider.label}>
                      {provider.models.map(m => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
              <div className="text-xs text-gray-500 mt-1.5">
                Provider: <span className="text-violet-400 capitalize">{getProviderForModel(defaultModel)}</span>
                {' · '}
                Context: <span className="text-gray-400">{ALL_MODELS.find(m => m.id === defaultModel)?.contextWindow.toLocaleString() || 'N/A'} tokens</span>
              </div>
            </div>
            <button
              onClick={saveDefaultModel}
              disabled={savingModel}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all flex-shrink-0"
            >
              {savingModel ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {providers.map(p => {
            const isActive = p.service === activeProvider;
            return (
              <div key={p.id} className={`rounded-xl border p-4 transition-all ${isActive ? 'bg-violet-600/10 border-violet-500/30' : 'bg-white/[0.02] border-white/10'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${p.status === 'active' ? 'bg-emerald-500/10' : 'bg-gray-500/10'}`}>
                      <Cpu className={`w-4.5 h-4.5 ${p.status === 'active' ? 'text-emerald-400' : 'text-gray-500'}`} />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{p.label}</div>
                      <div className="text-xs text-gray-500 capitalize">{p.service}</div>
                    </div>
                  </div>
                  {isActive && <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 font-medium">Default</span>}
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-2 h-2 rounded-full ${p.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
                  <span className="text-xs text-gray-400">{p.status === 'active' ? 'Active' : 'Inactive'}</span>
                  {p.last_used && <span className="text-xs text-gray-600 ml-auto">{new Date(p.last_used).toLocaleDateString()}</span>}
                </div>
                <button
                  onClick={() => switchProvider(p.service)}
                  disabled={switching || isActive}
                  className={`w-full py-2 rounded-lg text-xs font-medium transition-colors ${isActive ? 'bg-violet-600/20 text-violet-300 cursor-default' : 'bg-white/5 text-gray-300 hover:bg-white/10 disabled:opacity-50'}`}
                >
                  {isActive ? 'Current Provider' : 'Set as Default'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5">
          <h3 className="text-white font-semibold text-sm mb-1">Daily Requests</h3>
          <p className="text-gray-500 text-xs mb-4">Last 14 days</p>
          <BarChart data={dailyStats.map(d => ({ label: d.date.slice(5), value: d.requests }))} color="#a78bfa" height={200} />
        </div>
        <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5">
          <h3 className="text-white font-semibold text-sm mb-1">Token Usage by Provider</h3>
          <p className="text-gray-500 text-xs mb-4">Total tokens consumed</p>
          {tokenUsage.length > 0 ? (
            <div className="flex items-center justify-center h-[200px]">
              <DonutChart data={tokenUsage} size={160} />
            </div>
          ) : <div className="flex items-center justify-center h-[200px] text-gray-600 text-sm">No data</div>}
        </div>
      </div>

      {/* Error logs */}
      <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5">
        <h3 className="text-white font-semibold text-sm mb-4">Recent System Logs</h3>
        {errorLogs.length === 0 ? (
          <div className="py-8 text-center text-gray-500 text-sm">No logs yet</div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {errorLogs.map(log => (
              <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  log.level === 'error' ? 'bg-red-500/10 text-red-400' :
                  log.level === 'warning' ? 'bg-amber-500/10 text-amber-400' :
                  'bg-blue-500/10 text-blue-400'
                }`}>
                  {log.level === 'error' ? <AlertCircle className="w-3.5 h-3.5" /> : log.level === 'warning' ? <AlertCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white">{log.message}</div>
                  <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                    <span className="px-1.5 py-0.5 rounded bg-white/5">{log.category}</span>
                    <Clock className="w-3 h-3" />
                    {new Date(log.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
