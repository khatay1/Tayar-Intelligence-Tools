import { useState } from 'react';
import { Check, Copy, Loader2, Mailbox, Reply, Sparkles, Wand2 } from 'lucide-react';
import { useLocalizer } from '@/lib/ui-localization';
import { useToast } from '@/components/ui/Toast';
import {
  ToolField,
  ToolInputPanel,
  ToolOutputPanel,
  ToolShell,
  toolButtonClass,
  toolInputClass,
} from '../shared/ToolShell';
import { runBusinessAI } from './business-ai';

type EmailMode = 'compose' | 'reply' | 'improve';

const MODE_ICONS = {
  compose: Sparkles,
  reply: Reply,
  improve: Wand2,
} as const;

export default function EmailWriterTool({ darkMode: _darkMode }: { darkMode: boolean }) {
  const l = useLocalizer();
  const { loading, update } = useToast();
  const [mode, setMode] = useState<EmailMode>('compose');
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [context, setContext] = useState('');
  const [sourceEmail, setSourceEmail] = useState('');
  const [tone, setTone] = useState('professional');
  const [language, setLanguage] = useState('English');
  const [length, setLength] = useState('medium');
  const [result, setResult] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const needsSource = mode !== 'compose';

  async function generate() {
    const mainInput = needsSource ? sourceEmail.trim() : context.trim();
    if (!mainInput) {
      setError(l(needsSource ? 'Paste the email you want to work with.' : 'Describe what the email should say.'));
      return;
    }

    setGenerating(true);
    setError('');
    setResult('');
    const toastId = loading(l('Writing email...'));

    try {
      const system = `You are Tayar AI Email, an expert business communication assistant.
Write natural, polished email copy without inventing facts, commitments, dates, prices, attachments, or authority the user did not provide.
Match the requested language and tone. Preserve names and concrete details from the user's input.
Do not add commentary about your process. Return only the finished email.
For compose and reply, start with a single line in the format "Subject: ...", then a blank line, then the email body.
For improve, preserve the original intent and return the improved full email, including a Subject line if one is present or clearly inferable.`;

      const actionInstruction = mode === 'compose'
        ? `Write a new email from the user's brief.`
        : mode === 'reply'
          ? `Write a reply to the received email. Do not claim the user agreed to anything unless their reply instructions explicitly say so.`
          : `Rewrite the existing email for clarity, grammar, tone, and professionalism while preserving its meaning.`;

      const prompt = `${actionInstruction}

Output language: ${language}
Tone: ${tone}
Length: ${length}
Recipient/name if known: ${recipient || 'Not provided'}
Preferred subject/topic: ${subject || 'Not provided'}
Additional instructions/context: ${context || 'None'}

${needsSource ? `Email to ${mode === 'reply' ? 'reply to' : 'improve'}:\n<email>\n${sourceEmail.slice(0, 16000)}\n</email>` : `Email brief:\n${context.slice(0, 12000)}`}`;

      const response = await runBusinessAI('email-writer', system, prompt, {
        temperature: tone === 'creative' ? 0.7 : 0.4,
        maxTokens: 1800,
      });
      setResult(response.content);
      update(toastId, l('Email ready'), 'success');
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : l('Could not generate the email.');
      setError(message);
      update(toastId, message, 'error');
    } finally {
      setGenerating(false);
    }
  }

  async function copyResult() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError(l('Could not copy the result.'));
    }
  }

  return (
    <ToolShell
      icon={Mailbox}
      title={l('AI Email Writer')}
      description={l('Compose, reply to, and improve professional emails with AI.')}
      badge="Beta"
    >
      <div className="grid gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
        <ToolInputPanel>
          <div className="grid grid-cols-3 gap-2">
            {(['compose', 'reply', 'improve'] as EmailMode[]).map((value) => {
              const Icon = MODE_ICONS[value];
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setMode(value);
                    setError('');
                    setResult('');
                  }}
                  className={`flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-medium transition-colors ${
                    mode === value
                      ? 'border-violet-500/40 bg-violet-500/15 text-violet-200'
                      : 'border-white/10 bg-white/[0.025] text-gray-400 hover:bg-white/[0.05] hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {l(value === 'compose' ? 'Compose' : value === 'reply' ? 'Reply' : 'Improve')}
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <ToolField label={l('Language')}>
              <select value={language} onChange={(event) => setLanguage(event.target.value)} className={toolInputClass}>
                <option>English</option>
                <option>Swedish</option>
                <option>Arabic</option>
                <option>German</option>
                <option>French</option>
                <option>Spanish</option>
                <option value="Same as input">{l('Same as input')}</option>
              </select>
            </ToolField>
            <ToolField label={l('Tone')}>
              <select value={tone} onChange={(event) => setTone(event.target.value)} className={toolInputClass}>
                <option value="professional">{l('Professional')}</option>
                <option value="friendly">{l('Friendly')}</option>
                <option value="formal">{l('Formal')}</option>
                <option value="concise">{l('Concise')}</option>
                <option value="persuasive">{l('Persuasive')}</option>
                <option value="warm">{l('Warm')}</option>
                <option value="creative">{l('Creative')}</option>
              </select>
            </ToolField>
          </div>

          <ToolField label={l('Recipient / Name')}>
            <input
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              className={toolInputClass}
              placeholder={l('e.g. Maria, Hiring Manager, Customer')}
              maxLength={180}
            />
          </ToolField>

          <ToolField label={l('Subject / Topic')}>
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className={toolInputClass}
              placeholder={l('Optional subject or topic')}
              maxLength={240}
            />
          </ToolField>

          {needsSource && (
            <ToolField label={l(mode === 'reply' ? 'Received Email' : 'Email to Improve')}>
              <textarea
                value={sourceEmail}
                onChange={(event) => setSourceEmail(event.target.value)}
                className={`${toolInputClass} min-h-[170px] resize-y`}
                placeholder={l('Paste the email here...')}
                maxLength={16000}
              />
            </ToolField>
          )}

          <ToolField label={l(mode === 'compose' ? 'What should the email say?' : 'Instructions / Context')}>
            <textarea
              value={context}
              onChange={(event) => setContext(event.target.value)}
              className={`${toolInputClass} min-h-[110px] resize-y`}
              placeholder={l(mode === 'compose'
                ? 'Describe the goal, key details, dates or requested action...'
                : 'Tell AI how you want the reply or rewrite to sound...')}
              maxLength={12000}
            />
          </ToolField>

          <ToolField label={l('Length')}>
            <select value={length} onChange={(event) => setLength(event.target.value)} className={toolInputClass}>
              <option value="short">{l('Short')}</option>
              <option value="medium">{l('Medium')}</option>
              <option value="detailed">{l('Detailed')}</option>
            </select>
          </ToolField>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs leading-5 text-red-200">
              {error}
            </div>
          )}

          <button type="button" onClick={() => void generate()} disabled={generating} className={toolButtonClass}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {l(generating ? 'Writing...' : mode === 'compose' ? 'Write Email' : mode === 'reply' ? 'Write Reply' : 'Improve Email')}
          </button>
        </ToolInputPanel>

        <ToolOutputPanel
          loading={generating}
          hasContent={Boolean(result)}
          empty={<div className="py-16 text-center text-sm text-gray-600">{l('Your finished email will appear here.')}</div>}
        >
          {result && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div>
                  <div className="text-sm font-semibold text-white">{l('Ready to send')}</div>
                  <div className="mt-0.5 text-xs text-gray-500">{l('Review names, dates and commitments before sending.')}</div>
                </div>
                <button
                  type="button"
                  onClick={() => void copyResult()}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {l(copied ? 'Copied' : 'Copy')}
                </button>
              </div>
              <div className="whitespace-pre-wrap break-words text-sm leading-7 text-gray-200">{result}</div>
            </div>
          )}
        </ToolOutputPanel>
      </div>
    </ToolShell>
  );
}
