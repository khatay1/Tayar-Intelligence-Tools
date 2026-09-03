import { useState } from 'react';
import { Check, Copy, Download, FilePenLine, Sparkles } from 'lucide-react';
import { useLocalizer } from '@/lib/ui-localization';
import { completeMeteredLocalAction } from '@/lib/tool-usage';
import { ToolField, ToolInputPanel, ToolOutputPanel, ToolShell, toolInputClass } from '../shared/ToolShell';
import { generateLetter, safeLetterFileName } from './letter-generator';
import { LETTER_TYPES, TONES } from './letter-templates';
import { LetterTone, LetterType } from './letter-types';

function todayIso() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function LetterGeneratorTool({ darkMode: _darkMode }: { darkMode: boolean }) {
  const l = useLocalizer();
  const [type, setType] = useState<LetterType>('recommendation');
  const [tone, setTone] = useState<LetterTone>('professional');
  const [senderName, setSenderName] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [organization, setOrganization] = useState('');
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [date, setDate] = useState(todayIso);
  const [result, setResult] = useState('');
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const selectedType = LETTER_TYPES.find((item) => item.value === type) || LETTER_TYPES[0];

  async function generate() {
    if (generating) return;
    setGenerating(true);
    setError('');
    try {
      const next = await completeMeteredLocalAction('letter-generator', 'generate_letter', () => {
        const value = generateLetter({ type, tone, senderName, recipientName, organization, subject, details, date });
        if (!value.trim()) throw new Error(l('Could not generate this letter.'));
        return value;
      });
      setResult(next);
      setCopied(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : l('Could not generate this letter.'));
    } finally {
      setGenerating(false);
    }
  }

  async function copyResult() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  function downloadResult() {
    if (!result) return;
    const blob = new Blob([result], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    try {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = safeLetterFileName(subject, type);
      anchor.rel = 'noopener';
      anchor.click();
    } finally {
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  return (
    <ToolShell
      icon={FilePenLine}
      title={l('Letter Generator')}
      description={l('Create practical letters from original Tayar templates and edit the result manually.')}
      badge="No API"
    >
      <div className="grid xl:grid-cols-[390px_minmax(0,1fr)] gap-6 items-start">
        <ToolInputPanel>
          <ToolField label={l('Letter type')}>
            <select value={type} onChange={(event) => { setType(event.target.value as LetterType); setError(''); }} className={toolInputClass}>
              {LETTER_TYPES.map((item) => <option key={item.value} value={item.value}>{l(item.label)}</option>)}
            </select>
          </ToolField>

          <div className="rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2 text-xs text-gray-500">
            {l(selectedType.hint)}
          </div>

          <ToolField label={l('Tone')}>
            <select value={tone} onChange={(event) => { setTone(event.target.value as LetterTone); setError(''); }} className={toolInputClass}>
              {TONES.map((item) => <option key={item.value} value={item.value}>{l(item.label)}</option>)}
            </select>
          </ToolField>

          <div className="grid sm:grid-cols-2 gap-3">
            <ToolField label={l('Your name')}>
              <input value={senderName} maxLength={120} onChange={(event) => setSenderName(event.target.value)} className={toolInputClass} />
            </ToolField>
            <ToolField label={l('Recipient')}>
              <input value={recipientName} maxLength={120} onChange={(event) => setRecipientName(event.target.value)} className={toolInputClass} />
            </ToolField>
          </div>

          <ToolField label={l('Organization')}>
            <input value={organization} maxLength={120} onChange={(event) => setOrganization(event.target.value)} className={toolInputClass} />
          </ToolField>

          <ToolField label={l('Subject or purpose')}>
            <input value={subject} maxLength={120} onChange={(event) => setSubject(event.target.value)} className={toolInputClass} placeholder={l('What is this letter about?')} />
          </ToolField>

          <ToolField label={l('Important details')}>
            <textarea
              value={details}
              maxLength={2500}
              onChange={(event) => setDetails(event.target.value)}
              className={`${toolInputClass} min-h-[130px] resize-y`}
              placeholder={l('Add facts, dates, context or the outcome you want.')}
            />
          </ToolField>

          <ToolField label={l('Date')}>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={toolInputClass} />
          </ToolField>

          <button
            type="button"
            onClick={() => void generate()}
            disabled={generating}
            className="w-full min-h-11 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            <Sparkles className={`w-4 h-4 ${generating ? 'animate-pulse' : ''}`} />
            {l(generating ? 'Generating...' : result ? 'Regenerate Letter' : 'Generate Letter')}
          </button>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-200">
              {error}
            </div>
          )}
        </ToolInputPanel>

        <ToolOutputPanel
          hasContent={Boolean(result)}
          empty={<div className="py-16 text-center text-sm text-gray-600">{l('Choose a letter type and add your details.')}</div>}
        >
          {result && (
            <div className="min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="text-white font-semibold">{l('Edit the result')}</div>
                  <div className="text-xs text-gray-500 break-words">{l('The generated text is fully editable before you copy or download it.')}</div>
                </div>
                <div className="flex flex-col xs:flex-row sm:flex-row gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => void copyResult()}
                    className="min-h-11 inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs text-gray-300 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {l(copied ? 'Copied' : 'Copy')}
                  </button>
                  <button
                    type="button"
                    onClick={downloadResult}
                    className="min-h-11 inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs text-gray-300 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {l('TXT')}
                  </button>
                </div>
              </div>

              <textarea
                value={result}
                onChange={(event) => setResult(event.target.value.slice(0, 10000))}
                className="w-full min-h-[420px] sm:min-h-[580px] resize-y rounded-xl border border-white/10 bg-white/[0.025] p-4 sm:p-5 text-sm leading-relaxed text-gray-200 focus:border-violet-500/40 focus:outline-none"
              />
            </div>
          )}
        </ToolOutputPanel>
      </div>
    </ToolShell>
  );
}
