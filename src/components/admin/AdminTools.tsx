import { useLocalizer } from '@/lib/ui-localization';
import { useState, useEffect } from 'react';
import { AlertTriangle, Loader2, RefreshCw, ToggleRight, ToggleLeft, Users, ShieldCheck } from 'lucide-react';
import { toolRegistry } from '@/modules/registry';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import TemplateLibraryAuditCard from './TemplateLibraryAuditCard';

type ToolPlan = 'free' | 'pro' | 'business';
interface ToolAccessRule { tool_id: string; minimum_plan: ToolPlan; enabled: boolean; }

export default function AdminTools() {
  const l = useLocalizer();
  const { success, error: showError } = useToast();
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [accessRules, setAccessRules] = useState<Record<string, ToolAccessRule>>({});
  const [savingPlan, setSavingPlan] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setLoadError(null);

      const [usageRes, flagRes, accessRes] = await Promise.all([
        supabase.from('ai_usage').select('tool').limit(10000),
        supabase.from('feature_flags').select('key, enabled'),
        supabase.from('tool_access_rules').select('tool_id, minimum_plan, enabled'),
      ]);

      if (!active) return;
      const queryError = usageRes.error || flagRes.error || accessRes.error;
      if (queryError) {
        console.error('Failed to load admin tools data:', queryError);
        setLoadError(queryError.message || 'Failed to load tools administration data.');
        setLoading(false);
        return;
      }

      const counts: Record<string, number> = {};
      for (const u of (usageRes.data || []) as { tool: string }[]) counts[u.tool] = (counts[u.tool] || 0) + 1;
      setUsage(counts);

      const flagMap: Record<string, boolean> = {};
      for (const f of (flagRes.data || []) as { key: string; enabled: boolean }[]) flagMap[f.key] = f.enabled;
      setFlags(flagMap);

      const ruleMap: Record<string, ToolAccessRule> = {};
      for (const rule of (accessRes.data || []) as ToolAccessRule[]) ruleMap[rule.tool_id] = rule;
      setAccessRules(ruleMap);
      setLoading(false);
    })();

    return () => { active = false; };
  }, []);

  async function toggleFlag(key: string) {
    const newVal = !flags[key];
    setFlags(prev => ({ ...prev, [key]: newVal }));
    const { error } = await supabase.from('feature_flags').upsert({
      key, enabled: newVal, updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });
    if (error) {
      setFlags(prev => ({ ...prev, [key]: !newVal }));
      showError('Failed to toggle feature');
    } else {
      success(`${key} ${newVal ? 'enabled' : 'disabled'}`);
    }
  }

  function defaultPlanFor(tool: ReturnType<typeof toolRegistry.all>[number]): ToolPlan {
    if (tool.id === 'team-workspace') return 'business';
    return tool.tier === 'premium' ? 'pro' : 'free';
  }

  async function setToolPlan(toolId: string, plan: ToolPlan, fallbackEnabled: boolean) {
    setSavingPlan(toolId);
    const previous = accessRules[toolId];
    setAccessRules(prev => ({ ...prev, [toolId]: { tool_id: toolId, minimum_plan: plan, enabled: previous?.enabled ?? fallbackEnabled } }));
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('tool_access_rules').upsert({
      tool_id: toolId,
      minimum_plan: plan,
      enabled: previous?.enabled ?? fallbackEnabled,
      updated_at: new Date().toISOString(),
      updated_by: user?.id || null,
    }, { onConflict: 'tool_id' });
    if (error) {
      setAccessRules(prev => {
        const next = { ...prev };
        if (previous) next[toolId] = previous; else delete next[toolId];
        return next;
      });
      showError(l('Failed to update tool plan'));
    } else {
      success(`${toolId} → ${plan.toUpperCase()}`);
    }
    setSavingPlan(null);
  }

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-violet-500 animate-spin" /></div>;

  if (loadError) {
    return (
      <div className="max-w-xl mx-auto rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
        <h2 className="text-white font-semibold mb-2">{l('Tools data unavailable')}</h2>
        <p className="text-sm text-gray-400 mb-4 break-words">{loadError}</p>
        <button onClick={() => window.location.reload()} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500">
          <RefreshCw className="w-4 h-4" /> {l('Retry')}
        </button>
      </div>
    );
  }

  const tools = toolRegistry.all();
  const configured = tools.filter(tool => (accessRules[tool.id]?.minimum_plan || defaultPlanFor(tool)) !== 'free').length;

  return (
    <div className="space-y-5 max-w-7xl mx-auto min-w-0">
      <TemplateLibraryAuditCard />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Tools', value: tools.length, color: 'violet' },
          { label: 'Active', value: tools.filter(t => t.status === 'active').length, color: 'emerald' },
          { label: 'Beta', value: tools.filter(t => t.status === 'beta').length, color: 'amber' },
          { label: 'Paid Access', value: configured, color: 'fuchsia' },
        ].map(s => {
          const colors: Record<string, string> = {
            violet: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
            emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
            fuchsia: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20',
          };
          return <div key={s.label} className={`rounded-xl border p-3 min-w-0 ${colors[s.color]}`}><div className="text-2xl font-bold text-white">{s.value}</div><div className="text-xs text-gray-400">{l(s.label)}</div></div>;
        })}
      </div>

      <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.05] p-4 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-violet-300 shrink-0 mt-0.5" />
        <div className="min-w-0"><div className="text-sm font-semibold text-white">{l('Tool plan access')}</div><p className="text-xs leading-5 text-gray-400 mt-1">{l('Choose the minimum subscription required for each tool. Business includes Pro and Free access; Pro includes Free access.')}</p></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map(tool => {
          const Icon = tool.icon;
          const flagKey = tool.id.replace(/-/g, '_');
          const isEnabled = flags[flagKey] !== false;
          const usageCount = usage[tool.id] || 0;
          const selectedPlan = accessRules[tool.id]?.minimum_plan || defaultPlanFor(tool);
          return (
            <div key={tool.id} className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 sm:p-5 hover:border-white/20 transition-colors min-w-0">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0"><Icon className="w-5 h-5 text-violet-400" /></div>
                  <div className="min-w-0"><div className="text-sm font-semibold text-white truncate">{l(tool.name)}</div><div className="text-xs text-gray-500 capitalize truncate">{l(tool.category)}</div></div>
                </div>
                <button onClick={() => toggleFlag(flagKey)} className="transition-transform hover:scale-110 shrink-0" aria-label={l(isEnabled ? 'Disable tool' : 'Enable tool')}>{isEnabled ? <ToggleRight className="w-8 h-8 text-emerald-400" /> : <ToggleLeft className="w-8 h-8 text-gray-600" />}</button>
              </div>
              <p className="text-xs text-gray-400 mb-4 line-clamp-2">{l(tool.description)}</p>

              <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">{l('Minimum plan')}</label>
              <div className="relative">
                <select value={selectedPlan} disabled={savingPlan === tool.id} onChange={e => void setToolPlan(tool.id, e.target.value as ToolPlan, isEnabled)} className="w-full min-h-11 rounded-xl border border-white/10 bg-[#101020] px-3 py-2.5 text-sm font-semibold text-white outline-none focus:border-violet-500/50 disabled:opacity-60">
                  <option value="free">Free</option><option value="pro">Pro</option><option value="business">Business</option>
                </select>
                {savingPlan === tool.id && <Loader2 className="absolute right-9 top-3 w-4 h-4 animate-spin text-violet-400" />}
              </div>

              <div className="flex items-center gap-2 flex-wrap mt-3">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${tool.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : tool.status === 'beta' ? 'bg-amber-500/10 text-amber-400' : 'bg-gray-500/10 text-gray-500'}`}>{l(tool.status)}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${selectedPlan === 'business' ? 'bg-cyan-500/10 text-cyan-300' : selectedPlan === 'pro' ? 'bg-fuchsia-500/10 text-fuchsia-400' : 'bg-gray-500/10 text-gray-400'}`}>{selectedPlan.toUpperCase()}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400 font-mono">v{tool.version}</span>
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/5 min-w-0"><div className="flex items-center gap-1.5 text-xs text-gray-400"><Users className="w-3.5 h-3.5 shrink-0" />{usageCount.toLocaleString()} {l('uses')}</div><div className="text-xs text-gray-500 truncate">{l('Live usage data')}</div></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
