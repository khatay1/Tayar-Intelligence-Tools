import { useState } from 'react';
import { Check, Copy, Download, FilePenLine, Sparkles } from 'lucide-react';
import { useLocalizer } from '@/lib/ui-localization';
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

  const selectedType = LETTER_TYPES.find((item) => item.value === type) || LETTER_TYPES[0];

  function generate() {
    setResult(generateLetter({ type, tone, senderName, recipientName, organization, subject, details, date }));
    setCopied(false);
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
            <select value={type} onChange={(event) => setType(event.target.value as LetterType)} className={toolInputClass}>
              {LETTER_TYPES.map((item) => <option key={item.value} value={item.value}>{l(item.label)}</option>)}
            </select>
          </ToolField>

          <div className="rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2 text-xs text-gray-500">
            {l(selectedType.hint)}
          </div>

          <ToolField label={l('Tone')}>
            <select value={tone} onChange={(event) => setTone(event.target.value as LetterTone)} className={toolInputClass}>
              {TONES.map((item) => <option key={item.value} value={item.value}>{l(item.label)}</option>)}
            </select>
          </ToolField>

          <div className="grid grid-cols-2 gap-3">
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
            onClick={generate}
            className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            {l(result ? 'Regenerate Letter' : 'Generate Letter')}
          </button>
        </ToolInputPanel>

        <ToolOutputPanel
          hasContent={Boolean(result)}
          empty={<div className="py-16 text-center text-sm text-gray-600">{l('Choose a letter type and add your details.')}</div>}
        >
          {result && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div>
                  <div className="text-white font-semibold">{l('Edit the result')}</div>
                  <div className="text-xs text-gray-500">{l('The generated text is fully editable before you copy or download it.')}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void copyResult()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs text-gray-300 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {l(copied ? 'Copied' : 'Copy')}
                  </button>
                  <button
                    type="button"
                    onClick={downloadResult}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs text-gray-300 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {l('TXT')}
                  </button>
                </div>
              </div>

              <textarea
                value={result}
                onChange={(event) => setResult(event.target.value.slice(0, 10000))}
                className="w-full min-h-[580px] resize-y rounded-xl border border-white/10 bg-white/[0.025] p-5 text-sm leading-relaxed text-gray-200 focus:border-violet-500/40 focus:outline-none"
              />
            </div>
          )}
        </ToolOutputPanel>
      </div>
    </ToolShell>
  );
}
