import { useLocalizer } from '@/lib/ui-localization';
import { useEffect, useState } from 'react';
import { AlertTriangle, Gauge, Loader2, RefreshCw, ToggleRight, ToggleLeft, Users, ShieldCheck } from 'lucide-react';
import { toolRegistry } from '@/modules/registry';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import TemplateLibraryAuditCard from './TemplateLibraryAuditCard';

type ToolPlan = 'free' | 'pro' | 'business';
type LimitPeriod = 'daily' | 'monthly' | 'lifetime';
interface ToolAccessRule { tool_id: string; minimum_plan: ToolPlan; enabled: boolean; }
interface ToolPlanLimit { tool_id: string; free_limit: number | null; pro_limit: number | null; business_limit: number | null; period: LimitPeriod; }
interface ToolUsageSummary { tool_id: string; usage_count: number | string; }

export default function AdminTools() {
  const l = useLocalizer();
  const { success, error: showError } = useToast();
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accessRules, setAccessRules] = useState<Record<string, ToolAccessRule>>({});
  const [limits, setLimits] = useState<Record<string, ToolPlanLimit>>({});
  const [savingEnabled, setSavingEnabled] = useState<string | null>(null);
  const [savingPlan, setSavingPlan] = useState<string | null>(null);
  const [savingLimit, setSavingLimit] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true); setLoadError(null);
      const [usageRes, accessRes, limitRes] = await Promise.all([
        supabase.rpc('admin_tool_usage_summary'),
        supabase.from('tool_access_rules').select('tool_id, minimum_plan, enabled'),
        supabase.from('tool_plan_limits').select('tool_id, free_limit, pro_limit, business_limit, period'),
      ]);
      if (!active) return;
      const queryError = usageRes.error || accessRes.error || limitRes.error;
      if (queryError) { setLoadError(queryError.message || 'Failed to load tools administration data.'); setLoading(false); return; }
      const counts: Record<string, number> = {};
      for (const row of (usageRes.data || []) as ToolUsageSummary[]) counts[row.tool_id] = Number(row.usage_count) || 0;
      setUsage(counts);
      const ruleMap: Record<string, ToolAccessRule> = {};
      for (const rule of (accessRes.data || []) as ToolAccessRule[]) ruleMap[rule.tool_id] = rule;
      setAccessRules(ruleMap);
      const limitMap: Record<string, ToolPlanLimit> = {};
      for (const row of (limitRes.data || []) as ToolPlanLimit[]) limitMap[row.tool_id] = row;
      setLimits(limitMap); setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  async function toggleToolEnabled(toolId: string, minimumPlan: ToolPlan, currentEnabled: boolean) {
    setSavingEnabled(toolId);
    const previous = accessRules[toolId];
    const enabled = !currentEnabled;
    setAccessRules(prev => ({ ...prev, [toolId]: { tool_id: toolId, minimum_plan: minimumPlan, enabled } }));
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('tool_access_rules').upsert({ tool_id: toolId, minimum_plan: minimumPlan, enabled, updated_at: new Date().toISOString(), updated_by: user?.id || null }, { onConflict: 'tool_id' });
    if (error) {
      setAccessRules(prev => { const next = { ...prev }; if (previous) next[toolId] = previous; else delete next[toolId]; return next; });
      showError(l('Failed to toggle tool'));
    } else success(`${toolId} ${enabled ? l('enabled') : l('disabled')}`);
    setSavingEnabled(null);
  }

  function defaultPlanFor(tool: ReturnType<typeof toolRegistry.all>[number]): ToolPlan {
    if (tool.id === 'team-workspace') return 'business';
    return tool.tier === 'premium' ? 'pro' : 'free';
  }
  function defaultLimitFor(toolId: string): ToolPlanLimit { return { tool_id: toolId, free_limit: 25, pro_limit: 250, business_limit: 1000, period: 'monthly' }; }

  async function setToolPlan(toolId: string, plan: ToolPlan) {
    setSavingPlan(toolId);
    const previous = accessRules[toolId];
    const enabled = previous?.enabled ?? true;
    setAccessRules(prev => ({ ...prev, [toolId]: { tool_id: toolId, minimum_plan: plan, enabled } }));
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('tool_access_rules').upsert({ tool_id: toolId, minimum_plan: plan, enabled, updated_at: new Date().toISOString(), updated_by: user?.id || null }, { onConflict: 'tool_id' });
    if (error) {
      setAccessRules(prev => { const next = { ...prev }; if (previous) next[toolId] = previous; else delete next[toolId]; return next; });
      showError(l('Failed to update tool plan'));
    } else success(`${toolId} → ${plan.toUpperCase()}`);
    setSavingPlan(null);
  }

  function normalizeLimit(value: string): number | null {
    const trimmed = value.trim(); if (trimmed === '') return null;
    const parsed = Number(trimmed); if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.floor(parsed));
  }

  async function saveToolLimits(toolId: string, next: ToolPlanLimit) {
    setSavingLimit(toolId);
    const previous = limits[toolId]; setLimits(prev => ({ ...prev, [toolId]: next }));
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('tool_plan_limits').upsert({ tool_id: toolId, free_limit: next.free_limit, pro_limit: next.pro_limit, business_limit: next.business_limit, period: next.period, updated_at: new Date().toISOString(), updated_by: user?.id || null }, { onConflict: 'tool_id' });
    if (error) {
      setLimits(prev => { const copy = { ...prev }; if (previous) copy[toolId] = previous; else delete copy[toolId]; return copy; });
      showError(l('Failed to update usage limits'));
    } else success(`${toolId} ${l('usage limits updated')}`);
    setSavingLimit(null);
  }

  function patchLimit(toolId: string, patch: Partial<ToolPlanLimit>) {
    const current = limits[toolId] || defaultLimitFor(toolId);
    const next = { ...current, ...patch };
    setLimits(prev => ({ ...prev, [toolId]: next }));
    return next;
  }

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-violet-500" /></div>;
  if (loadError) return <div className="mx-auto max-w-xl rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-center sm:p-6"><AlertTriangle className="mx-auto mb-3 h-8 w-8 text-red-400" /><h2 className="mb-2 font-semibold text-white">{l('Tools data unavailable')}</h2><p className="mb-4 break-words text-sm text-gray-400">{loadError}</p><button onClick={() => window.location.reload()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"><RefreshCw className="h-4 w-4" />{l('Retry')}</button></div>;

  const tools = toolRegistry.all();
  const configured = tools.filter(tool => (accessRules[tool.id]?.minimum_plan || defaultPlanFor(tool)) !== 'free').length;

  return (
    <div className="mx-auto max-w-7xl min-w-0 space-y-5 overflow-x-hidden">
      <TemplateLibraryAuditCard />
      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
        {[
          { label: 'Total Tools', value: tools.length, color: 'violet' },
          { label: 'Active', value: tools.filter(t => t.status === 'active').length, color: 'emerald' },
          { label: 'Paid Access', value: configured, color: 'fuchsia' },
          { label: 'Tool Uses', value: Object.values(usage).reduce((a, b) => a + b, 0), color: 'amber' },
        ].map(s => {
          const colors: Record<string, string> = { violet: 'bg-violet-500/10 text-violet-400 border-violet-500/20', emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20', fuchsia: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20' };
          return <div key={s.label} className={`min-w-0 rounded-xl border p-3 ${colors[s.color]}`}><div className="text-xl font-bold text-white sm:text-2xl">{s.value.toLocaleString()}</div><div className="truncate text-[11px] text-gray-400 sm:text-xs">{l(s.label)}</div></div>;
        })}
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-violet-500/20 bg-violet-500/[0.05] p-3 sm:p-4"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-violet-300" /><div className="min-w-0"><div className="text-sm font-semibold text-white">{l('Tool plan access & limits')}</div><p className="mt-1 break-words text-xs leading-5 text-gray-400">{l('Choose which plan can access each tool and how many times Free, Pro and Business users can open it per day, month or lifetime. Leave a limit empty for unlimited use.')}</p></div></div>

      <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-2">
        {tools.map(tool => {
          const Icon = tool.icon;
          const selectedPlan = accessRules[tool.id]?.minimum_plan || defaultPlanFor(tool);
          const isEnabled = accessRules[tool.id]?.enabled ?? true;
          const usageCount = usage[tool.id] || 0;
          const limit = limits[tool.id] || defaultLimitFor(tool.id);
          return (
            <div key={tool.id} className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.02] p-3 transition-colors hover:border-white/20 sm:p-5">
              <div className="mb-3 flex items-start justify-between gap-2 sm:gap-3"><div className="flex min-w-0 items-center gap-2 sm:gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10"><Icon className="h-5 w-5 text-violet-400" /></div><div className="min-w-0"><div className="truncate text-sm font-semibold text-white">{l(tool.name)}</div><div className="truncate text-xs capitalize text-gray-500">{l(tool.category)}</div></div></div><button onClick={() => void toggleToolEnabled(tool.id, selectedPlan, isEnabled)} disabled={savingEnabled === tool.id} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-white/5 disabled:opacity-50" aria-label={l(isEnabled ? 'Disable tool' : 'Enable tool')}>{savingEnabled === tool.id ? <Loader2 className="h-6 w-6 animate-spin text-violet-400" /> : isEnabled ? <ToggleRight className="h-8 w-8 text-emerald-400" /> : <ToggleLeft className="h-8 w-8 text-gray-600" />}</button></div>
              <p className="mb-4 line-clamp-3 text-xs leading-5 text-gray-400 sm:line-clamp-2">{l(tool.description)}</p>

              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-0"><label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">{l('Minimum plan')}</label><select value={selectedPlan} disabled={savingPlan === tool.id || savingEnabled === tool.id} onChange={e => void setToolPlan(tool.id, e.target.value as ToolPlan)} className="min-h-11 w-full rounded-xl border border-white/10 bg-[#101020] px-3 py-2.5 text-sm font-semibold text-white outline-none focus:border-violet-500/50 disabled:opacity-60"><option value="free">Free</option><option value="pro">Pro</option><option value="business">Business</option></select></div>
                <div className="min-w-0"><label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">{l('Reset period')}</label><select value={limit.period} onChange={e => patchLimit(tool.id, { period: e.target.value as LimitPeriod })} className="min-h-11 w-full rounded-xl border border-white/10 bg-[#101020] px-3 py-2.5 text-sm text-white sm:w-36"><option value="daily">Daily</option><option value="monthly">Monthly</option><option value="lifetime">Lifetime</option></select></div>
              </div>

              <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
                {(['free','pro','business'] as const).map(plan => {
                  const key = `${plan}_limit` as 'free_limit' | 'pro_limit' | 'business_limit';
                  return <label key={plan} className="min-w-0 rounded-xl border border-white/10 bg-black/10 p-3"><span className="mb-1.5 block truncate text-[10px] font-bold uppercase tracking-wider text-gray-500">{plan} {l('uses')}</span><input inputMode="numeric" type="number" min="0" placeholder={l('Unlimited')} value={limit[key] ?? ''} onChange={e => patchLimit(tool.id, { [key]: normalizeLimit(e.target.value) } as Partial<ToolPlanLimit>)} className="min-h-11 w-full min-w-0 rounded-lg border border-white/10 bg-[#0d0d1a] px-3 text-sm font-semibold text-white outline-none focus:border-violet-500/50" /></label>;
                })}
              </div>

              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-2 text-xs text-gray-400"><Gauge className="h-4 w-4 shrink-0 text-amber-400" /><span className="truncate">{usageCount.toLocaleString()} {l('recorded launches')}</span></div><button onClick={() => void saveToolLimits(tool.id, limit)} disabled={savingLimit === tool.id} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-60 sm:w-auto">{savingLimit === tool.id && <Loader2 className="h-4 w-4 animate-spin" />}{l('Save limits')}</button></div>

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${tool.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : tool.status === 'beta' ? 'bg-amber-500/10 text-amber-400' : 'bg-gray-500/10 text-gray-500'}`}>{l(tool.status)}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${selectedPlan === 'business' ? 'bg-cyan-500/10 text-cyan-300' : selectedPlan === 'pro' ? 'bg-fuchsia-500/10 text-fuchsia-400' : 'bg-gray-500/10 text-gray-400'}`}>{selectedPlan.toUpperCase()}</span><span className="rounded-full bg-white/5 px-2 py-0.5 font-mono text-[10px] text-gray-400">v{tool.version}</span><span className="inline-flex items-center gap-1 text-[10px] text-gray-500 sm:ml-auto"><Users className="h-3 w-3" />{l('live quota')}</span></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
