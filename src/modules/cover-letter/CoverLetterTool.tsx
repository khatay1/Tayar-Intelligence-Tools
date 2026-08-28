import { useLocalizer } from '@/lib/ui-localization';
import { useState } from 'react';
import { Mail, Loader2, Copy, Check } from 'lucide-react';
import { ToolShell, ToolInputPanel, ToolOutputPanel, ToolField, toolInputClass, toolButtonClass } from '../shared/ToolShell';
import { createAIService } from '@/lib/ai/service';
import { useToast } from '@/components/ui/Toast';

export default function CoverLetterTool({ darkMode: _darkMode }: { darkMode: boolean }) {
  const l = useLocalizer();
  const { loading, update } = useToast();
  const [name, setName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [motivation, setMotivation] = useState('');
  const [result, setResult] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    if (!jobTitle) return;
    setGenerating(true);
    setResult('');
    const toastId = loading(l('Writing cover letter...'));
    try {
      const ai = createAIService('cover-letter');
      await ai.stream(
        { action: 'generate', name, jobTitle, company, qualifications, motivation },
        [],
        (chunk) => setResult(prev => prev + chunk)
      );
      update(toastId, l('Cover letter written'), 'success');
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
    <ToolShell icon={Mail} title={l('Cover Letter Writer')} description={l('Craft personalized cover letters for any job.')} badge="v2.0">
      <div className="grid lg:grid-cols-2 gap-6">
        <ToolInputPanel>
          <ToolField label={l('Your Name')}>
            <input value={name} onChange={e => setName(e.target.value)} className={toolInputClass} placeholder="John Doe" />
          </ToolField>
          <ToolField label={l('Job Title')}>
            <input value={jobTitle} onChange={e => setJobTitle(e.target.value)} className={toolInputClass} placeholder={l('Software Engineer')} />
          </ToolField>
          <ToolField label={l('Company')}>
            <input value={company} onChange={e => setCompany(e.target.value)} className={toolInputClass} placeholder="Google" />
          </ToolField>
          <ToolField label={l('Key Qualifications')}>
            <textarea value={qualifications} onChange={e => setQualifications(e.target.value)} className={`${toolInputClass} min-h-[80px] resize-y`} placeholder={l('5 years React, led team of 4...')} />
          </ToolField>
          <ToolField label={l('Why this job?')}>
            <textarea value={motivation} onChange={e => setMotivation(e.target.value)} className={`${toolInputClass} min-h-[60px] resize-y`} placeholder={l('Passionate about...')} />
          </ToolField>
          <button onClick={handleGenerate} disabled={generating} className={toolButtonClass}>
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            {l(generating ? 'Writing...' : 'Write Cover Letter')}
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
