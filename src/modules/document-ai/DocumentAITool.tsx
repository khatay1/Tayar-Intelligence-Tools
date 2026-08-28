import { useState } from 'react';
import { BookOpen, Loader2, Copy, Check } from 'lucide-react';
import { ToolShell, ToolInputPanel, ToolOutputPanel, ToolField, toolInputClass, toolButtonClass } from '../shared/ToolShell';
import { createAIService } from '@/lib/ai/service';
import { useToast } from '@/components/ui/Toast';

const ACTIONS = [
  { value: 'summarize', label: 'Summarize' },
  { value: 'analyze', label: 'Analyze' },
  { value: 'qa', label: 'Ask a Question' },
];

export default function DocumentAITool({ darkMode: _darkMode }: { darkMode: boolean }) {
  const { loading, update } = useToast();
  const [action, setAction] = useState('summarize');
  const [content, setContent] = useState('');
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleAnalyze() {
    if (!content) return;
    setGenerating(true);
    setResult('');
    const toastId = loading('Analyzing document...');
    try {
      const ai = createAIService('document-ai');
      await ai.stream(
        { action, content, question },
        [],
        (chunk) => setResult(prev => prev + chunk)
      );
      update(toastId, 'Analysis complete', 'success');
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
    <ToolShell icon={BookOpen} title="Document AI" description="Summarize, analyze, and extract from documents." badge="Premium">
      <div className="grid lg:grid-cols-2 gap-6">
        <ToolInputPanel>
          <ToolField label="Action">
            <select value={action} onChange={e => setAction(e.target.value)} className={toolInputClass}>
              {ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </ToolField>
          <ToolField label="Document Content">
            <textarea value={content} onChange={e => setContent(e.target.value)} className={`${toolInputClass} min-h-[200px] resize-y font-mono text-xs`} placeholder="Paste your document text here..." />
          </ToolField>
          {action === 'qa' && (
            <ToolField label="Question">
              <input value={question} onChange={e => setQuestion(e.target.value)} className={toolInputClass} placeholder="What is the main conclusion?" />
            </ToolField>
          )}
          <button onClick={handleAnalyze} disabled={generating || !content} className={toolButtonClass}>
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
            {generating ? 'Analyzing...' : 'Analyze Document'}
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
