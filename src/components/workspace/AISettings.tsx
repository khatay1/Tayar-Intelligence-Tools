import { useState, useEffect, useCallback } from 'react';
import { Cpu, Check, Loader2, Save, Thermometer, Hash } from 'lucide-react';
import { AI_PROVIDERS, AIProvider, ALL_MODELS, getDefaultModel } from '@/lib/ai/types';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';

const TOOL_LABELS: Record<string, string> = {
  'cv-builder': 'CV Builder',
  'cover-letter': 'Cover Letter',
  'ai-writer': 'AI Writer',
  'document-ai': 'Document AI',
  'study-assistant': 'Study Assistant',
  'translator': 'Translator',
  'ai-chat': 'AI Chat',
};

const TOOLS = Object.keys(TOOL_LABELS);

interface ToolSettings {
  model: string;
  temperature: number;
  max_tokens: number;
}

interface AISettingsProps {
  darkMode: boolean;
}

export default function AISettings({ darkMode: _darkMode }: AISettingsProps) {
  const { success, error, loading, update } = useToast();
  const [settings, setSettings] = useState<Record<string, ToolSettings>>({});
  const [loadingState, setLoadingState] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    const prefs: Record<string, ToolSettings> = {};
    for (const tool of TOOLS) {
      prefs[tool] = { model: getDefaultModel(tool), temperature: 0.7, max_tokens: 4096 };
    }
    try {
      const { data } = await supabase.from('ai_settings').select('tool, model, temperature, max_tokens');
      if (data) {
        for (const row of data) {
          if (prefs[row.tool]) {
            prefs[row.tool] = {
              model: row.model || prefs[row.tool].model,
              temperature: row.temperature ?? 0.7,
              max_tokens: row.max_tokens ?? 4096,
            };
          }
        }
      }
    } catch { /* use defaults */ }
    setSettings(prefs);
    setLoadingState(false);
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  async function handleSave() {
    setSaving(true);
    const toastId = loading('Saving AI settings...');
    try {
      const upserts = TOOLS.map(tool => ({
        tool,
        model: settings[tool].model,
        temperature: settings[tool].temperature,
        max_tokens: settings[tool].max_tokens,
      }));
      const { error: err } = await supabase.from('ai_settings').upsert(upserts, { onConflict: 'tool' });
      if (err) {
        update(toastId, 'Failed to save settings', 'error');
        error('Failed to save');
      } else {
        update(toastId, 'AI settings saved', 'success');
        success('Settings saved');
      }
    } catch {
      update(toastId, 'Failed to save settings', 'error');
    }
    setSaving(false);
  }

  function updateTool(tool: string, field: keyof ToolSettings, value: string | number) {
    setSettings(prev => ({
      ...prev,
      [tool]: { ...prev[tool], [field]: value },
    }));
  }

  function groupModelsByProvider() {
    const groups: Record<string, typeof ALL_MODELS> = {};
    for (const model of ALL_MODELS) {
      if (!groups[model.provider]) groups[model.provider] = [];
      groups[model.provider].push(model);
    }
    return groups;
  }

  if (loadingState) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
      </div>
    );
  }

  const grouped = groupModelsByProvider();

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">AI Settings</h1>
          <p className="text-gray-500 text-sm">Configure model, temperature, and token limits for each tool.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all active:scale-95"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save
        </button>
      </div>

      {/* Provider cards */}
      <div className="grid sm:grid-cols-3 gap-3">
        {(Object.keys(AI_PROVIDERS) as AIProvider[]).map(providerKey => {
          const config = AI_PROVIDERS[providerKey];
          const colors: Record<string, string> = {
            openai: 'from-emerald-500 to-green-600',
            anthropic: 'from-orange-500 to-amber-600',
            gemini: 'from-blue-500 to-sky-600',
          };
          return (
            <div key={providerKey} className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-4">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors[providerKey]} flex items-center justify-center mb-3`}>
                <Cpu className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-white text-sm font-semibold">{config.label}</h3>
              <p className="text-gray-500 text-xs mt-0.5">{config.models.length} models available</p>
            </div>
          );
        })}
      </div>

      {/* Per-tool settings */}
      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-6">
        <h2 className="text-white font-bold text-base mb-4">Model Configuration</h2>
        <div className="space-y-5">
          {TOOLS.map(tool => (
            <div key={tool} className="border-b border-white/5 pb-4 last:border-0 last:pb-0">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="text-white text-sm font-medium">{TOOL_LABELS[tool]}</label>
                    <p className="text-gray-500 text-xs">Model and generation parameters</p>
                  </div>
                  <select
                    value={settings[tool]?.model || getDefaultModel(tool)}
                    onChange={e => updateTool(tool, 'model', e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:border-violet-500/50 focus:outline-none cursor-pointer min-w-[200px]"
                  >
                    {(Object.keys(grouped) as AIProvider[]).map(providerKey => (
                      <optgroup key={providerKey} label={AI_PROVIDERS[providerKey].label}>
                        {grouped[providerKey].map(model => (
                          <option key={model.id} value={model.id}>{model.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                {/* Temperature slider */}
                <div className="flex items-center gap-3">
                  <Thermometer className="w-4 h-4 text-violet-400 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-400 text-xs">Temperature</span>
                      <span className="text-violet-300 text-xs font-medium">{(settings[tool]?.temperature ?? 0.7).toFixed(1)}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={2}
                      step={0.1}
                      value={settings[tool]?.temperature ?? 0.7}
                      onChange={e => updateTool(tool, 'temperature', parseFloat(e.target.value))}
                      className="w-full accent-violet-600 h-1.5"
                    />
                    <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
                      <span>Precise</span><span>Balanced</span><span>Creative</span>
                    </div>
                  </div>
                </div>

                {/* Max tokens */}
                <div className="flex items-center gap-3">
                  <Hash className="w-4 h-4 text-violet-400 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-400 text-xs">Max Output Tokens</span>
                      <span className="text-violet-300 text-xs font-medium">{settings[tool]?.max_tokens ?? 4096}</span>
                    </div>
                    <input
                      type="range"
                      min={256}
                      max={16384}
                      step={256}
                      value={settings[tool]?.max_tokens ?? 4096}
                      onChange={e => updateTool(tool, 'max_tokens', parseInt(e.target.value))}
                      className="w-full accent-violet-600 h-1.5"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Current selection summary */}
      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span className="text-white text-sm font-medium">Current Configuration</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {TOOLS.map(tool => (
            <span key={tool} className="text-xs bg-violet-500/10 text-violet-300 px-2.5 py-1 rounded-full">
              {TOOL_LABELS[tool]}: {ALL_MODELS.find(m => m.id === settings[tool]?.model)?.label || 'Default'} · {(settings[tool]?.temperature ?? 0.7).toFixed(1)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
