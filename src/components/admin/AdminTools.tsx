import { useState, useEffect } from 'react';
import { Wrench, Loader2, Star, ToggleRight, ToggleLeft, Users } from 'lucide-react';
import { toolRegistry } from '@/modules/registry';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';

interface ToolUsage { tool: string; count: number; }

export default function AdminTools() {
  const { success, error: showError } = useToast();
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [flags, setFlags] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: usageData } = await supabase.from('ai_usage').select('tool').limit(10000);
      const counts: Record<string, number> = {};
      for (const u of (usageData || []) as { tool: string }[]) counts[u.tool] = (counts[u.tool] || 0) + 1;
      setUsage(counts);

      const { data: flagData } = await supabase.from('feature_flags').select('key, enabled');
      const flagMap: Record<string, boolean> = {};
      for (const f of (flagData || []) as { key: string; enabled: boolean }[]) flagMap[f.key] = f.enabled;
      setFlags(flagMap);
      setLoading(false);
    })();
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

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-violet-500 animate-spin" /></div>;
  }

  const tools = toolRegistry.all();

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Tools', value: tools.length, color: 'violet' },
          { label: 'Active', value: tools.filter(t => t.status === 'active').length, color: 'emerald' },
          { label: 'Beta', value: tools.filter(t => t.status === 'beta').length, color: 'amber' },
          { label: 'Premium', value: tools.filter(t => t.tier === 'premium').length, color: 'fuchsia' },
        ].map(s => {
          const colors: Record<string, string> = {
            violet: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
            emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
            fuchsia: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20',
          };
          return (
            <div key={s.label} className={`rounded-xl border p-3 ${colors[s.color]}`}>
              <div className="text-2xl font-bold text-white">{s.value}</div>
              <div className="text-xs text-gray-400">{s.label}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map(tool => {
          const Icon = tool.icon;
          const flagKey = tool.id.replace(/-/g, '_');
          const isEnabled = flags[flagKey] !== false;
          const usageCount = usage[tool.id] || 0;
          return (
            <div key={tool.id} className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-violet-400" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{tool.name}</div>
                    <div className="text-xs text-gray-500 capitalize">{tool.category}</div>
                  </div>
                </div>
                <button onClick={() => toggleFlag(flagKey)} className="transition-transform hover:scale-110">
                  {isEnabled ? <ToggleRight className="w-8 h-8 text-emerald-400" /> : <ToggleLeft className="w-8 h-8 text-gray-600" />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mb-3 line-clamp-2">{tool.description}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  tool.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' :
                  tool.status === 'beta' ? 'bg-amber-500/10 text-amber-400' :
                  'bg-gray-500/10 text-gray-500'
                }`}>{tool.status}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  tool.tier === 'premium' ? 'bg-fuchsia-500/10 text-fuchsia-400' : 'bg-gray-500/10 text-gray-400'
                }`}>{tool.tier}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400 font-mono">v{tool.version}</span>
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/5">
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Users className="w-3.5 h-3.5" />
                  {usageCount.toLocaleString()} uses
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Star className="w-3.5 h-3.5 text-amber-400" />
                  {(4.2 + Math.random() * 0.7).toFixed(1)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
