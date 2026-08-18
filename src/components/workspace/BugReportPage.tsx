import { useState } from 'react';
import { Bug, Send, Loader2 } from 'lucide-react';
import { PageShell } from './PageShell';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import { sanitizeText, validateMessage, checkRateLimit } from '@/lib/security';

export default function BugReportPage() {
  const toast = useToast();
  const [severity, setSeverity] = useState('medium');
  const [tool, setTool] = useState('general');
  const [steps, setSteps] = useState('');
  const [expected, setExpected] = useState('');
  const [actual, setActual] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    setError('');
    const stepsCheck = validateMessage(steps);
    if (!stepsCheck.valid) {
      setError('Please describe the steps to reproduce');
      return;
    }

    const rateLimit = checkRateLimit('bug-report', 3, 60_000);
    if (!rateLimit.allowed) {
      setError(`Too many submissions. Please wait ${Math.ceil(rateLimit.retryAfterMs / 1000)}s.`);
      return;
    }

    setSending(true);
    const toastId = toast.loading('Submitting bug report...');
    try {
      const report = `Tool: ${sanitizeText(tool)}\nSeverity: ${sanitizeText(severity)}\nSteps: ${sanitizeText(steps)}\nExpected: ${sanitizeText(expected)}\nActual: ${sanitizeText(actual)}`;
      const { error: dbError } = await supabase.from('notifications').insert({
        title: `Bug Report [${severity}] - ${tool}`,
        message: report,
        type: 'bug-report',
      });
      if (dbError) throw dbError;

      toast.update(toastId, 'Bug report submitted. Thank you!', 'success');
      setSeverity('medium');
      setTool('general');
      setSteps('');
      setExpected('');
      setActual('');
    } catch {
      toast.update(toastId, 'Failed to submit bug report. Please try again.', 'error');
    }
    setSending(false);
  }

  const selectClass = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-violet-500/50 focus:outline-none";
  const inputClass = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-violet-500/50 focus:outline-none";

  return (
    <PageShell icon={Bug} title="Report a Bug" subtitle="Found a bug? Help us fix it. Provide as much detail as possible.">
      <div className="space-y-6">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-gray-400 text-xs font-medium mb-1.5 block uppercase tracking-wider">Severity</label>
            <select value={severity} onChange={e => setSeverity(e.target.value)} className={selectClass} aria-label="Bug severity">
              <option value="low">Low - Minor issue, not blocking</option>
              <option value="medium">Medium - Affects workflow</option>
              <option value="high">High - Major feature broken</option>
              <option value="critical">Critical - App unusable</option>
            </select>
          </div>
          <div>
            <label className="text-gray-400 text-xs font-medium mb-1.5 block uppercase tracking-wider">Affected Tool</label>
            <select value={tool} onChange={e => setTool(e.target.value)} className={selectClass} aria-label="Affected tool">
              <option value="general">General / Platform</option>
              <option value="cv-builder">CV Builder</option>
              <option value="cover-letter">Cover Letter</option>
              <option value="ai-writer">AI Writer</option>
              <option value="translator">Translator</option>
              <option value="document-ai">Document AI</option>
              <option value="study-assistant">Study Assistant</option>
              <option value="settings">Settings</option>
              <option value="auth">Login / Signup</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-gray-400 text-xs font-medium mb-1.5 block uppercase tracking-wider">Steps to Reproduce</label>
          <textarea value={steps} onChange={e => setSteps(e.target.value)} placeholder="1. Go to...&#10;2. Click on...&#10;3. Enter..." aria-label="Steps to reproduce" className={`${inputClass} min-h-[120px] resize-y font-mono text-xs`} />
        </div>

        <div>
          <label className="text-gray-400 text-xs font-medium mb-1.5 block uppercase tracking-wider">Expected Behavior</label>
          <input value={expected} onChange={e => setExpected(e.target.value)} placeholder="What should have happened?" aria-label="Expected behavior" className={inputClass} />
        </div>

        <div>
          <label className="text-gray-400 text-xs font-medium mb-1.5 block uppercase tracking-wider">Actual Behavior</label>
          <input value={actual} onChange={e => setActual(e.target.value)} placeholder="What actually happened?" aria-label="Actual behavior" className={inputClass} />
        </div>

        {error && <p className="text-red-400 text-sm" role="alert">{error}</p>}

        <button onClick={handleSubmit} disabled={sending || !steps} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Submit Bug Report
        </button>
      </div>
    </PageShell>
  );
}
