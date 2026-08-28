import { useLocalizer } from '@/lib/ui-localization';
import { useState } from 'react';
import { Sparkles, Loader2, Copy, Check } from 'lucide-react';
import { ToolShell, ToolInputPanel, ToolOutputPanel, ToolField, toolInputClass, toolButtonClass } from '../shared/ToolShell';
import { createAIService } from '@/lib/ai/service';
import { useToast } from '@/components/ui/Toast';

export default function CVBuilderTool({ darkMode: _darkMode }: { darkMode: boolean }) {
  const l = useLocalizer();
  const { loading, update, success } = useToast();
  const [fullName, setFullName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [years, setYears] = useState('');
  const [skills, setSkills] = useState('');
  const [industry, setIndustry] = useState('');
  const [result, setResult] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    if (!jobTitle && !fullName) return;
    setGenerating(true);
    setResult('');
    const toastId = loading(l('Generating CV...'));
    try {
      const ai = createAIService('cv-builder');
      const response = await ai.stream(
        { action: 'generate', fullName, jobTitle, years, skills, industry },
        [],
        (chunk) => setResult(prev => prev + chunk)
      );
      update(toastId, l('CV generated successfully'), 'success');
      void response;
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
    <ToolShell icon={Sparkles} title={l('AI CV Builder')} description={l('Create ATS-friendly resumes with AI.')} badge="v2.0">
      <div className="grid lg:grid-cols-2 gap-6">
        <ToolInputPanel>
          <ToolField label={l('Full Name')}>
            <input value={fullName} onChange={e => setFullName(e.target.value)} className={toolInputClass} placeholder="John Doe" />
          </ToolField>
          <ToolField label={l('Job Title')}>
            <input value={jobTitle} onChange={e => setJobTitle(e.target.value)} className={toolInputClass} placeholder={l('Software Engineer')} />
          </ToolField>
          <ToolField label={l('Years of Experience')}>
            <input value={years} onChange={e => setYears(e.target.value)} className={toolInputClass} placeholder="5" />
          </ToolField>
          <ToolField label={l('Key Skills (comma separated)')}>
            <input value={skills} onChange={e => setSkills(e.target.value)} className={toolInputClass} placeholder="React, Node.js, Python" />
          </ToolField>
          <ToolField label={l('Target Industry')}>
            <input value={industry} onChange={e => setIndustry(e.target.value)} className={toolInputClass} placeholder={l('Technology')} />
          </ToolField>
          <button onClick={handleGenerate} disabled={generating} className={toolButtonClass}>
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {l(generating ? 'Generating...' : 'Generate CV')}
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
              <div className="prose prose-invert max-w-none text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{result}</div>
            </div>
          )}
        </ToolOutputPanel>
      </div>
    </ToolShell>
  );
}
