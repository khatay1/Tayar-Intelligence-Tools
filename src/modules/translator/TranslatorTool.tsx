import { useState } from 'react';
import { Languages, Loader2, Copy, Check, ArrowRight } from 'lucide-react';
import { ToolShell, ToolInputPanel, ToolOutputPanel, ToolField, toolInputClass, toolButtonClass } from '../shared/ToolShell';
import { createAIService } from '@/lib/ai/service';
import { useToast } from '@/components/ui/Toast';

const LANGUAGES = [
  'Auto-detect', 'English', 'Arabic', 'Swedish', 'Spanish', 'French', 'German',
  'Italian', 'Portuguese', 'Dutch', 'Russian', 'Chinese', 'Japanese', 'Korean',
  'Hindi', 'Turkish', 'Polish', 'Hindi', 'Urdu', 'Persian', 'Hebrew', 'Thai', 'Vietnamese',
];

export default function TranslatorTool({ darkMode: _darkMode }: { darkMode: boolean }) {
  const { loading, update } = useToast();
  const [from, setFrom] = useState('Auto-detect');
  const [to, setTo] = useState('English');
  const [text, setText] = useState('');
  const [result, setResult] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleTranslate() {
    if (!text) return;
    setGenerating(true);
    setResult('');
    const toastId = loading('Translating...');
    try {
      const ai = createAIService('translator');
      await ai.stream(
        { action: 'translate', from, to, text },
        [],
        (chunk) => setResult(prev => prev + chunk)
      );
      update(toastId, 'Translation complete', 'success');
    } catch (err) {
      update(toastId, (err as Error).message, 'error');
    }
    setGenerating(false);
  }

  function copyResult() {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function swapLanguages() {
    if (from === 'Auto-detect') return;
    setFrom(to);
    setTo(from);
    setText(result);
    setResult(text);
  }

  return (
    <ToolShell icon={Languages} title="AI Translator" description="Translate between 100+ languages naturally." badge="v2.0">
      <div className="grid lg:grid-cols-2 gap-6">
        <ToolInputPanel>
          <div className="flex items-end gap-2">
            <ToolField label="From">
              <select value={from} onChange={e => setFrom(e.target.value)} className={toolInputClass}>
                {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </ToolField>
            <button onClick={swapLanguages} className="p-2.5 mb-0.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all flex-shrink-0">
              <ArrowRight className="w-4 h-4" />
            </button>
            <ToolField label="To">
              <select value={to} onChange={e => setTo(e.target.value)} className={toolInputClass}>
                {LANGUAGES.filter(l => l !== 'Auto-detect').map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </ToolField>
          </div>
          <ToolField label="Text to Translate">
            <textarea value={text} onChange={e => setText(e.target.value)} className={`${toolInputClass} min-h-[160px] resize-y`} placeholder="Enter text to translate..." />
          </ToolField>
          <button onClick={handleTranslate} disabled={generating || !text} className={toolButtonClass}>
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
            {generating ? 'Translating...' : 'Translate'}
          </button>
        </ToolInputPanel>

        <ToolOutputPanel loading={generating} hasContent={!!result}>
          {result && (
            <div>
              <div className="flex justify-end mb-2">
                <button onClick={copyResult} className="flex items-center gap-1.5 text-gray-400 hover:text-white text-xs transition-colors">
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{result}</div>
            </div>
          )}
        </ToolOutputPanel>
      </div>
    </ToolShell>
  );
}
