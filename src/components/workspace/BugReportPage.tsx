import { useLocalizer } from '@/lib/ui-localization';
import { useState } from 'react';
import { Bug, Send, Loader2 } from 'lucide-react';
import { PageShell } from './PageShell';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import { sanitizeText, validateMessage, checkRateLimit } from '@/lib/security';

export default function BugReportPage() {
  const l = useLocalizer();
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
      setError(l('Please describe the steps to reproduce'));
      return;
    }

    const rateLimit = checkRateLimit('bug-report', 3, 60_000);
    if (!rateLimit.allowed) {
      setError(l('Too many submissions. Please try again shortly.'));
      return;
    }

    setSending(true);
    const toastId = toast.loading(l('Submitting bug report...'));
    try {
      const report = `Tool: ${sanitizeText(tool)}\nSeverity: ${sanitizeText(severity)}\nSteps: ${sanitizeText(steps)}\nExpected: ${sanitizeText(expected)}\nActual: ${sanitizeText(actual)}`;
      const { error: dbError } = await supabase.from('support_tickets').insert({
        subject: `Bug Report [${severity}] - ${tool}`,
        body: report,
        type: 'bug-report',
        priority: severity === 'critical' ? 'critical' : severity === 'high' ? 'high' : severity === 'low' ? 'low' : 'medium',
      });
      if (dbError) throw dbError;

      toast.update(toastId, l('Bug report submitted. Thank you!'), 'success');
      setSeverity('medium');
      setTool('general');
      setSteps('');
      setExpected('');
      setActual('');
    } catch {
      toast.update(toastId, l('Failed to submit bug report. Please try again.'), 'error');
    }
    setSending(false);
  }

  const selectClass = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-violet-500/50 focus:outline-none";
  const inputClass = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-violet-500/50 focus:outline-none";

  return (
    <PageShell icon={Bug} title={l('Report a Bug')} subtitle={l('Found a bug? Help us fix it. Provide as much detail as possible.')}>
      <div className="space-y-6">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-gray-400 text-xs font-medium mb-1.5 block uppercase tracking-wider">{l('Severity')}</label>
            <select value={severity} onChange={e => setSeverity(e.target.value)} className={selectClass} aria-label={l('Bug severity')}>
              <option value="low">{l('Low - Minor issue, not blocking')}</option>
              <option value="medium">{l('Medium - Affects workflow')}</option>
              <option value="high">{l('High - Major feature broken')}</option>
              <option value="critical">{l('Critical - App unusable')}</option>
            </select>
          </div>
          <div>
            <label className="text-gray-400 text-xs font-medium mb-1.5 block uppercase tracking-wider">{l('Affected Tool')}</label>
            <select value={tool} onChange={e => setTool(e.target.value)} className={selectClass} aria-label={l('Affected tool')}>
              <option value="general">{l('General / Platform')}</option>
              <option value="cv-builder">{l('CV Builder')}</option>
              <option value="cover-letter">{l('Cover Letter')}</option>
              <option value="ai-writer">{l('AI Writer')}</option>
              <option value="translator">{l('Translator')}</option>
              <option value="document-ai">{l('Document AI')}</option>
              <option value="study-assistant">{l('Study Assistant')}</option>
              <option value="settings">{l('Settings')}</option>
              <option value="auth">{l('Login / Signup')}</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-gray-400 text-xs font-medium mb-1.5 block uppercase tracking-wider">{l('Steps to Reproduce')}</label>
          <textarea value={steps} onChange={e => setSteps(e.target.value)} placeholder={l('1. Go to...\n2. Click on...\n3. Enter...')} aria-label={l('Steps to reproduce')} className={`${inputClass} min-h-[120px] resize-y font-mono text-xs`} />
        </div>

        <div>
          <label className="text-gray-400 text-xs font-medium mb-1.5 block uppercase tracking-wider">{l('Expected Behavior')}</label>
          <input value={expected} onChange={e => setExpected(e.target.value)} placeholder={l('What should have happened?')} aria-label={l('Expected behavior')} className={inputClass} />
        </div>

        <div>
          <label className="text-gray-400 text-xs font-medium mb-1.5 block uppercase tracking-wider">{l('Actual Behavior')}</label>
          <input value={actual} onChange={e => setActual(e.target.value)} placeholder={l('What actually happened?')} aria-label={l('Actual behavior')} className={inputClass} />
        </div>

        {error && <p className="text-red-400 text-sm" role="alert">{error}</p>}

        <button onClick={handleSubmit} disabled={sending || !steps} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {l('Submit Bug Report')}
        </button>
      </div>
    </PageShell>
  );
}
