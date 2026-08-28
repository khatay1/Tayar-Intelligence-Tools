import { useState } from 'react';
import { PenLine, Loader2, Copy, Check } from 'lucide-react';
import { ToolShell, ToolInputPanel, ToolOutputPanel, ToolField, toolInputClass, toolButtonClass } from '../shared/ToolShell';
import { createAIService } from '@/lib/ai/service';
import { useToast } from '@/components/ui/Toast';

const CONTENT_TYPES = ['Blog Post', 'Article', 'Marketing Copy', 'Email', 'Social Media Post', 'Product Description'];
const TONES = ['Professional', 'Casual', 'Persuasive', 'Informative', 'Humorous', 'Inspirational'];
const LENGTHS = ['Short', 'Medium', 'Long'];

export default function WriterTool({ darkMode: _darkMode }: { darkMode: boolean }) {
  const { loading, update } = useToast();
  const [type, setType] = useState('Blog Post');
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('Professional');
  const [length, setLength] = useState('Medium');
  const [audience, setAudience] = useState('');
  const [points, setPoints] = useState('');
  const [result, setResult] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    if (!topic) return;
    setGenerating(true);
    setResult('');
    const toastId = loading('Writing content...');
    try {
      const ai = createAIService('ai-writer');
      await ai.stream(
        { action: 'generate', type, topic, tone, length, audience, points },
        [],
        (chunk) => setResult(prev => prev + chunk)
      );
      update(toastId, 'Content generated', 'success');
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

  return (
    <ToolShell icon={PenLine} title="AI Writer" description="Write blogs, articles, and marketing copy." badge="v2.0">
      <div className="grid lg:grid-cols-2 gap-6">
        <ToolInputPanel>
          <ToolField label="Content Type">
            <select value={type} onChange={e => setType(e.target.value)} className={toolInputClass}>
              {CONTENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </ToolField>
          <ToolField label="Topic">
            <input value={topic} onChange={e => setTopic(e.target.value)} className={toolInputClass} placeholder="The future of AI in healthcare" />
          </ToolField>
          <div className="grid grid-cols-2 gap-3">
            <ToolField label="Tone">
              <select value={tone} onChange={e => setTone(e.target.value)} className={toolInputClass}>
                {TONES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </ToolField>
            <ToolField label="Length">
              <select value={length} onChange={e => setLength(e.target.value)} className={toolInputClass}>
                {LENGTHS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </ToolField>
          </div>
          <ToolField label="Target Audience">
            <input value={audience} onChange={e => setAudience(e.target.value)} className={toolInputClass} placeholder="Healthcare professionals" />
          </ToolField>
          <ToolField label="Key Points (optional)">
            <textarea value={points} onChange={e => setPoints(e.target.value)} className={`${toolInputClass} min-h-[60px] resize-y`} placeholder="One point per line" />
          </ToolField>
          <button onClick={handleGenerate} disabled={generating} className={toolButtonClass}>
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenLine className="w-4 h-4" />}
            {generating ? 'Writing...' : 'Generate Content'}
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
