import { useLocalizer } from '@/lib/ui-localization';
import { useState } from 'react';
import { GraduationCap, Loader2, Copy, Check } from 'lucide-react';
import { ToolShell, ToolInputPanel, ToolOutputPanel, ToolField, toolInputClass, toolButtonClass } from '../shared/ToolShell';
import { createAIService } from '@/lib/ai/service';
import { useToast } from '@/components/ui/Toast';

const ACTIONS = [
  { value: 'explain', label: 'Explain a Concept' },
  { value: 'quiz', label: 'Create a Quiz' },
  { value: 'flashcards', label: 'Generate Flashcards' },
  { value: 'study-plan', label: 'Create Study Plan' },
];

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

export default function StudyAssistantTool({ darkMode: _darkMode }: { darkMode: boolean }) {
  const l = useLocalizer();
  const { loading, update } = useToast();
  const [action, setAction] = useState('explain');
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState('Beginner');
  const [count, setCount] = useState('5');
  const [result, setResult] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    if (!topic) return;
    setGenerating(true);
    setResult('');
    const toastId = loading(l('Generating study material...'));
    try {
      const ai = createAIService('study-assistant');
      await ai.stream(
        { action, topic, level, count: parseInt(count) },
        [],
        (chunk) => setResult(prev => prev + chunk)
      );
      update(toastId, l('Study material generated'), 'success');
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
    <ToolShell icon={GraduationCap} title={l('Study Assistant')} description={l('Explain concepts, create quizzes, and study plans.')} badge="v2.0">
      <div className="grid lg:grid-cols-2 gap-6">
        <ToolInputPanel>
          <ToolField label={l('What do you need?')}>
            <select value={action} onChange={e => setAction(e.target.value)} className={toolInputClass}>
              {ACTIONS.map(a => <option key={a.value} value={a.value}>{l(a.label)}</option>)}
            </select>
          </ToolField>
          <ToolField label={l('Topic / Subject')}>
            <input value={topic} onChange={e => setTopic(e.target.value)} className={toolInputClass} placeholder={l('Quantum computing')} />
          </ToolField>
          <div className="grid grid-cols-2 gap-3">
            <ToolField label={l('Level')}>
              <select value={level} onChange={e => setLevel(e.target.value)} className={toolInputClass}>
                {LEVELS.map(item => <option key={item} value={item}>{l(item)}</option>)}
              </select>
            </ToolField>
            {(action === 'quiz' || action === 'flashcards') && (
              <ToolField label={l('Count')}>
                <input type="number" value={count} onChange={e => setCount(e.target.value)} className={toolInputClass} min="1" max="20" />
              </ToolField>
            )}
          </div>
          <button onClick={handleGenerate} disabled={generating || !topic} className={toolButtonClass}>
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <GraduationCap className="w-4 h-4" />}
            {l(generating ? 'Generating...' : 'Generate')}
          </button>
        </ToolInputPanel>

        <ToolOutputPanel loading={generating} hasContent={!!result}>
          {result && (
            <div>
              <div className="flex justify-end mb-2">
                <button onClick={copyResult} className="flex items-center gap-1.5 text-gray-400 hover:text-white text-xs transition-colors">
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {l(copied ? 'Copied' : 'Copy')}
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
